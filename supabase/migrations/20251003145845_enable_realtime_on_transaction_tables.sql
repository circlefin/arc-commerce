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

-- Migration: Enable Realtime on Transaction Tables
-- This script enables the Supabase Realtime feature for the `admin_transactions`,
-- `transactions`, and `transaction_events` tables. This will allow clients
-- to subscribe to database changes (INSERT, UPDATE, DELETE) on these tables.

-- Step 1: Add the tables to the `supabase_realtime` publication.
-- This tells PostgreSQL to send changes from these tables to the Realtime broadcasting service.

ALTER PUBLICATION supabase_realtime ADD TABLE public.admin_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transaction_events;


-- Step 2: Set the REPLICA IDENTITY for each table to FULL.
-- This ensures that when an UPDATE or DELETE event occurs, the broadcasted
-- message contains the complete data of the old row, which is essential for
-- building responsive, real-time user interfaces.

ALTER TABLE public.admin_transactions REPLICA IDENTITY FULL;
ALTER TABLE public.transactions REPLICA IDENTITY FULL;
ALTER TABLE public.transaction_events REPLICA IDENTITY FULL;