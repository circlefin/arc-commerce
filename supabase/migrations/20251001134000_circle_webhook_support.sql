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

-- Migration: Circle Webhook Support
-- Purpose:
-- 1. Add circle_transaction_id to transactions for mapping Circle events
-- 2. Create transaction_webhook_events table to persist raw Circle webhook payloads
-- 3. RLS policies for new table
-- 4. Indexes & constraints for idempotency and fast lookup

-- ================================
-- 1. Schema Changes: transactions
-- ================================

-- Add nullable circle_transaction_id (some events may arrive before record exists)
ALTER TABLE public.transactions
ADD COLUMN circle_transaction_id text;

-- Unique index (only one internal transaction per Circle transaction id)
CREATE UNIQUE INDEX IF NOT EXISTS transactions_circle_transaction_id_key
ON public.transactions(circle_transaction_id)
WHERE circle_transaction_id IS NOT NULL;

-- Optional lookup index (not strictly needed because unique above covers searches)
-- CREATE INDEX IF NOT EXISTS idx_transactions_circle_transaction_id
-- ON public.transactions(circle_transaction_id)
-- WHERE circle_transaction_id IS NOT NULL;

-- =======================================
-- 2. New Table: transaction_webhook_events
-- =======================================
-- Stores every raw Circle webhook notification for audit / replay.
-- We keep circle_transaction_id and circle_event_id (if provided) for idempotency.
-- transaction_id is nullable because a webhook could arrive before app-level
-- transaction creation (we will attempt to backfill linkage in code if found later).

CREATE TABLE public.transaction_webhook_events (
    id bigserial PRIMARY KEY,
    circle_event_id text,                        -- (Not all Circle webhooks may have a distinct event id; if missing we fallback to hash)
    circle_transaction_id text,
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    mapped_status transaction_status,            -- Derived internal status (pending/confirmed/failed) if state was mappable
    raw_payload jsonb NOT NULL,                  -- Entire webhook body
    signature_valid boolean NOT NULL DEFAULT false,
    received_at timestamptz NOT NULL DEFAULT now(),
    dedupe_hash text NOT NULL,                   -- SHA256(body) or other deterministic hash for idempotency when event id missing
    UNIQUE (circle_event_id),
    UNIQUE (dedupe_hash)
);

-- Useful indexes
CREATE INDEX idx_twe_circle_transaction_id
ON public.transaction_webhook_events(circle_transaction_id)
WHERE circle_transaction_id IS NOT NULL;

CREATE INDEX idx_twe_transaction_id
ON public.transaction_webhook_events(transaction_id)
WHERE transaction_id IS NOT NULL;

CREATE INDEX idx_twe_received_at
ON public.transaction_webhook_events(received_at);

-- =======================================
-- 3. RLS Policies
-- =======================================
ALTER TABLE public.transaction_webhook_events ENABLE ROW LEVEL SECURITY;

-- Read access: authenticated users can read events tied to their transactions.
-- Service role can read all.
CREATE POLICY "Allow read webhook events for owners and service role"
ON public.transaction_webhook_events
FOR SELECT
TO authenticated, service_role
USING (
    ( (select auth.role()) = 'service_role' )
    OR EXISTS (
        SELECT 1
        FROM public.transactions t
        WHERE t.id = transaction_webhook_events.transaction_id
          AND t.user_id = (select auth.uid())
    )
);

-- Only service role can insert/update/delete
CREATE POLICY "Allow full modification for service role on webhook events"
ON public.transaction_webhook_events
FOR ALL
TO service_role
USING ( (select auth.role()) = 'service_role' )
WITH CHECK ( (select auth.role()) = 'service_role' );

-- =======================================
-- 4. Notes
-- =======================================
-- Application logic:
-- - On receiving Circle webhook:
--   * Verify signature
--   * Compute dedupe_hash = sha256(raw JSON string)
--   * Attempt insert into transaction_webhook_events (ignore conflict on dedupe_hash / circle_event_id)
--   * Map Circle state (e.g. PENDING->pending, COMPLETE/CONFIRMED->confirmed, FAILED->failed)
--   * If circle_transaction_id present, locate matching transactions.circle_transaction_id OR (chain, tx_hash) if you store mapping in metadata
--   * Update transactions.status only if changed (triggers will log status change)
--   * After update, optionally backfill transaction_id in transaction_webhook_events row where it was NULL
--
-- - Idempotency:
--   UNIQUE(circle_event_id) handles normal path; fallback UNIQUE(dedupe_hash) prevents duplicates when event id absent.
--
-- Rollback considerations:
--   * To revert: drop new table, indexes, column (ensure no dependencies).
