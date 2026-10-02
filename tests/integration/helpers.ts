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

import { randomUUID } from "crypto";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const publishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !publishableKey || !secretKey) {
  throw new Error(
    "Integration tests need the local Supabase stack. Run `npm run db:start` and make sure .env.local has NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY and SUPABASE_SECRET_KEY (see `npm run db:status`)."
  );
}

const clientOptions = { auth: { persistSession: false, autoRefreshToken: false } };

/** Service-role client: bypasses RLS, like the app's server-side admin client. */
export const service: SupabaseClient = createClient(url, secretKey, clientOptions);

export const ADMIN_EMAIL = "admin@admin.com";
const PASSWORD = "123456"; // matches lib/supabase/initialize-admin-user.ts
const createdUserIds: string[] = [];

export async function createUser(email = `it-${randomUUID()}@example.com`) {
  const { data, error } = await service.auth.admin.createUser({
    email,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error || !data.user) throw new Error(`createUser failed: ${error?.message}`);
  createdUserIds.push(data.user.id);
  return { id: data.user.id, email };
}

/** Ensures the admin account exists (the app normally creates it at first boot). */
export async function ensureAdminUser() {
  const { data } = await service.rpc("check_user_exists", { user_email: ADMIN_EMAIL });
  if (data) return;
  const { error } = await service.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: PASSWORD,
    email_confirm: true,
  });
  if (error) throw new Error(`creating admin failed: ${error.message}`);
}

/** A client that behaves like the browser: publishable key + the user's session. */
export async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url!, publishableKey!, clientOptions);
  const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD });
  if (error) throw new Error(`signIn failed: ${error.message}`);
  return client;
}

export const anonymous = () => createClient(url!, publishableKey!, clientOptions);

export async function insertUserPurchase(
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const txHash = `0x${randomUUID().replace(/-/g, "")}${randomUUID().replace(/-/g, "")}`;
  const row = {
    transaction_type: "USER",
    user_id: userId,
    wallet_id: "0x1111111111111111111111111111111111111111",
    destination_address: "0x2222222222222222222222222222222222222222",
    direction: "credit",
    amount_usdc: 10,
    fee_usdc: 0,
    credit_amount: 10,
    exchange_rate: 1,
    chain: "5042002",
    asset: "USDC",
    tx_hash: txHash,
    status: "pending",
    metadata: {},
    idempotency_key: `5042002:${txHash}`,
    ...overrides,
  };
  const { data, error } = await service.from("transactions").insert(row).select().single();
  if (error) throw new Error(`insert purchase failed: ${error.message}`);
  return data as { id: string; tx_hash: string };
}

export async function creditsOf(userId: string): Promise<number> {
  const { data, error } = await service
    .from("credits")
    .select("credits")
    .eq("user_id", userId)
    .single();
  if (error) throw new Error(`read credits failed: ${error.message}`);
  return Number(data.credits);
}

export async function statusOf(transactionId: string): Promise<string> {
  const { data } = await service
    .from("transactions")
    .select("status")
    .eq("id", transactionId)
    .single();
  return data!.status;
}

export const settle = (id: string, status: string) =>
  service.rpc("settle_user_transaction", { p_transaction_id: id, p_new_status: status });

/** Deletes users created by the test run; their credits and transactions cascade. */
export async function cleanup() {
  for (const id of createdUserIds.splice(0)) {
    await service.auth.admin.deleteUser(id);
  }
}
