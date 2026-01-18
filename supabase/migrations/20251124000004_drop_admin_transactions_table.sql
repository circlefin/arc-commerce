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

-- Migration: Drop the deprecated admin_transactions table
-- The admin_transactions table has been replaced by the unified transactions table
-- with transaction_type column to distinguish between different transaction types
-- This was done in migration 20251114100000_unify_transaction_tables.sql

-- Drop the admin_transactions table
DROP TABLE IF EXISTS public.admin_transactions CASCADE;

-- Add a comment to document why it was removed
COMMENT ON TABLE public.transactions IS 'Unified transactions table containing USER (credit purchases), ADMIN (standard transfers), and CCTP_* (cross-chain transfer steps) transactions';
