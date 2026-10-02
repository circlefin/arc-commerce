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

UPDATE public.transactions
SET status = 'complete'
WHERE status = 'completed';

-- Postgres cannot drop an enum value, so swap in a replacement type.
CREATE TYPE transaction_status_new AS ENUM ('pending', 'confirmed', 'complete', 'failed');

ALTER TABLE public.transactions
  ALTER COLUMN status DROP DEFAULT;

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

ALTER TABLE public.transactions
  ALTER COLUMN status SET DEFAULT 'pending'::transaction_status_new;

DROP TYPE transaction_status CASCADE;
ALTER TYPE transaction_status_new RENAME TO transaction_status;

COMMENT ON TYPE transaction_status IS 'Transaction status enum: pending (initial), confirmed (Circle confirmed), complete (on-chain confirmed), failed';
