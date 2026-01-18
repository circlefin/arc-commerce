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

-- Migration: Unify transactions and admin_transactions tables
-- This consolidates both user credit purchases and admin transfers into a single table
-- with a transaction_type column to differentiate between transaction types.

-- Step 1: Create transaction_type enum
CREATE TYPE public.transaction_type AS ENUM (
    'USER',              -- Regular user credit purchase
    'ADMIN',             -- Admin standard transfer (same chain)
    'CCTP_APPROVAL',     -- CCTP step 1: Approval
    'CCTP_BURN',         -- CCTP step 2: Burn
    'CCTP_MINT'          -- CCTP step 3: Mint (via OpenZeppelin relayer)
);

COMMENT ON TYPE public.transaction_type IS 'Classifies transactions by type: USER (credit purchases), ADMIN (standard transfers), CCTP_* (cross-chain transfer steps)';

-- Step 2: Add new columns to transactions table
-- Note: circle_transaction_id already exists from migration 20251001134000
ALTER TABLE public.transactions
    ADD COLUMN IF NOT EXISTS transaction_type public.transaction_type NOT NULL DEFAULT 'USER',
    ADD COLUMN IF NOT EXISTS source_wallet_id uuid REFERENCES public.admin_wallets(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS destination_address text;

-- Step 3: Make user-specific columns nullable (for admin transactions)
ALTER TABLE public.transactions
    ALTER COLUMN user_id DROP NOT NULL,
    ALTER COLUMN credit_amount DROP NOT NULL,
    ALTER COLUMN exchange_rate DROP NOT NULL,
    ALTER COLUMN direction DROP NOT NULL;

-- Step 4: Make tx_hash nullable (admin CCTP transactions may not have immediate tx_hash)
ALTER TABLE public.transactions
    ALTER COLUMN tx_hash DROP NOT NULL;

-- Step 5: Add indexes for new columns
CREATE INDEX IF NOT EXISTS idx_transactions_transaction_type ON public.transactions(transaction_type);
-- Circle transaction ID index already exists from previous migration
-- CREATE INDEX IF NOT EXISTS idx_transactions_circle_transaction_id ON public.transactions(circle_transaction_id) WHERE circle_transaction_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_transactions_source_wallet_id ON public.transactions(source_wallet_id) WHERE source_wallet_id IS NOT NULL;

-- Step 6: Unique constraint for circle_transaction_id already exists from migration 20251001134000
-- CREATE UNIQUE INDEX IF NOT EXISTS transactions_circle_transaction_id_key ON public.transactions(circle_transaction_id) WHERE circle_transaction_id IS NOT NULL;

-- Step 7: Add check constraints to ensure data integrity
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

-- Step 8: Migrate data from admin_transactions to transactions
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
    -- Set defaults for required user fields (they won't be used for admin transactions)
    idempotency_key
)
SELECT
    id,
    -- Map admin_transaction_type to transaction_type
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
    -- Map admin_transaction_status to transaction_status
    CASE
        WHEN status = 'PENDING' THEN 'pending'::transaction_status
        WHEN status = 'CONFIRMED' THEN 'confirmed'::transaction_status
        WHEN status = 'FAILED' THEN 'failed'::transaction_status
    END,
    created_at,
    updated_at,
    -- Use destination_address as wallet_id for admin transactions (for compatibility)
    destination_address,
    -- Generate idempotency_key from circle_transaction_id
    'admin:' || circle_transaction_id
FROM public.admin_transactions
ON CONFLICT (idempotency_key) DO NOTHING;

-- Step 9: Update RLS policies to handle both user and admin transactions
-- Drop existing policies
DROP POLICY IF EXISTS "Allow read access to owners and service role" ON public.transactions;
DROP POLICY IF EXISTS "Allow full modification for service role" ON public.transactions;

-- Create new policies
-- Users can read their own USER transactions
CREATE POLICY "Users can read their own transactions"
ON public.transactions FOR SELECT TO authenticated
USING (
    (transaction_type = 'USER' AND user_id = auth.uid())
);

-- Service role can read all transactions
CREATE POLICY "Service role can read all transactions"
ON public.transactions FOR SELECT TO service_role
USING (true);

-- Service role can perform all operations
CREATE POLICY "Service role can modify all transactions"
ON public.transactions FOR ALL TO service_role
USING (true)
WITH CHECK (true);

-- Step 10: Add comments for documentation
COMMENT ON COLUMN public.transactions.transaction_type IS 'Type of transaction: USER (credit purchase), ADMIN (standard transfer), CCTP_* (cross-chain steps)';
COMMENT ON COLUMN public.transactions.circle_transaction_id IS 'Circle API transaction ID (for admin transactions)';
COMMENT ON COLUMN public.transactions.source_wallet_id IS 'Source admin wallet (for admin transactions)';
COMMENT ON COLUMN public.transactions.destination_address IS 'Destination address (for admin transactions)';

-- Note: We keep admin_transactions table for now as a backup.
-- In a future migration, we can drop it after confirming everything works.
-- For now, we'll just disable realtime updates on it:
-- ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_transactions;
