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

-- Migration to fix transaction table inconsistencies
-- This migration addresses:
-- 1. Standardizes chain format to use numeric chain IDs instead of string names
-- 2. Fixes wallet_id semantics for ADMIN transactions (should be source, not destination)
-- 3. Updates existing data to match the corrected schema

-- First, update existing ADMIN transactions to use numeric chain IDs
-- ARC-TESTNET should be 5042002
UPDATE transactions
SET chain = '5042002'
WHERE chain = 'ARC-TESTNET' AND transaction_type IN ('ADMIN', 'CCTP_APPROVAL', 'CCTP_BURN', 'CCTP_MINT');

-- Fix wallet_id for ADMIN transactions: it should represent the source wallet address, not destination
-- For ADMIN transactions, wallet_id currently holds the destination address
-- We need to look up the actual source wallet address and swap them
UPDATE transactions t
SET
  wallet_id = aw.address,
  -- destination_address already has the correct value
  metadata = jsonb_set(
    COALESCE(t.metadata, '{}'::jsonb),
    '{migration_note}',
    '"Fixed wallet_id to represent source wallet address"'::jsonb
  )
FROM admin_wallets aw
WHERE t.transaction_type IN ('ADMIN', 'CCTP_APPROVAL', 'CCTP_BURN', 'CCTP_MINT')
  AND t.source_wallet_id = aw.id
  AND t.wallet_id != aw.address;

-- Add a comment to clarify the wallet_id column semantics
COMMENT ON COLUMN transactions.wallet_id IS 'For USER transactions: user wallet address that sent funds. For ADMIN transactions: source admin wallet address.';
COMMENT ON COLUMN transactions.destination_address IS 'For USER transactions: admin wallet that received funds. For ADMIN transactions: destination address receiving funds.';
