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

-- Drop the old, brittle policy that was causing the silent failure.
DROP POLICY IF EXISTS "Allow full access for service role" ON public.admin_transactions;

-- Create a new, robust policy for the service_role.
-- This policy states that if the user's role is 'service_role', they can
-- perform ALL actions on ANY rows. This is the standard way to grant
-- full backend access while keeping RLS enabled for other potential roles.
CREATE POLICY "Allow full access to service role"
ON public.admin_transactions
FOR ALL
TO service_role -- This is a shorthand and cleaner way to specify the target role
USING (true)
WITH CHECK (true);

-- IMPORTANT: Ensure RLS is still enabled on the table.
-- This command will do nothing if it's already enabled, but it's good practice to be explicit.
ALTER TABLE public.admin_transactions ENABLE ROW LEVEL SECURITY;