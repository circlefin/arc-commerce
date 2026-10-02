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

import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { usdcToMicro } from "@/lib/payments/credits";
import { verifyUsdcTransfer } from "@/lib/payments/verify-usdc-transfer";
import { serializeTransaction } from "@/lib/payments/serialize-transaction";
import { TX_HASH_PATTERN } from "@/lib/payments/tx-hash";

/**
 * GET /api/transactions/[id]
 * Fetches a single transaction by ID for the authenticated user
 */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    if (!id) {
      return NextResponse.json(
        { error: "Transaction ID is required" },
        { status: 400 }
      );
    }

    // Get authenticated user
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch transaction (RLS will ensure user can only see their own)
    const { data: transaction, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (txError) {
      if (txError.code === "PGRST116") {
        return NextResponse.json(
          { error: "Transaction not found" },
          { status: 404 }
        );
      }
      return NextResponse.json(
        { error: "Failed to fetch transaction", details: txError.message },
        { status: 500 }
      );
    }

    if (!transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    // Fetch related status events
    const { data: statusEvents, error: eventsError } = await supabase
      .from("transaction_events")
      .select("*")
      .eq("transaction_id", id)
      .order("created_at", { ascending: true });

    if (eventsError) {
      console.error("Failed to fetch transaction events:", eventsError);
      // Continue without events rather than failing the request
    }

    // Transform the response to match our expected format
    const response = {
      id: transaction.id,
      credits: transaction.credit_amount,
      usdcAmount: transaction.amount_usdc,
      txHash: transaction.tx_hash,
      chainId: parseInt(transaction.chain),
      status: transaction.status,
      createdAt: transaction.created_at,
      updatedAt: transaction.updated_at,
      fee: transaction.fee_usdc,
      walletId: transaction.wallet_id,
      userId: transaction.user_id,
      direction: transaction.direction,
      asset: transaction.asset,
      exchangeRate: transaction.exchange_rate,
      metadata: transaction.metadata,
      idempotencyKey: transaction.idempotency_key,
      statusEvents: statusEvents || [],
    };

    return NextResponse.json(response, { status: 200 });
  } catch (error) {
    console.error("Transaction API error:", error);
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/transactions/[id]
 * Marks a purchase complete once its transfer is verified on-chain.
 *
 * This gives faster feedback than waiting for Circle's webhook, but it never
 * trusts the browser: the server reads the receipt itself and checks that the
 * recorded wallet really sent at least the recorded amount to the recorded admin
 * wallet. Crediting happens inside the settle_user_transaction() SQL function so
 * it can only ever be granted once, even if the webhook races this request.
 *
 * Expected JSON body:
 * {
 *   "status": "complete",
 *   "txHash": string   // Must match the transaction's tx_hash
 * }
 * Any other client-supplied field (e.g. block number) is ignored.
 */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const { status, txHash } = body || {};

    if (!id || typeof id !== "string") {
      return NextResponse.json(
        { error: "Invalid transaction ID" },
        { status: 400 }
      );
    }

    // Only allow updating to 'complete' from client
    if (status !== "complete") {
      return NextResponse.json(
        { error: "Only 'complete' status updates are allowed from client" },
        { status: 400 }
      );
    }

    if (typeof txHash !== "string" || !TX_HASH_PATTERN.test(txHash)) {
      return NextResponse.json(
        { error: "Valid txHash is required" },
        { status: 400 }
      );
    }

    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: transaction, error: fetchError } = await supabaseAdminClient
      .from("transactions")
      .select("*")
      .eq("id", id)
      .single();

    if (fetchError || !transaction) {
      return NextResponse.json(
        { error: "Transaction not found" },
        { status: 404 }
      );
    }

    if (transaction.user_id !== user.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    if (transaction.tx_hash?.toLowerCase() !== txHash.toLowerCase()) {
      return NextResponse.json(
        { error: "Transaction hash mismatch" },
        { status: 400 }
      );
    }

    // Already settled (by the webhook or a previous call): nothing to do.
    if (transaction.status !== "pending") {
      return NextResponse.json(
        {
          ok: true,
          message: `Transaction already in '${transaction.status}' status, no update needed`,
          transaction: {
            id: transaction.id,
            status: transaction.status,
            updatedAt: transaction.updated_at,
          },
        },
        { status: 200 }
      );
    }

    if (
      transaction.direction !== "credit" ||
      !transaction.credit_amount ||
      !transaction.destination_address
    ) {
      return NextResponse.json(
        { error: "Transaction cannot be verified on-chain" },
        { status: 409 }
      );
    }

    let verification;
    try {
      verification = await verifyUsdcTransfer({
        chainId: Number(transaction.chain),
        txHash: transaction.tx_hash as `0x${string}`,
        from: transaction.wallet_id,
        to: transaction.destination_address,
        minAmount: usdcToMicro(Number(transaction.amount_usdc)),
      });
    } catch (rpcError) {
      console.error("[transactions/PATCH] RPC error:", rpcError);
      return NextResponse.json(
        { error: "Could not reach the blockchain RPC. Try again shortly." },
        { status: 502 }
      );
    }

    if (verification.status === "pending") {
      return NextResponse.json(
        { error: "Transaction is not confirmed on-chain yet" },
        { status: 409 }
      );
    }
    if (verification.status === "invalid") {
      return NextResponse.json(
        { error: "On-chain verification failed", reason: verification.reason },
        { status: 422 }
      );
    }

    const { data: outcome, error: settleError } = await supabaseAdminClient.rpc(
      "settle_user_transaction",
      {
        p_transaction_id: transaction.id,
        p_new_status: "complete",
        p_metadata: {
          metamask_confirmation: {
            confirmed_at: new Date().toISOString(),
            block_number: Number(verification.blockNumber),
            block_hash: verification.blockHash,
          },
        },
      }
    );

    if (settleError) {
      console.error("[transactions/PATCH] Settlement error:", settleError);
      return NextResponse.json(
        { error: "Update failed", details: settleError.message },
        { status: 500 }
      );
    }
    if (outcome === "credited") {
      console.log(
        `Transaction ${transaction.id} verified on-chain. Credited user ${transaction.user_id} with ${transaction.credit_amount} credits.`
      );
    }

    const { data: updatedTransaction, error: refetchError } =
      await supabaseAdminClient
        .from("transactions")
        .select("*")
        .eq("id", transaction.id)
        .single();

    if (refetchError || !updatedTransaction) {
      return NextResponse.json(
        { error: "Update failed", details: refetchError?.message },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        ok: true,
        message: "Transaction status updated to complete",
        transaction: {
          ...serializeTransaction(updatedTransaction),
          updatedAt: updatedTransaction.updated_at,
          metadata: updatedTransaction.metadata,
        },
      },
      { status: 200 }
    );
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    console.error("[transactions/PATCH] Server error:", e);
    return NextResponse.json(
      { error: "Server error", details: message },
      { status: 500 }
    );
  }
}
