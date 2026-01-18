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

-- This table will store a log of all administrative fund transfers
-- initiated from platform-controlled Circle wallets.

-- Step 1: Create a custom ENUM type for the transaction status.
CREATE TYPE admin_transaction_status AS ENUM ('PENDING', 'CONFIRMED', 'FAILED');

-- Step 2: Create the new `admin_transactions` table.
CREATE TABLE public.admin_transactions (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    circle_transaction_id text NOT NULL UNIQUE,
    source_wallet_id uuid NOT NULL REFERENCES public.admin_wallets(id) ON DELETE SET NULL,
    destination_address text NOT NULL,
    amount numeric(18, 6) NOT NULL,
    asset text NOT NULL DEFAULT 'USDC',
    chain text NOT NULL,
    status admin_transaction_status NOT NULL DEFAULT 'PENDING',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments for clarity
COMMENT ON TABLE public.admin_transactions IS 'Stores a log of administrative fund transfers from Circle wallets.';
COMMENT ON COLUMN public.admin_transactions.circle_transaction_id IS 'The unique transaction identifier from the Circle API.';
COMMENT ON COLUMN public.admin_transactions.source_wallet_id IS 'The internal ID of the source admin wallet.';

-- Step 3: Enable Row Level Security (RLS).
ALTER TABLE public.admin_transactions ENABLE ROW LEVEL SECURITY;

-- Create a policy that restricts all access to the trusted `service_role` only.
CREATE POLICY "Allow full access for service role"
ON public.admin_transactions
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Step 4: Create the trigger for the `updated_at` timestamp.
CREATE TRIGGER on_admin_transactions_update
BEFORE UPDATE ON public.admin_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();