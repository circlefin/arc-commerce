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

"use server";

import { revalidatePath } from "next/cache";
import { Database } from "@/types/supabase";
import { circleDeveloperSdk } from "@/lib/circle/developer-controlled-wallets-client";
import { convertToSmallestUnit } from "@/lib/utils/convert-to-smallest-unit";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { CHAIN_IDS_TO_TOKEN_MESSENGER, CHAIN_IDS_TO_USDC_ADDRESSES, SupportedChainId } from "@/lib/chains";

const baseUrl = process.env.NEXT_PUBLIC_VERCEL_URL
  ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`
  : "http://localhost:3000";

const circleApiKey = process.env.CIRCLE_API_KEY;
const circleApiBaseUrl = "https://api.circle.com";

type WalletStatus = Database["public"]["Enums"]["admin_wallet_status"];

export interface TokenBalance {
  token: {
    blockchain: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  amount: string;
}

interface AxiosErrorLike {
  isAxiosError: true;
  response?: {
    data?: {
      message?: string;
    };
  };
}

function isAxiosError(error: unknown): error is AxiosErrorLike {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as AxiosErrorLike).isAxiosError === true
  );
}

/**
 * Creates a new Circle wallet via internal API routes and saves it to the database.
 */
export async function createAdminWallet(formData: FormData) {
  const label = formData.get("label") as string;
  // Get the blockchain from the form data.
  const blockchain = formData.get("blockchain") as string;

  if (!label || label.trim().length < 3) {
    return { error: "Label must be at least 3 characters long." };
  }
  // Add a check for the blockchain
  if (!blockchain) {
    return { error: "Blockchain is a required field." };
  }

  try {
    const createdWalletSetResponse = await fetch(`${baseUrl}/api/wallet-set`, {
      method: "POST",
      body: JSON.stringify({ entityName: `admin-wallet-${label}` }),
      headers: { "Content-Type": "application/json" },
    });
    if (!createdWalletSetResponse.ok)
      throw new Error("Failed to create wallet set.");
    const createdWalletSet = await createdWalletSetResponse.json();

    // Pass the selected blockchain to the /api/wallet endpoint.
    const createdWalletResponse = await fetch(`${baseUrl}/api/wallet`, {
      method: "POST",
      body: JSON.stringify({
        walletSetId: createdWalletSet.id,
        blockchain,
      }),
      headers: { "Content-Type": "application/json" },
    });
    if (!createdWalletResponse.ok) throw new Error("Failed to create wallet.");
    const newWallet = await createdWalletResponse.json();

    const { error: insertError } = await supabaseAdminClient
      .from("admin_wallets")
      .insert({
        circle_wallet_id: newWallet.id,
        label: label.trim(),
        address: newWallet.address,
        chain: newWallet.blockchain,
      });

    if (insertError) throw new Error(insertError.message);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Error creating admin wallet:", message);
    return { error: message };
  }
}

/**
 * Updates the status of an existing admin wallet.
 */
export async function updateAdminWalletStatus(
  id: string,
  status: WalletStatus
) {
  try {
    const { error } = await supabaseAdminClient
      .from("admin_wallets")
      .update({ status })
      .eq("id", id);

    if (error) throw new Error(error.message);

    revalidatePath("/dashboard");
    return { success: true };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error(
      `Error updating wallet ${id} to status ${status}:`,
      message
    );
    return { error: message };
  }
}

/**
 * Fetches the token balances for a specific Circle wallet using a direct API call.
 */
export async function getWalletBalance(
  walletId: string
): Promise<{ balances?: TokenBalance[]; error?: string }> {
  if (!circleApiKey) {
    const message = "Circle API Key is not configured on the server.";
    console.error(message);
    return { error: message };
  }

  try {
    const url = `${circleApiBaseUrl}/v1/w3s/wallets/${walletId}/balances?includeAll=true`;
    const options = {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${circleApiKey}`,
      },
    };

    const response = await fetch(url, options);
    const responseBody = await response.json();

    if (!response.ok) {
      throw new Error(
        responseBody.message || "Failed to fetch balances from Circle API."
      );
    }

    const balances = responseBody.data.tokenBalances as TokenBalance[] | undefined;

    return { balances: balances ?? [] };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error(`Error fetching balance for wallet ${walletId}:`, message);
    return { error: message };
  }
}

