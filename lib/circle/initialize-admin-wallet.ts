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

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : "http://localhost:3000";

// Supabase Admin Client Initialization
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// This in-memory flag ensures the initialization logic runs only once per server start.
let isInitialized = false;

/**
 * An idempotent, self-invoking async function that creates the primary platform
 * admin wallet if it does not already exist in the database.
 */
const runPlatformInitialization = async () => {
  // 1. Check the in-memory flag to prevent redundant runs.
  if (isInitialized) {
    return;
  }

  console.log("Running platform initialization check...");

  if (!supabaseUrl || !supabaseServiceRoleKey) {
    console.error(
      "Supabase URL or Service Role Key is not set. Initialization cannot proceed."
    );

    // Mark as initialized to prevent retries
    isInitialized = true;
    return;
  }

  const supabaseAdminClient = createClient<Database>(
    supabaseUrl,
    supabaseServiceRoleKey
  );

  const ADMIN_WALLET_LABEL = "Primary wallet";

  try {
    // 2. Check the database to see if the wallet already exists.
    // We check for the existence of ANY wallet with the specific label.
    const { data: existingWallet, error: fetchError } = await supabaseAdminClient
      .from("admin_wallets")
      .select("circle_wallet_id")
      .eq("label", ADMIN_WALLET_LABEL)
      // Use maybeSingle to handle 0 or 1 row gracefully
      .maybeSingle();

    if (fetchError && fetchError.code !== "PGRST116") {
      // Provide more context about the error
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

    // 3. If not in DB, create it by calling our internal API routes.
    console.log("No platform admin wallet found. Creating a new one...");

    const createdWalletSetResponse = await fetch(`${baseUrl}/api/wallet-set`, {
      method: "POST",
      body: JSON.stringify({ entityName: "platform-operator" }),
      headers: { "Content-Type": "application/json" },
    });

    if (!createdWalletSetResponse.ok) {
      const errorBody = await createdWalletSetResponse.json();
      throw new Error(
        `Failed to create wallet set via internal API: ${errorBody.error || "Unknown error"
        }`
      );
    }
    const createdWalletSet = await createdWalletSetResponse.json();

    const createdWalletResponse = await fetch(`${baseUrl}/api/wallet`, {
      method: "POST",
      body: JSON.stringify({ walletSetId: createdWalletSet.id }),
      headers: { "Content-Type": "application/json" },
    });

    if (!createdWalletResponse.ok) {
      const errorBody = await createdWalletResponse.json();
      throw new Error(
        `Failed to create wallet via internal API: ${errorBody.error || "Unknown error"
        }`
      );
    }
    const newWallet = await createdWalletResponse.json();

    if (!newWallet || !newWallet.id || !newWallet.address) {
      throw new Error("Internal API did not return a complete wallet object.");
    }

    // 4. Store the new wallet details in the new `admin_wallets` table.
    const { error: insertError } = await supabaseAdminClient
      .from("admin_wallets")
      .insert({
        circle_wallet_id: newWallet.id,
        label: ADMIN_WALLET_LABEL,
        address: newWallet.address,
        chain: "ARC-TESTNET",
        // All other columns (status, chain, supported_assets) will use their defaults (ENABLED, NULL, NULL)
      });

    if (insertError) {
      // If we get a unique constraint violation, it means another process already created the wallet
      // This is fine - just log it and move on
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
    
    // Check if it's a network/connection error
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
    // Mark as initialized even if there was an error to prevent constant retries.
    isInitialized = true;
  }
};

runPlatformInitialization();