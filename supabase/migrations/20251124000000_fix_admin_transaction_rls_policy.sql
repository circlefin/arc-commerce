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

-- Migration: Fix RLS policy to allow authenticated users to read all transactions
-- This allows the admin dashboard to receive realtime updates for admin transactions
-- Note: Since only admin users can log in (enforced at application level),
-- it's safe to allow all authenticated users to read all transactions

-- Create a policy that allows any authenticated user to read all transactions
CREATE POLICY "Authenticated users can read all transactions"
ON public.transactions FOR SELECT TO authenticated
USING (true);
