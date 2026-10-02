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

ALTER TABLE public.transactions
ADD COLUMN circle_transaction_id text;

CREATE UNIQUE INDEX IF NOT EXISTS transactions_circle_transaction_id_key
ON public.transactions(circle_transaction_id)
WHERE circle_transaction_id IS NOT NULL;

-- Raw Circle webhook payloads, kept for audit and idempotent replay.
CREATE TABLE public.transaction_webhook_events (
    id bigserial PRIMARY KEY,
    circle_event_id text,
    circle_transaction_id text,
    transaction_id uuid REFERENCES public.transactions(id) ON DELETE SET NULL,
    mapped_status transaction_status,
    raw_payload jsonb NOT NULL,
    signature_valid boolean NOT NULL DEFAULT false,
    received_at timestamptz NOT NULL DEFAULT now(),
    dedupe_hash text NOT NULL,
    UNIQUE (circle_event_id),
    UNIQUE (dedupe_hash)
);

CREATE INDEX idx_twe_circle_transaction_id
ON public.transaction_webhook_events(circle_transaction_id)
WHERE circle_transaction_id IS NOT NULL;

CREATE INDEX idx_twe_transaction_id
ON public.transaction_webhook_events(transaction_id)
WHERE transaction_id IS NOT NULL;

CREATE INDEX idx_twe_received_at
ON public.transaction_webhook_events(received_at);

ALTER TABLE public.transaction_webhook_events ENABLE ROW LEVEL SECURITY;

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

CREATE POLICY "Allow full modification for service role on webhook events"
ON public.transaction_webhook_events
FOR ALL
TO service_role
USING ( (select auth.role()) = 'service_role' )
WITH CHECK ( (select auth.role()) = 'service_role' );

