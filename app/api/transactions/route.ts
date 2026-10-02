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
import { isAddress } from "viem";
import { supabaseAdminClient } from "@/lib/supabase/admin-client";
import { createClient as createServerSupabase } from "@/lib/supabase/server";
import { SUPPORTED_CHAINS } from "@/lib/chains";
import { USDC_PER_CREDIT, isPriceConsistent } from "@/lib/payments/credits";
import {
  getPrimaryDestinationAddress,
  isAdminWalletAddress,
} from "@/lib/payments/destination";
import { serializeTransaction } from "@/lib/payments/serialize-transaction";
import { TX_HASH_PATTERN } from "@/lib/payments/tx-hash";

interface TransactionEvent {
  transaction_id: string;
  old_status: string | null;
  new_status: string;
  created_at: string;
  [k: string]: unknown;
}

interface TransactionWebhookEvent {
  transaction_id: string | null;
  circle_transaction_id?: string | null;
  mapped_status?: string | null;
  received_at: string;
  [k: string]: unknown;
}

/**
 * POST /api/transactions
 * Records a (credit) top-up transaction after it has been broadcast on-chain.
 *
 * The row is created as `pending` and no credits are granted here. Credits are
 * only granted once the transfer is verified on-chain (PATCH /api/transactions/[id])
 * or reported by Circle's signed webhook.
 *
 * Expected JSON body:
 * {
 *   "credits": number,
 *   "usdcAmount": number,          // decimal USDC; must equal credits * USDC_PER_CREDIT
 *   "txHash": string,              // 0x + 64 hex
 *   "chainId": number,             // one of SUPPORTED_CHAINS
 *   "walletAddress": string,       // sender wallet 0x...
 *   "destinationAddress": string   // an admin wallet 0x... (optional; defaults to the primary one)
 * }
 */
