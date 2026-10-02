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

DROP TABLE IF EXISTS public.platform_config CASCADE;

CREATE TYPE admin_wallet_status AS ENUM ('ENABLED', 'DISABLED', 'ARCHIVED');

CREATE TABLE public.admin_wallets (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    circle_wallet_id text NOT NULL UNIQUE,
    label text NOT NULL,
    status admin_wallet_status NOT NULL DEFAULT 'ENABLED',
    chain text DEFAULT NULL,
    supported_assets text[] DEFAULT NULL,
    address text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.admin_wallets IS 'Stores details for administrative, platform-controlled wallets.';
COMMENT ON COLUMN public.admin_wallets.circle_wallet_id IS 'The unique identifier for the wallet from the Circle API.';
COMMENT ON COLUMN public.admin_wallets.label IS 'A human-readable name for the wallet (e.g., "Primary Merchant Wallet").';
COMMENT ON COLUMN public.admin_wallets.status IS 'The operational status of the wallet.';

ALTER TABLE public.admin_wallets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow full access for service role"
ON public.admin_wallets
FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

CREATE TRIGGER on_admin_wallets_update
BEFORE UPDATE ON public.admin_wallets
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();