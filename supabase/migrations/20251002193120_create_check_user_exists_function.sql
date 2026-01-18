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

-- Migration: Create a function to check for user existence by email.
-- This is a secure and highly performant way to check if a user exists
-- without exposing user data or relying on slow, paginated list methods.

CREATE OR REPLACE FUNCTION public.check_user_exists(user_email TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
-- SECURITY DEFINER is crucial. It allows this function to run with the
-- permissions of its creator (the admin), giving it temporary, secure
-- access to the `auth.users` table.
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
    -- Perform a direct, indexed query on the auth.users table.
    -- This is extremely fast and scalable.
    RETURN EXISTS (
        SELECT 1
        FROM auth.users
        WHERE email = user_email
    );
END;
$$;

-- Grant execute permission to the service_role so our server-side
-- script can call this function.
GRANT EXECUTE ON FUNCTION public.check_user_exists(TEXT) TO service_role;