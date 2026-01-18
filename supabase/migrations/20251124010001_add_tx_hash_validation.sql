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

-- Migration to add validation for tx_hash on completed transactions
-- Note: We don't enforce NOT NULL because tx_hash may not be available immediately
-- when a transaction is created. However, we add a helpful constraint to remind
-- developers that completed/confirmed transactions should have a tx_hash.

-- Add a check constraint that warns if a transaction is complete/confirmed without a tx_hash
-- This is implemented as a comment-only approach since Circle webhooks may not always
-- provide tx_hash immediately, and we don't want to block status updates.

COMMENT ON COLUMN transactions.tx_hash IS 'Transaction hash on blockchain. Should be populated for all complete/confirmed transactions.';

-- Create an index to help identify transactions that are complete but missing tx_hash
CREATE INDEX IF NOT EXISTS idx_transactions_missing_tx_hash
ON transactions(status)
WHERE tx_hash IS NULL AND status IN ('complete', 'confirmed');
