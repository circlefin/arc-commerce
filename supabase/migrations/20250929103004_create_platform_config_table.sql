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

-- Migration: Create Platform Configuration Table
-- This table will store key-value pairs for platform-wide settings,
-- such as the ID of the primary Circle merchant wallet.

CREATE TABLE public.platform_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.platform_config ENABLE ROW LEVEL SECURITY;

-- Allow read access for all users (e.g., if you ever need to expose a public key)
CREATE POLICY "Allow public read access"
ON public.platform_config FOR SELECT
USING (true);

-- Restrict write access to the service role only
CREATE POLICY "Allow full access for service role"
ON public.platform_config FOR ALL
USING (auth.role() = 'service_role')
WITH CHECK (auth.role() = 'service_role');

-- Create the trigger for the updated_at timestamp
CREATE TRIGGER on_platform_config_update
BEFORE UPDATE ON public.platform_config
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();