export async function POST(req: NextRequest) {
  try {
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json().catch(() => ({}));
    const { credits, usdcAmount, txHash, chainId, walletAddress, destinationAddress } = body || {};

    if (
      typeof credits !== "number" ||
      !Number.isFinite(credits) ||
      credits <= 0 ||
      typeof usdcAmount !== "number" ||
      !Number.isFinite(usdcAmount) ||
      usdcAmount <= 0 ||
      typeof txHash !== "string" ||
      !TX_HASH_PATTERN.test(txHash) ||
      typeof chainId !== "number" ||
      !SUPPORTED_CHAINS.includes(chainId) ||
      typeof walletAddress !== "string" ||
      !isAddress(walletAddress, { strict: false }) ||
      (destinationAddress !== undefined &&
        destinationAddress !== null &&
        (typeof destinationAddress !== "string" || !isAddress(destinationAddress, { strict: false })))
    ) {
      return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
    }

    // The client may not choose its own price.
    if (!isPriceConsistent(credits, usdcAmount)) {
      return NextResponse.json(
        { error: "usdcAmount does not match the credits requested" },
        { status: 400 }
      );
    }

    // Funds must have been sent to a wallet the platform controls.
    const destination = destinationAddress
      ? (await isAdminWalletAddress(destinationAddress))
        ? destinationAddress
        : null
      : await getPrimaryDestinationAddress();

    if (!destination) {
      return NextResponse.json(
        { error: "Destination is not a platform wallet" },
        { status: 400 }
      );
    }

    // Hashes are case-insensitive on-chain; normalise so one transfer is one row.
    const normalizedTxHash = txHash.toLowerCase();
    const idempotencyKey = `${chainId}:${normalizedTxHash}`;

    // The RLS policy only allows service_role inserts, so use the admin client.
    const { data: insertedTransaction, error: insertError } =
      await supabaseAdminClient
        .from("transactions")
        .insert({
          transaction_type: "USER",
          user_id: user.id,
          wallet_id: walletAddress,
          destination_address: destination,
          direction: "credit",
          amount_usdc: usdcAmount, // numeric(18,6)
          fee_usdc: 0,
          credit_amount: credits,
          exchange_rate: USDC_PER_CREDIT,
          chain: String(chainId),
          asset: "USDC",
          tx_hash: normalizedTxHash,
          status: "pending",
          metadata: {},
          idempotency_key: idempotencyKey,
        })
        .select()
        .single();

    if (insertError) {
      if (insertError.code === "23505") {
        // Duplicate: only hand the existing row back to its owner. Anyone else
        // presenting this hash gets a conflict, never someone else's record.
        const { data: existingTx } = await supabaseAdminClient
          .from("transactions")
          .select("*")
          .eq("chain", String(chainId))
          .ilike("tx_hash", normalizedTxHash)
          .maybeSingle();

        if (existingTx && existingTx.user_id === user.id) {
          return NextResponse.json(
            {
              ok: true,
              transactionId: existingTx.id,
              message: "Transaction already exists",
              transaction: serializeTransaction(existingTx),
            },
            { status: 200 }
          );
        }
        return NextResponse.json(
          { error: "Transaction already recorded" },
          { status: 409 }
        );
      }

      console.error("[transactions] Insert error:", {
        message: insertError.message,
        code: insertError.code,
        hint: insertError.hint,
        details: insertError.details,
      });
      return NextResponse.json({ error: "Insert failed" }, { status: 500 });
    }

    return NextResponse.json(
      {
        ok: true,
        transactionId: insertedTransaction.id,
        message: "Transaction recorded successfully",
        transaction: serializeTransaction(insertedTransaction),
      },
      { status: 201 }
    );
  } catch (e: unknown) {
    console.error("[transactions] Server error:", e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const includeWebhook =
      req.nextUrl.searchParams.get("includeWebhook") === "1";
    const supabase = await createServerSupabase();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
      });
    }

    // Fetch user transactions (filter by USER type)
    const { data: transactions, error: txError } = await supabase
      .from("transactions")
      .select("*")
      .eq("transaction_type", "USER")
      .order("created_at", { ascending: false });

    if (txError) {
      return new Response(
        JSON.stringify({ error: "Fetch failed", details: txError.message }),
        {
          status: 500,
        }
      );
    }

    if (!transactions || transactions.length === 0) {
      return new Response(JSON.stringify({ data: [] }), { status: 200 });
    }

    const ids = transactions.map((t) => t.id);

    // Status change events
    const { data: statusEvents, error: seError } = await supabase
      .from("transaction_events")
      .select("*")
      .in("transaction_id", ids)
      .order("created_at", { ascending: true });

    if (seError) {
      return new Response(
        JSON.stringify({
          error: "Events fetch failed",
          details: seError.message,
        }),
        { status: 500 }
      );
    }

    // Optional raw webhook events
    let webhookEvents: TransactionWebhookEvent[] | null = null;
    if (includeWebhook) {
      const { data: weData, error: weError } = await supabase
        .from("transaction_webhook_events")
        .select("*")
        .in("transaction_id", ids)
        .order("received_at", { ascending: true });

      if (weError) {
        return new Response(
          JSON.stringify({
            error: "Webhook events fetch failed",
            details: weError.message,
          }),
          { status: 500 }
        );
      }
      webhookEvents = weData;
    }

    // Aggregate events by transaction_id
    const statusByTx = new Map<string, TransactionEvent[]>();
    (statusEvents || []).forEach((e) => {
      const arr = statusByTx.get(e.transaction_id) || [];
      arr.push(e);
      statusByTx.set(e.transaction_id, arr);
    });

    const webhookByTx = new Map<string, TransactionWebhookEvent[]>();
    (webhookEvents || []).forEach((e) => {
      if (!e.transaction_id) return;
      const arr = webhookByTx.get(e.transaction_id) || [];
      arr.push(e);
      webhookByTx.set(e.transaction_id, arr);
    });

    const enriched = transactions.map((t) => ({
      ...t,
      status_events: statusByTx.get(t.id) || [],
      webhook_events: includeWebhook ? webhookByTx.get(t.id) || [] : undefined,
    }));

    return new Response(JSON.stringify({ data: enriched }), { status: 200 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return new Response(
      JSON.stringify({ error: "Server error", details: message }),
      {
        status: 500,
      }
    );
  }
}
