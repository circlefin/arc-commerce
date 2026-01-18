/**
 * Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

// This import triggers your admin user creation script on server startup.
import "@/lib/supabase/initialize-admin-user";

// Import the new Circle platform operator wallet creation script
import "@/lib/circle/initialize-admin-wallet";

export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_OR_ANON_KEY!,
    {
      // This is the corrected cookies object that resolves the deprecation warning.
      cookies: {
        // The new `getAll` method should return all cookies.
        // The `cookies()` function from `next/headers` provides a `getAll()` method that
        // returns cookies in the exact format needed: an array of { name, value }.
        getAll() {
          return cookieStore.getAll();
        },
        // The new `setAll` method receives an array of cookies to set.
        // We need to loop through this array and call `cookieStore.set()` for each one.
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    }
  );
}
