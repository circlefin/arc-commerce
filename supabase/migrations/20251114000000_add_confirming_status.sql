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

-- Add 'completed' status to transaction_status enum
-- This status indicates the transaction has been confirmed on-chain by MetaMask
-- but hasn't been processed by Circle's webhook yet

ALTER TYPE transaction_status ADD VALUE IF NOT EXISTS 'completed' BEFORE 'confirmed';

-- Add comment explaining the new status
COMMENT ON TYPE transaction_status IS 'Transaction status: pending (submitted), completed (on-chain confirmed by wallet), confirmed (verified by Circle), complete (fully processed), failed (transaction failed)';
