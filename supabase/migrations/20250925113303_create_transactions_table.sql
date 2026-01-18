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

-- 1. Create Custom Types
CREATE TYPE transaction_direction AS ENUM ('credit', 'debit');
CREATE TYPE transaction_status AS ENUM ('pending', 'confirmed', 'failed', 'complete');

-- 2. Create the `transactions` table
CREATE TABLE public.transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    wallet_id text NOT NULL,
    direction transaction_direction NOT NULL,
    amount_usdc numeric(18, 6) NOT NULL CHECK (amount_usdc > 0),
    fee_usdc numeric(18, 6) NOT NULL DEFAULT 0 CHECK (fee_usdc >= 0),
    credit_amount numeric(18, 6) NOT NULL CHECK (credit_amount > 0),
    exchange_rate numeric(18, 8) NOT NULL CHECK (exchange_rate > 0),
    chain text NOT NULL,
    asset text NOT NULL DEFAULT 'USDC' CHECK (asset = 'USDC'),
    tx_hash text NOT NULL,
    status transaction_status NOT NULL DEFAULT 'pending',
    metadata jsonb,
    idempotency_key text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- 3. Create Constraints and Indexes
ALTER TABLE public.transactions ADD CONSTRAINT transactions_chain_tx_hash_key UNIQUE (chain, tx_hash);
ALTER TABLE public.transactions ADD CONSTRAINT transactions_idempotency_key_key UNIQUE (idempotency_key);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_status ON public.transactions(status);
CREATE INDEX idx_transactions_created_at ON public.transactions(created_at);

-- 4. Create the `transaction_events` table for audit trail
CREATE TABLE public.transaction_events (
    id bigserial PRIMARY KEY,
    transaction_id uuid NOT NULL REFERENCES public.transactions(id) ON DELETE CASCADE,
    old_status transaction_status,
    new_status transaction_status NOT NULL,
    changed_by text NOT NULL DEFAULT 'service_role',
    created_at timestamptz NOT NULL DEFAULT now()
);

-- 5. Create Trigger Functions
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION public.log_transaction_status_change()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.transaction_events (transaction_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.transaction_events (transaction_id, old_status, new_status)
        VALUES (NEW.id, NULL, NEW.status);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;


-- 6. Attach Triggers
CREATE TRIGGER on_transactions_update
BEFORE UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER on_transactions_status_change
AFTER INSERT OR UPDATE ON public.transactions
FOR EACH ROW
EXECUTE FUNCTION public.log_transaction_status_change();

-- 7. Enable RLS and Define OPTIMIZED Policies

-- === TRANSACTIONS TABLE ===
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Optimized SELECT policy for transactions
CREATE POLICY "Allow read access to owners and service role"
ON public.transactions FOR SELECT TO authenticated, service_role
USING (
    (user_id = (select auth.uid())) OR ((select auth.role()) = 'service_role')
);

-- Optimized INSERT/UPDATE/DELETE policy for transactions
CREATE POLICY "Allow full modification for service role"
ON public.transactions FOR ALL TO service_role
USING ( (select auth.role()) = 'service_role' )
WITH CHECK ( (select auth.role()) = 'service_role' );

-- === TRANSACTION_EVENTS TABLE ===
ALTER TABLE public.transaction_events ENABLE ROW LEVEL SECURITY;

-- Optimized SELECT policy for transaction_events
CREATE POLICY "Allow read access to event owners and service role"
ON public.transaction_events FOR SELECT TO authenticated, service_role
USING (
    ((select auth.role()) = 'service_role')
    OR EXISTS (
        SELECT 1 FROM public.transactions t
        WHERE t.id = transaction_id AND t.user_id = (select auth.uid())
    )
);

-- Optimized INSERT/UPDATE/DELETE policy for transaction_events
CREATE POLICY "Allow full modification for service role on events"
ON public.transaction_events FOR ALL TO service_role
USING ( (select auth.role()) = 'service_role' )
WITH CHECK ( (select auth.role()) = 'service_role' );