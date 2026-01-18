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

-- This script idempotently ensures that the 'admin_transactions' table
-- is configured to broadcast INSERT, UPDATE, and DELETE events via Realtime.

DO $$
BEGIN
  -- First, check if the table is already a member of the publication.
  IF EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND tablename = 'admin_transactions'
  ) THEN
    -- If it is, remove it. This is necessary to reset its publication properties.
    ALTER PUBLICATION supabase_realtime DROP TABLE public.admin_transactions;
  END IF;
END $$;

-- Now, add the table back to the publication. This applies the publication's
-- default rules, which include broadcasting INSERT, UPDATE, and DELETE events.
ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_transactions;