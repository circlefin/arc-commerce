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

-- Add a column to link a mint transaction back to its parent burn transaction.
ALTER TABLE public.admin_transactions
  ADD COLUMN cctp_burn_tx_id UUID REFERENCES public.admin_transactions(id) ON DELETE SET NULL;

-- Create a unique index on this new column.
-- This is the core of the fix: it makes it impossible for more than one row
-- to ever reference the same parent burn transaction.
CREATE UNIQUE INDEX one_mint_per_burn_idx ON public.admin_transactions (cctp_burn_tx_id);