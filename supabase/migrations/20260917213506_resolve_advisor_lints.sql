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

-- Resolve the Supabase Advisor security and performance findings.

-- Covering index for the cascading FK that the audit-trail RLS policy also reads.
CREATE INDEX IF NOT EXISTS idx_transaction_events_transaction_id
ON public.transaction_events(transaction_id);

-- Wrap auth.role()/auth.uid() in a sub-select so they evaluate once per statement, not per row.
DROP POLICY IF EXISTS "Allow full access for service role" ON public.admin_wallets;

CREATE POLICY "Allow full access for service role"
ON public.admin_wallets
FOR ALL
TO service_role
USING ( (select auth.role()) = 'service_role' )
WITH CHECK ( (select auth.role()) = 'service_role' );

DROP POLICY IF EXISTS "Users can view their own credits" ON public.credits;

CREATE POLICY "Users can view their own credits"
ON public.credits
FOR SELECT
TO authenticated
USING ( (select auth.uid()) = user_id );

DROP POLICY IF EXISTS "Users can insert their own credit record" ON public.credits;

CREATE POLICY "Users can insert their own credit record"
ON public.credits
FOR INSERT
TO authenticated
WITH CHECK ( (select auth.uid()) = user_id );

-- Dropped: no application query reaches for these indexes.
DROP INDEX IF EXISTS public.idx_transactions_status;
DROP INDEX IF EXISTS public.idx_transactions_missing_tx_hash;
DROP INDEX IF EXISTS public.idx_twe_circle_transaction_id;
DROP INDEX IF EXISTS public.idx_twe_received_at;

-- These SECURITY DEFINER functions are server-side only, so revoke the implicit PUBLIC grant.
REVOKE ALL ON FUNCTION public.check_user_exists(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_exists(text) TO service_role;

REVOKE ALL ON FUNCTION public.increment_credits(uuid, numeric) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, numeric) TO service_role;

REVOKE ALL ON FUNCTION public.handle_new_user_credits() FROM PUBLIC, anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.handle_new_user_credits() TO supabase_auth_admin;
