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

-- Migration: Remove 'completed' status and standardize on 'complete'
-- This migration removes the 'completed' status from the transaction_status enum
-- and updates any existing transactions using 'completed' to use 'complete' instead

-- Step 1: Update any existing transactions with 'completed' status to 'complete'
UPDATE public.transactions
SET status = 'complete'
WHERE status = 'completed';

-- Step 2: Remove 'completed' from the transaction_status enum
-- We need to create a new enum without 'completed', then swap it in
CREATE TYPE transaction_status_new AS ENUM ('pending', 'confirmed', 'complete', 'failed');

-- Step 3: Drop the default constraint temporarily
ALTER TABLE public.transactions
  ALTER COLUMN status DROP DEFAULT;

-- Step 4: Update all tables using the transaction_status enum
ALTER TABLE public.transactions
  ALTER COLUMN status TYPE transaction_status_new
  USING status::text::transaction_status_new;

ALTER TABLE public.transaction_events
  ALTER COLUMN new_status TYPE transaction_status_new
  USING new_status::text::transaction_status_new;

ALTER TABLE public.transaction_events
  ALTER COLUMN old_status TYPE transaction_status_new
  USING old_status::text::transaction_status_new;

ALTER TABLE public.transaction_webhook_events
  ALTER COLUMN mapped_status TYPE transaction_status_new
  USING mapped_status::text::transaction_status_new;

-- Step 5: Restore the default value for transactions table
ALTER TABLE public.transactions
  ALTER COLUMN status SET DEFAULT 'pending'::transaction_status_new;

-- Step 6: Drop the old enum and rename the new one
DROP TYPE transaction_status CASCADE;
ALTER TYPE transaction_status_new RENAME TO transaction_status;

-- Add a comment to document the change
COMMENT ON TYPE transaction_status IS 'Transaction status enum: pending (initial), confirmed (Circle confirmed), complete (on-chain confirmed), failed';
