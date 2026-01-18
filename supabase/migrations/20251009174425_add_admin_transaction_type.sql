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

-- This migration introduces a new ENUM type to classify transactions
-- and adds a 'type' column to the admin_transactions table to use it.

-- Step 1: Create the new ENUM type for the transaction type.
-- This defines the allowed values for the new 'type' column.
CREATE TYPE public.admin_transaction_type AS ENUM (
    'STANDARD',
    'CCTP_APPROVAL',
    'CCTP_BURN',
    'CCTP_MINT'
);

-- Add a comment for clarity on the new type.
COMMENT ON TYPE public.admin_transaction_type IS 'Defines the types of administrative transactions, distinguishing between standard transfers and multi-step CCTP operations.';


-- Step 2: Alter the existing `admin_transactions` table to add the new column.
ALTER TABLE public.admin_transactions
ADD COLUMN type public.admin_transaction_type NOT NULL DEFAULT 'STANDARD';

-- Add a comment to the new column for future reference.
COMMENT ON COLUMN public.admin_transactions.type IS 'The type of the transaction (e.g., STANDARD, CCTP_APPROVAL, CCTP_BURN, CCTP_MINT).';