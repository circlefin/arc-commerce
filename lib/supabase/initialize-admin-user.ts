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

import { createClient } from "@supabase/supabase-js";
import { SupabaseClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SECRET_KEY;

let adminAuthClient: SupabaseClient | null = null;

if (supabaseUrl && supabaseServiceRoleKey) {
  adminAuthClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
} else {
  console.warn(
    "Supabase URL or Service Role Key is not set. Admin user creation will be skipped."
  );
}

const createAdminUserIfNotExists = async () => {
  if (!adminAuthClient) {
    return;
  }

  const adminEmail = "admin@admin.com";
  const adminPassword = "123456";

  const { data: adminUserExists, error: rpcError } = await adminAuthClient.rpc(
    "check_user_exists",
    { user_email: adminEmail }
  );

  if (rpcError) {
    const errorMessage = rpcError.message || "Unknown error";
    const errorCode = rpcError.code || "Unknown code";
    const errorDetails = rpcError.details || "";

    if (
      errorMessage.includes("invalid response") ||
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ENOTFOUND")
    ) {
      console.warn(
        "⚠️  Admin user initialization skipped: Unable to connect to Supabase.",
        "This may be due to network issues or Supabase service being unavailable.",
        "The app will continue to run, but admin user initialization will be retried on next server restart."
      );
    } else {
      console.error(
        "❌ Error checking for admin user:",
        `${errorMessage} (Code: ${errorCode}${errorDetails ? `, Details: ${errorDetails}` : ""})`
      );
    }
    return;
  }

  if (adminUserExists) {
    console.log(
      `Admin user with email ${adminEmail} already exists. Skipping creation.`
    );
    return;
  }

  console.log(
    `Admin user not found. Creating user with email ${adminEmail}...`
  );
  const { data, error: createError } =
    await adminAuthClient.auth.admin.createUser({
      email: adminEmail,
      password: adminPassword,
      email_confirm: true,
    });

  if (createError) {
    console.error("Error creating admin user:", createError.message);
    return;
  }

  if (data.user) {
    console.log(`Admin user with email ${adminEmail} created successfully.`);
  }
};

createAdminUserIfNotExists();