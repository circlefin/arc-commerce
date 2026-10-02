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

CREATE TYPE public.transaction_type AS ENUM (
    'USER',
    'ADMIN',
    'CCTP_APPROVAL',
    'CCTP_BURN',
    'CCTP_MINT'
);

COMMENT ON TYPE public.transaction_type IS 'Classifies transactions by type: USER (credit purchases), ADMIN (standard transfers), CCTP_* (cross-chain transfer steps)';

ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS transaction_type public.transaction_type NOT NULL DEFAULT 'USER',
    ADD COLUMN IF NOT EXISTS source_wallet_id uuid REFERENCES public.admin_wallets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_address text;

ALTER TABLE public.transactions
    ALTER COLUMN user_id DROP NOT NULL,
    ALTER COLUMN credit_amount DROP NOT NULL,
    ALTER COLUMN exchange_rate DROP NOT NULL,
    ALTER COLUMN direction DROP NOT NULL;

ALTER TABLE public.transactions
    ALTER COLUMN tx_hash DROP NOT NULL;

CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON public.transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_source_wallet_id ON public.transactions(source_wallet_id) WHERE source_wallet_id IS NOT NULL;

ALTER TABLE public.transactions
    ADD CONSTRAINT check_user_transaction_fields
        CHECK (
            (transaction_type = 'USER' AND user_id IS NOT NULL AND credit_amount IS NOT NULL AND exchange_rate IS NOT NULL AND direction IS NOT NULL)
            OR (transaction_type != 'USER')
        ),
    ADD CONSTRAINT check_admin_transaction_fields
        CHECK (
            (transaction_type IN ('ADMIN', 'CCTP_APPROVAL', 'CCTP_BURN', 'CCTP_MINT') AND circle_transaction_id IS NOT NULL AND destination_address IS NOT NULL)
            OR (transaction_type = 'USER')
        );

INSERT INTO public.transactions (
    id,
    transaction_type,
    circle_transaction_id,
    source_wallet_id,
    destination_address,
    amount_usdc,
    asset,
    chain,
    status,
    created_at,
    updated_at,
    wallet_id,
    idempotency_key
)
SELECT
    id,
    CASE
        WHEN type = 'STANDARD' THEN 'ADMIN'::transaction_type
        WHEN type = 'CCTP_APPROVAL' THEN 'CCTP_APPROVAL'::transaction_type
        WHEN type = 'CCTP_BURN' THEN 'CCTP_BURN'::transaction_type
        WHEN type = 'CCTP_MINT' THEN 'CCTP_MINT'::transaction_type
    END,
    circle_transaction_id,
    source_wallet_id,
    destination_address,
    amount,
    asset,
    chain,
    CASE
        WHEN status = 'PENDING' THEN 'pending'::transaction_status
        WHEN status = 'CONFIRMED' THEN 'confirmed'::transaction_status
        WHEN status = 'FAILED' THEN 'failed'::transaction_status
    END,
    created_at,
    updated_at,
    destination_address,
    'admin:' || circle_transaction_id
FROM public.admin_transactions
ON CONFLICT (idempotency_key) DO NOTHING;

DROP POLICY IF EXISTS "Allow read access to owners and service role" ON public.transactions;
DROP POLICY IF EXISTS "Allow full modification for service role" ON public.transactions;

CREATE POLICY "Users can read their own transactions"
ON public.transactions FOR SELECT TO authenticated
USING (
    (transaction_type = 'USER' AND user_id = auth.uid())
);

CREATE POLICY "Service role can read all transactions"
ON public.transactions FOR SELECT TO service_role
USING (true);

CREATE POLICY "Service role can modify all transactions"
ON public.transactions FOR ALL TO service_role
USING (true)
WITH CHECK (true);

COMMENT ON COLUMN public.transactions.transaction_type IS 'Type of transaction: USER (credit purchase), ADMIN (standard transfer), CCTP_* (cross-chain steps)';
COMMENT ON COLUMN public.transactions.circle_transaction_id IS 'Circle API transaction ID (for admin transactions)';
COMMENT ON COLUMN public.transactions.source_wallet_id IS 'Source admin wallet (for admin transactions)';
COMMENT ON COLUMN public.transactions.destination_address IS 'Destination address (for admin transactions)';

