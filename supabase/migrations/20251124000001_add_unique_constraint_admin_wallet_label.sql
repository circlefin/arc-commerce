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

-- Migration: Add unique constraint to admin_wallets label column
-- This prevents duplicate admin wallets from being created during initialization race conditions

-- Add a unique constraint on the label column to prevent duplicate "Primary wallet" entries
CREATE UNIQUE INDEX IF NOT EXISTS idx_admin_wallets_label_unique
ON public.admin_wallets(label)
WHERE label = 'Primary wallet';

COMMENT ON INDEX idx_admin_wallets_label_unique IS 'Ensures only one "Primary wallet" can exist, preventing race condition duplicates during initialization';