/**
 * Initiates a transfer from a developer-controlled admin wallet and logs the transaction.
 */
export async function transferFromAdminWallet(
  sourceCircleWalletId: string,
  destinationAddress: string,
  amount: string
) {
  try {
    // Fetch the source wallet's internal DB ID, chain, and address from our database.
    const { data: sourceWallet, error: fetchError } = await supabaseAdminClient
      .from("admin_wallets")
      .select("id, chain, address")
      .eq("circle_wallet_id", sourceCircleWalletId)
      .single();

    if (fetchError || !sourceWallet) {
      throw new Error("Source wallet not found in the database.");
    }

    // 1. Convert the chain string (e.g., "ETH-SEPOLIA") to its corresponding enum key.
    const sourceChainKey = sourceWallet.chain.replace(/-/g, '_');
    const sourceChainId = SupportedChainId[sourceChainKey as keyof typeof SupportedChainId];

    if (sourceChainId === undefined) {
      throw new Error(`Unsupported source chain for transfer: ${sourceWallet.chain}`);
    }

    // 2. Look up the correct USDC contract address for the source chain.
    const usdcContractAddress = CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId];

    if (!usdcContractAddress) {
      throw new Error(`Could not find a USDC contract address for chain: ${sourceWallet.chain}`);
    }

    // 3. Use the robust `createContractExecutionTransaction` to call the `transfer` function.
    const response = await circleDeveloperSdk.createContractExecutionTransaction({
      walletId: sourceCircleWalletId,
      contractAddress: usdcContractAddress, // The USDC contract on the source chain
      abiFunctionSignature: "transfer(address,uint256)",
      abiParameters: [
        destinationAddress,
        convertToSmallestUnit(amount).toString(),
      ],
      fee: {
        type: "level",
        config: {
          feeLevel: "HIGH",
        },
      },
    });

    const transactionData = response.data;

    if (!transactionData?.id) {
      throw new Error("Failed to initiate transfer with Circle API.");
    }

    // Convert chain name to numeric chain ID
    const chainKey = (sourceWallet.chain || "").replace(/-/g, '_');
    const chainId = SupportedChainId[chainKey as keyof typeof SupportedChainId];

    // Log the new transaction to the unified `transactions` table.
    const { error: insertError } = await supabaseAdminClient
      .from("transactions")
      .insert({
        transaction_type: "ADMIN",
        circle_transaction_id: transactionData.id,
        source_wallet_id: sourceWallet.id,
        destination_address: destinationAddress,
        amount_usdc: Number(amount),
        asset: "USDC",
        chain: chainId ? String(chainId) : sourceWallet.chain || "UNKNOWN",
        wallet_id: sourceWallet.address, // Source wallet address, not destination
        idempotency_key: `admin:${transactionData.id}`,
        status: "pending"
      });

    if (insertError) {
      console.error(
        "CRITICAL: Failed to log transaction to database:",
        insertError.message
      );
    }

    revalidatePath("/dashboard");
    return { success: true, transactionId: transactionData.id };
  } catch (error: unknown) {
    let message = "An unexpected error occurred.";

    if (isAxiosError(error)) {
      message =
        error.response?.data?.message || "An unknown Circle API error occurred.";
    } else if (error instanceof Error) {
      message = error.message;
    }

    console.error(
      `Error transferring from wallet ${sourceCircleWalletId}:`,
      message
    );
    return { error: message };
  }
}

