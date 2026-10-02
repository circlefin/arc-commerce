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
import { Database } from "@/types/supabase";
import { createWalletSetWithWallet } from "@/lib/circle/wallets";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SECRET_KEY;

let isInitialized = false;

const runPlatformInitialization = async () => {
  if (isInitialized) {
    return;
  }

  console.log("Running platform initialization check...");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      "Supabase URL or Service Role Key is not set. Initialization cannot proceed."
    );

    isInitialized = true;
    return;
  }

  const supabaseAdminClient = createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey
  );

  const ADMIN_WALLET_LABEL = "Primary wallet";

  try {
    const { data: existingWallet, error: fetchError } = await supabaseAdminClient
      .from("admin_wallets")
      .select("circle_wallet_id")
      .eq("label", ADMIN_WALLET_LABEL)
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      const errorMessage = fetchError.message || "Unknown error";
      const errorCode = fetchError.code || "Unknown code";
      const errorDetails = fetchError.details || "";
      throw new Error(
        `Supabase fetch error: ${errorMessage} (Code: ${errorCode}${errorDetails ? `, Details: ${errorDetails}` : ""})`
      );
    }

    if (existingWallet) {
      console.log(
        `Platform admin wallet already exists. ID: ${existingWallet.circle_wallet_id}. Initialization complete.`
      );
      isInitialized = true;
      return;
    }

    // 3. If not in DB, create it directly through the Circle SDK.
    console.log("No platform admin wallet found. Creating a new one...");

    const newWallet = await createWalletSetWithWallet("platform-operator");

    const { error: insertError } = await supabaseAdminClient
      .from("admin_wallets")
      .insert({
        circle_wallet_id: newWallet.id,
        label: ADMIN_WALLET_LABEL,
        address: newWallet.address,
        chain: "ARC-TESTNET",
      });

    if (insertError) {
      if (insertError.code === "23505") {
        console.log("Platform admin wallet was created by another process. Initialization complete.");
        return;
      }
      throw new Error(
        `Failed to save new admin wallet to Supabase: ${insertError.message}`
      );
    }

    console.log(
      `Successfully created and saved new admin wallet. ID: ${newWallet.id}`
    );
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorStack = error instanceof Error ? error.stack : undefined;

    if (
      errorMessage.includes("invalid response") ||
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("ECONNREFUSED") ||
      errorMessage.includes("ENOTFOUND")
    ) {
      console.warn(
        "⚠️  Platform initialization skipped: Unable to connect to Supabase.",
        "This may be due to network issues or Supabase service being unavailable.",
        "The app will continue to run, but admin wallet initialization will be retried on next server restart."
      );
    } else {
      console.error(
        "❌ Error during platform initialization:",
        errorMessage,
        errorStack ? `\nStack: ${errorStack}` : ""
      );
    }
  } finally {
    isInitialized = true;
  }
};

runPlatformInitialization();