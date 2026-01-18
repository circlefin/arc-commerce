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

-- Create the 'credits' table
CREATE TABLE public.credits (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
    credits numeric(18, 6) NOT NULL DEFAULT 0 CHECK (credits >= 0)
);
COMMENT ON TABLE public.credits IS 'Stores the credit balance for each user.';


-- Create a trigger function to handle new user creation (with admin exception)
CREATE OR REPLACE FUNCTION public.handle_new_user_credits()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Only create a credits row if the new user's email is NOT the admin's.
  IF new.email <> 'admin@admin.com' THEN
    INSERT INTO public.credits (user_id)
    VALUES (new.id);
  END IF;
  RETURN new;
END;
$$;
COMMENT ON FUNCTION public.handle_new_user_credits() IS 'Creates a credits row for a new user, unless they are the admin user.';


-- Create the trigger on the 'auth.users' table
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user_credits();


-- Create the RPC function to atomically increment credits (with upsert and admin exception)
CREATE OR REPLACE FUNCTION public.increment_credits(
  user_id_to_update uuid,
  amount_to_add numeric
)
RETURNS numeric
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  new_credits_balance numeric;
  user_email text;
BEGIN
  SELECT email INTO user_email FROM users WHERE id = user_id_to_update;
  IF user_email = 'admin@admin.com' THEN
    RETURN 0;
  ELSE
    INSERT INTO public.credits (user_id, credits)
    VALUES (user_id_to_update, amount_to_add)
    ON CONFLICT (user_id)
    DO UPDATE SET
      credits = credits.credits + amount_to_add
    RETURNING credits INTO new_credits_balance;
    RETURN new_credits_balance;
  END IF;
END;
$$;
COMMENT ON FUNCTION public.increment_credits(uuid, numeric) IS 'Atomically increments credits for a user. Creates a record if none exists. Returns 0 and does nothing for the admin user (admin@admin.com).';


-- Set up Row-Level Security (RLS) and Permissions
ALTER TABLE public.credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own credits"
ON public.credits FOR SELECT
USING ( auth.uid() = user_id );

CREATE POLICY "Users can insert their own credit record"
ON public.credits FOR INSERT
WITH CHECK ( auth.uid() = user_id );

GRANT EXECUTE ON FUNCTION public.increment_credits(uuid, numeric) TO service_role;


-- Enable Supabase Realtime on the 'credits' table
-- This adds the table to the 'supabase_realtime' publication.
ALTER PUBLICATION supabase_realtime ADD TABLE public.credits;