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

-- Migration: Clean up duplicate RLS policies on transactions table
-- The previous migration added "Authenticated users can read all transactions"
-- but didn't remove the older "Users can read their own transactions" policy
-- This causes confusion and potential issues with realtime subscriptions

-- Drop the old restrictive policy
DROP POLICY IF EXISTS "Users can read their own transactions" ON public.transactions;

-- Keep the broader policy that allows all authenticated users to read all transactions
-- (This is safe because only admin users can authenticate in this application)
