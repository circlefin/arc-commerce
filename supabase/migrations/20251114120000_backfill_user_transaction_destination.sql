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

-- Migration: Backfill destination_address for existing USER transactions
-- All USER transactions are sent to the oldest admin wallet (as per /api/destination-wallet logic)

-- Update all USER transactions that don't have a destination_address set
-- Set it to the address of the oldest admin wallet
UPDATE public.transactions
SET destination_address = (
    SELECT address
    FROM public.admin_wallets
    ORDER BY created_at ASC
    LIMIT 1
)
WHERE transaction_type = 'USER'
  AND destination_address IS NULL;

-- Add a comment explaining this backfill
COMMENT ON COLUMN public.transactions.destination_address IS 'Destination address (for admin transactions and user top-ups). USER transactions without this field were backfilled to use the oldest admin wallet.';
