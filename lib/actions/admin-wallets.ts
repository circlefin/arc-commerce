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

import { randomUUID } from "crypto";
import { revalidatePath } from "next/cache";
import { createPublicClient, http, erc20Abi, formatUnits } from "viem";
import { Database } from "@/types/supabase";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { Blockchain, BridgeChain } from "@circle-fin/app-kit";
import { getAppKit, createAdapter } from "@/lib/circle/app-kit-client";
import { createWalletSetWithWallet } from "@/lib/circle/wallets";
import { getAdminUser } from "@/lib/auth/admin";
import {
  CHAIN_IDS_TO_USDC_ADDRESSES,
  CHAIN_DB_TO_BRIDGE_CHAIN,
  CHAIN_DB_TO_RPC,
} from "@/lib/chains";
import { chainNameToId } from "@/lib/utils/chain-utils";
import { USDC_DECIMALS } from "@/lib/payments/credits";

type WalletStatus = Database["public"]["Enums"]["admin_wallet_status"];
type TransactionStatus = Database["public"]["Enums"]["transaction_status"];

const UNAUTHORIZED = { error: "Unauthorized" };

interface ActionResult {
  success?: boolean;
  error?: string;
}

interface TransferResult extends ActionResult {
  txHash?: string;
  /** Set when the transfer went through but the history row could not be saved. */
  warning?: string;
}

export interface TokenBalance {
  token: {
    blockchain: string;
    name: string;
    symbol: string;
    decimals: number;
  };
  amount: string;
}

/**
 * Server actions are public POST endpoints, so every exported action below must
 * start with this check. The proxy only guards page navigations.
 */
async function isAdminRequest(): Promise<boolean> {
  return (await getAdminUser()) !== null;
}

/**
 * `transactions.chain` stores numeric chain IDs as strings (see migration
 * 20251124010000), which is what the admin table uses to build explorer links.
 */
function chainColumnFor(dbChain: string | null): string {
  const id = dbChain ? chainNameToId(dbChain) : undefined;
  return id !== undefined ? String(id) : dbChain ?? "UNKNOWN";
}

interface AdminTransactionRecord {
  sourceWalletId: string;
  sourceChain: string | null;
  sourceAddress: string;
  destinationAddress: string;
  amount: string;
  /** On-chain hash when App Kit returned one. */
  txHash?: string;
  status: TransactionStatus;
  kind: "send" | "bridge";
}

/**
 * Persists an admin transfer. Returns a warning message when the row could not be
 * saved, so callers can tell the admin the money moved but the history is missing.
 */
async function recordAdminTransaction(
  record: AdminTransactionRecord
): Promise<string | undefined> {
  // `circle_transaction_id` is required and unique for ADMIN rows. Never reuse an
  // unrelated identifier (e.g. a wallet id) when there is no hash: generate one.
  const circleTransactionId = record.txHash ?? `${record.kind}:${randomUUID()}`;

  const { error } = await supabaseAdminClient.from("transactions").insert({
    transaction_type: "ADMIN",
    circle_transaction_id: circleTransactionId,
    tx_hash: record.txHash ?? null,
    source_wallet_id: record.sourceWalletId,
    destination_address: record.destinationAddress,
    amount_usdc: Number(record.amount),
    asset: "USDC",
    chain: chainColumnFor(record.sourceChain),
    wallet_id: record.sourceAddress,
    idempotency_key: `admin:${circleTransactionId}`,
    status: record.status,
  });

  if (error) {
    console.error(
      "CRITICAL: Failed to log admin transaction to database:",
      error.message
    );
    return "The transfer was submitted but could not be saved to the transaction history.";
  }
  return undefined;
}

/**
 * Creates a new Circle wallet and saves it to the database.
 */
