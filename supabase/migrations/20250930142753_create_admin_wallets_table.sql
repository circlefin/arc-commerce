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

-- Migration: Drop platform_config and create admin_wallets
-- This migration performs two main actions in a single transaction:
-- 1. It completely removes the now-obsolete `public.platform_config` table.
-- 2. It creates a new, structured `public.admin_wallets` table to store details
--    for platform-controlled administrative wallets.

-- Step 1: Drop the old `platform_config` table.
-- The `CASCADE` option ensures all dependent objects like RLS policies and triggers are also removed.
DROP TABLE IF EXISTS public.platform_config CASCADE;


-- Step 2: Create a custom ENUM type for the wallet status.
-- This ensures data integrity for the `status` column.
CREATE TYPE admin_wallet_status AS ENUM ('ENABLED', 'DISABLED', 'ARCHIVED');


-- Step 3: Create the new `admin_wallets` table.
CREATE TABLE public.admin_wallets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    circle_wallet_id text NOT NULL UNIQUE,
    label text NOT NULL,
    status admin_wallet_status NOT NULL DEFAULT 'ENABLED',
    chain text DEFAULT NULL,
    supported_assets text[] DEFAULT NULL, -- Using a text array for future flexibility
    address text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

-- Add comments for clarity and maintainability
COMMENT ON TABLE public.admin_wallets IS 'Stores details for administrative, platform-controlled wallets.';
COMMENT ON COLUMN public.admin_wallets.circle_wallet_id IS 'The unique identifier for the wallet from the Circle API.';
COMMENT ON COLUMN public.admin_wallets.label IS 'A human-readable name for the wallet (e.g., "Primary Merchant Wallet").';
COMMENT ON COLUMN public.admin_wallets.status IS 'The operational status of the wallet.';


-- Step 4: Enable Row Level Security (RLS) for the new table.
-- This is a critical security step to protect administrative data.
ALTER TABLE public.admin_wallets ENABLE ROW LEVEL SECURITY;

-- Create a policy that restricts all access to the trusted `service_role` only.
-- Regular users and anonymous users will not be able to read or write to this table.
CREATE POLICY "Allow full access for service role"
ON public.admin_wallets
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');


-- Step 5: Create the trigger to automatically update the `updated_at` timestamp.
-- This assumes the `handle_updated_at()` function already exists from a previous migration.
CREATE TRIGGER on_admin_wallets_update
BEFORE UPDATE ON public.admin_wallets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();