export async function transferFromAdminWalletCCTP(
  sourceCircleWalletId: string,
  destinationAddress: string,
  amount: string
) {

  console.log("[CCTP] Approving USDC transfer from source wallet...");

  const formattedAmount = convertToSmallestUnit(amount);

  try {
    // Fetch the source wallet's internal DB ID, chain, and address from our database.
    const { data: sourceWallet, error: fetchError } = await supabaseAdminClient
      .from("admin_wallets")
      .select("id, chain, address")
      .eq("circle_wallet_id", sourceCircleWalletId)
      .single();

    if (fetchError || !sourceWallet) {
      throw new Error("Source wallet not found in the database.");
    }

    // Convert the dash-separated chain string from the DB to the underscore-separated enum key format.
    const chainKey = sourceWallet.chain.replace(/-/g, '_');

    // Get the numerical chain ID from the string stored in the database.
    const sourceChainId = SupportedChainId[chainKey as keyof typeof SupportedChainId];

    if (sourceChainId === undefined) {
      throw new Error(`Unsupported source chain: ${sourceWallet.chain}. Please check the configuration.`);
    }

    // Look up the correct contract addresses using the chain ID.
    const tokenMessengerAddress = CHAIN_IDS_TO_TOKEN_MESSENGER[sourceChainId];
    const usdcContractAddress = CHAIN_IDS_TO_USDC_ADDRESSES[sourceChainId];

    if (!tokenMessengerAddress || !usdcContractAddress) {
      throw new Error(`Contract addresses for chain ID ${sourceChainId} are not defined.`);
    }

    const approvalResponse = await circleDeveloperSdk.createContractExecutionTransaction({
      walletId: sourceCircleWalletId,
      abiFunctionSignature: "approve(address,uint256)",
      abiParameters: [
        // Use the dynamically looked-up Token Messenger address
        tokenMessengerAddress,
        formattedAmount.toString()
      ],
      // Use the dynamically looked-up USDC contract address
      contractAddress: usdcContractAddress,
      fee: {
        type: "level",
        config: {
          feeLevel: "MEDIUM",
        },
      },
    });

    if (!approvalResponse.data?.id) {
      throw new Error("Failed to initiate CCTP transfer with Circle API.");
    }

    // Log the new transaction to the unified `transactions` table.
    const { error: insertError } = await supabaseAdminClient
      .from("transactions")
      .insert({
        transaction_type: "CCTP_APPROVAL",
        circle_transaction_id: approvalResponse.data.id,
        source_wallet_id: sourceWallet.id, // Use the internal DB ID
        destination_address: destinationAddress,
        amount_usdc: Number(amount),
        asset: "USDC",
        chain: String(sourceChainId), // Use numeric chain ID
        wallet_id: sourceWallet.address, // Source wallet address, not destination
        idempotency_key: `admin:${approvalResponse.data.id}`,
        status: "pending"
      });

    if (insertError) {
      // Log this as a critical error but don't fail the entire operation,
      // as the on-chain transaction has already been submitted.
      console.error(
        "CRITICAL: Failed to log transaction to database:",
        insertError.message
      );
    }

    revalidatePath("/dashboard");
    return { transactionId: approvalResponse.data.id }
  } catch (error) {
    let message = "An unexpected error occurred.";

    if (isAxiosError(error)) {
      message =
        error.response?.data?.message || "An unknown Circle API error occurred.";
    } else if (error instanceof Error) {
      message = error.message;
    }

    console.error(
      `Error transferring from wallet ${sourceCircleWalletId}:`,
      message
    );
    return { error: message };
  }
}

/**
 * Fetches all admin wallet addresses for filtering realtime subscriptions.
 * Uses admin client to bypass RLS restrictions.
 */
export async function getAdminWalletAddresses(): Promise<string[]> {
  try {
    const { data, error } = await supabaseAdminClient
      .from("admin_wallets")
      .select("address");

    if (error) {
      console.error("[Server Action] Error fetching admin wallet addresses:", error);
      return [];
    }

    return data?.map(w => w.address) || [];
  } catch (error) {
    console.error("[Server Action] Unexpected error fetching admin wallet addresses:", error);
    return [];
  }
}