export async function createAdminWallet(
  formData: FormData
): Promise<ActionResult> {
  if (!(await isAdminRequest())) return UNAUTHORIZED;

  const label = formData.get("label") as string;
  const blockchain = formData.get("blockchain") as string;

  if (!label || label.trim().length < 3) {
    return { error: "Label must be at least 3 characters long." };
  }
  if (!blockchain) {
    return { error: "Blockchain is a required field." };
  }

  try {
    const newWallet = await createWalletSetWithWallet(
      `admin-wallet-${label}`,
      blockchain
    );

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

export async function updateAdminWalletStatus(
  id: string,
  status: WalletStatus
): Promise<ActionResult> {
  if (!(await isAdminRequest())) return UNAUTHORIZED;

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
    console.error(`Error updating wallet ${id} to status ${status}:`, message);
    return { error: message };
  }
}

export async function getWalletBalance(
  walletAddress: string,
  chainDbString: string
): Promise<{ balances?: TokenBalance[]; error?: string }> {
  if (!(await isAdminRequest())) return UNAUTHORIZED;

  try {
    const chainId = chainNameToId(chainDbString);
    const usdcAddress =
      chainId !== undefined ? CHAIN_IDS_TO_USDC_ADDRESSES[chainId] : undefined;
    const rpcUrl = CHAIN_DB_TO_RPC[chainDbString];

    if (!usdcAddress || !rpcUrl) {
      return { error: `Unsupported chain: ${chainDbString}` };
    }

    const client = createPublicClient({ transport: http(rpcUrl) });
    const rawBalance = await client.readContract({
      address: usdcAddress,
      abi: erc20Abi,
      functionName: "balanceOf",
      args: [walletAddress as `0x${string}`],
    });

    return {
      balances: [
        {
          token: {
            blockchain: chainDbString,
            name: "USD Coin",
            symbol: "USDC",
            decimals: USDC_DECIMALS,
          },
          amount: formatUnits(rawBalance, USDC_DECIMALS),
        },
      ],
    };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error(
      `Error fetching on-chain balance for ${walletAddress}:`,
      message
    );
    return { error: message };
  }
}

export async function transferFromAdminWallet(
  sourceCircleWalletId: string,
  destinationAddress: string,
  amount: string
): Promise<TransferResult> {
  if (!(await isAdminRequest())) return UNAUTHORIZED;

  try {
    const { data: sourceWallet, error: fetchError } = await supabaseAdminClient
      .from("admin_wallets")
      .select("id, chain, address")
      .eq("circle_wallet_id", sourceCircleWalletId)
      .single();

    if (fetchError || !sourceWallet) {
      throw new Error("Source wallet not found in the database.");
    }

    const bridgeChain = CHAIN_DB_TO_BRIDGE_CHAIN[sourceWallet.chain ?? ""];
    if (!bridgeChain) {
      throw new Error(
        `Unsupported source chain for transfer: ${sourceWallet.chain}`
      );
    }

    const kit = getAppKit();
    const adapter = createAdapter();

    // App Kit reports the outcome in `state`; it does not always throw.
    const result = await kit.send({
      from: {
        adapter,
        chain: bridgeChain as Blockchain,
        address: sourceWallet.address,
      },
      to: destinationAddress,
      amount,
      token: "USDC",
    });

    const failed = result.state === "error";
    const warning = await recordAdminTransaction({
      sourceWalletId: sourceWallet.id,
      sourceChain: sourceWallet.chain,
      sourceAddress: sourceWallet.address,
      destinationAddress,
      amount,
      txHash: result.txHash,
      status: failed
        ? "failed"
        : result.state === "success"
          ? "complete"
          : "pending",
      kind: "send",
    });

    revalidatePath("/dashboard");

    if (failed) {
      return {
        error: result.errorMessage || "The transfer failed.",
        txHash: result.txHash,
      };
    }
    return { success: true, txHash: result.txHash, warning };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
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
): Promise<TransferResult> {
  if (!(await isAdminRequest())) return UNAUTHORIZED;

  try {
    const { data: sourceWallet, error: fetchError } = await supabaseAdminClient
      .from("admin_wallets")
      .select("id, chain, address")
      .eq("circle_wallet_id", sourceCircleWalletId)
      .single();

    if (fetchError || !sourceWallet) {
      throw new Error("Source wallet not found in the database.");
    }

    const { data: destinationWallet, error: destFetchError } =
      await supabaseAdminClient
        .from("admin_wallets")
        .select("chain")
        .eq("address", destinationAddress)
        .single();

    if (destFetchError || !destinationWallet?.chain) {
      throw new Error(
        `Could not resolve destination chain for address: ${destinationAddress}`
      );
    }

    const sourceChain = CHAIN_DB_TO_BRIDGE_CHAIN[sourceWallet.chain ?? ""];
    const destinationChain =
      CHAIN_DB_TO_BRIDGE_CHAIN[destinationWallet.chain];

    if (!sourceChain) {
      throw new Error(
        `Unsupported source chain: ${sourceWallet.chain}`
      );
    }
    if (!destinationChain) {
      throw new Error(
        `Unsupported destination chain: ${destinationWallet.chain}`
      );
    }

    const kit = getAppKit();
    const adapter = createAdapter();

    const result = await kit.bridge({
      from: {
        adapter,
        chain: sourceChain as BridgeChain,
        address: sourceWallet.address,
      },
      to: {
        adapter,
        chain: destinationChain as BridgeChain,
        address: destinationAddress,
      },
      amount,
      token: "USDC",
      config: { transferSpeed: "FAST" },
    });

    // The row's `chain` is the source chain, so record the source-chain burn hash.
    // Fall back to any step hash; never invent one.
    const steps = result.steps ?? [];
    const txHash = (
      steps.find((step) => step.name.toLowerCase() === "burn" && step.txHash) ??
      steps.findLast((step) => step.txHash)
    )?.txHash;

    const failed = result.state === "error";
    const warning = await recordAdminTransaction({
      sourceWalletId: sourceWallet.id,
      sourceChain: sourceWallet.chain,
      sourceAddress: sourceWallet.address,
      destinationAddress,
      amount,
      txHash,
      status: failed
        ? "failed"
        : result.state === "success"
          ? "complete"
          : "pending",
      kind: "bridge",
    });

    revalidatePath("/dashboard");

    if (failed) {
      const stepError = steps.find((step) => step.state === "error");
      return {
        error: stepError?.errorMessage || "The cross-chain transfer failed.",
        txHash,
      };
    }
    return { success: true, txHash, warning };
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error(
      `Error bridging from wallet ${sourceCircleWalletId}:`,
      message
    );
    return { error: message };
  }
}

export async function getAdminWalletAddresses(): Promise<string[]> {
  if (!(await isAdminRequest())) return [];

  try {
    const { data, error } = await supabaseAdminClient
      .from("admin_wallets")
      .select("address");

    if (error) {
      console.error(
        "[Server Action] Error fetching admin wallet addresses:",
        error
      );
      return [];
    }

    return data?.map((w) => w.address) || [];
  } catch (error) {
    console.error(
      "[Server Action] Unexpected error fetching admin wallet addresses:",
      error
    );
    return [];
  }
}
