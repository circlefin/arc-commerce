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

-- This migration renames the 'COMPLETED' value to 'COMPLETE' in the
-- 'admin_transaction_status' enum type to align with Circle's v2 API states.

DO $$
BEGIN
  -- First, check if the 'COMPLETED' value actually exists in the enum.
  -- This makes the migration safe to re-run without causing an error.
  IF EXISTS (
    SELECT 1
    FROM pg_enum
    WHERE enumlabel = 'COMPLETED'
      AND enumtypid = 'public.admin_transaction_status'::regtype
  ) THEN
    -- If it exists, execute the rename command.
    ALTER TYPE public.admin_transaction_status RENAME VALUE 'COMPLETED' TO 'COMPLETE';
  END IF;
END $$;