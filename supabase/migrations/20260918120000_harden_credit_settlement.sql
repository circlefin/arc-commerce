-- Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
--
-- Licensed under the Apache License, Version 2.0 (the "License");
-- you may not use this file except in compliance with the License.
-- You may obtain a copy of the License at
--
--     http://www.apache.org/licenses/LICENSE-2.0
--
-- Unless required by applicable law or agreed to in writing, software
-- distributed under the License is distributed on an "AS IS" BASIS,
-- WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
-- See the License for the specific language governing permissions and
-- limitations under the License.
--
-- SPDX-License-Identifier: Apache-2.0

-- Migration: Harden credit settlement and transaction visibility.
--
--   1. settle_user_transaction(): status change + credit grant in ONE row-locked
--      transaction. Previously the app read the status, called increment_credits,
--      then updated the status in three round trips, so a webhook and the wallet
--      confirmation racing each other could both credit the same purchase.
--   2. transactions SELECT policy: users see their own rows; only the admin sees
--      all of them. The old policy was USING (true) on the premise that only the
--      admin can sign in, but self-service sign-up is a shipped feature.
--   3. Case-insensitive uniqueness for (chain, tx_hash). The existing unique
--      constraint is case-sensitive, so 0xAB.. and 0xab.. could be recorded (and
--      credited) as two purchases for the same on-chain transfer.
--   4. Drop the credits INSERT policy. The signup trigger creates the row, and no
--      client ever needs to insert one.


-- ===========================================================================
-- 1. Atomic settlement
-- ===========================================================================

CREATE OR REPLACE FUNCTION public.settle_user_transaction(
  p_transaction_id uuid,
  p_new_status public.transaction_status,
  p_metadata jsonb DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  tx public.transactions%ROWTYPE;
  was_credited boolean;
  now_credited boolean;
  old_rank int;
  new_rank int;
BEGIN
  -- Serialise concurrent settlements of the same purchase.
  SELECT * INTO tx
  FROM public.transactions
  WHERE id = p_transaction_id
    AND transaction_type = 'USER'
    AND direction = 'credit'
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN 'not_found';
  END IF;

  IF tx.status = p_new_status THEN
    RETURN 'noop';
  END IF;

  -- 'confirmed' and 'complete' are the states in which credits have been granted.
  was_credited := tx.status IN ('confirmed', 'complete');
  now_credited := p_new_status IN ('confirmed', 'complete');

  -- A failed purchase is terminal, and a credited one can only move forward.
  IF tx.status = 'failed' THEN
    RETURN 'noop';
  END IF;

  IF p_new_status = 'failed' THEN
    IF was_credited THEN
      RETURN 'noop';
    END IF;
  ELSE
    old_rank := CASE tx.status WHEN 'pending' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'complete' THEN 3 ELSE 0 END;
    new_rank := CASE p_new_status WHEN 'pending' THEN 1 WHEN 'confirmed' THEN 2 WHEN 'complete' THEN 3 ELSE 0 END;
    IF new_rank <= old_rank THEN
      RETURN 'noop';
    END IF;
  END IF;

  IF now_credited AND NOT was_credited THEN
    PERFORM public.increment_credits(tx.user_id, tx.credit_amount);
  END IF;

  UPDATE public.transactions
  SET status = p_new_status,
      metadata = COALESCE(metadata, '{}'::jsonb) || COALESCE(p_metadata, '{}'::jsonb)
  WHERE id = p_transaction_id;

  IF now_credited AND NOT was_credited THEN
    RETURN 'credited';
  END IF;
  RETURN 'updated';
END;
$$;

COMMENT ON FUNCTION public.settle_user_transaction(uuid, public.transaction_status, jsonb) IS
  'Atomically moves a USER credit purchase to a new status and grants its credits exactly once. Returns not_found | noop | updated | credited.';

REVOKE ALL ON FUNCTION public.settle_user_transaction(uuid, public.transaction_status, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.settle_user_transaction(uuid, public.transaction_status, jsonb) TO service_role;


-- ===========================================================================
-- 2. Transaction visibility
-- ===========================================================================

-- Single definition of "admin" for RLS. Matches the hardcoded admin address used by
-- handle_new_user_credits / increment_credits and by lib/supabase/initialize-admin-user.ts.
CREATE OR REPLACE FUNCTION public.is_admin_user()
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = ''
AS $$
  SELECT COALESCE((SELECT auth.jwt() ->> 'email'), '') = 'admin@admin.com';
$$;

GRANT EXECUTE ON FUNCTION public.is_admin_user() TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated users can read all transactions" ON public.transactions;

CREATE POLICY "Users read own transactions, admin reads all"
ON public.transactions
FOR SELECT
TO authenticated
USING (
  user_id = (SELECT auth.uid())
  OR (SELECT public.is_admin_user())
);


-- ===========================================================================
-- 3. Case-insensitive (chain, tx_hash) uniqueness
-- ===========================================================================

CREATE UNIQUE INDEX IF NOT EXISTS transactions_chain_lower_tx_hash_key
ON public.transactions (chain, lower(tx_hash))
WHERE tx_hash IS NOT NULL;


-- ===========================================================================
-- 4. Credits INSERT policy is unnecessary and widens the attack surface
-- ===========================================================================

DROP POLICY IF EXISTS "Users can insert their own credit record" ON public.credits;
