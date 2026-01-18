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

-- This migration addresses the "Function Search Path Mutable" security warning
-- by explicitly setting a secure, empty search_path for our trigger functions.
-- This prevents potential privilege escalation attacks by forcing all object
-- references within the functions to be schema-qualified.

-- Harden the handle_updated_at function
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
-- This is the critical security fix.
-- It isolates the function from the caller's search_path.
SET search_path = ''
AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

-- Harden the log_transaction_status_change function
CREATE OR REPLACE FUNCTION public.log_transaction_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
-- This is the critical security fix.
-- It isolates the function from the caller's search_path.
SET search_path = ''
AS $$
BEGIN
    -- We must now use fully qualified names because the search_path is empty.
    -- e.g., public.transaction_events instead of just transaction_events.
    IF TG_OP = 'UPDATE' AND OLD.status IS DISTINCT FROM NEW.status THEN
        INSERT INTO public.transaction_events (transaction_id, old_status, new_status)
        VALUES (NEW.id, OLD.status, NEW.status);
    ELSIF TG_OP = 'INSERT' THEN
        INSERT INTO public.transaction_events (transaction_id, old_status, new_status)
        VALUES (NEW.id, NULL, NEW.status);
    END IF;
    RETURN NEW;
END;
$$;