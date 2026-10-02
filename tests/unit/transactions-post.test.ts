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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { SupportedChainId } from "@/lib/chains";
import { jsonRequest, queryBuilder, queueTables } from "../helpers/supabase-mock";

const admin = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin-client", () => ({ supabaseAdminClient: admin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import { POST } from "@/app/api/transactions/route";

const USER = "0x1111111111111111111111111111111111111111";
const ADMIN_WALLET = "0x2222222222222222222222222222222222222222";
const HASH = `0x${"AB".repeat(32)}`;

const validBody = {
  credits: 10,
  usdcAmount: 10,
  txHash: HASH,
  chainId: SupportedChainId.ARC_TESTNET,
  walletAddress: USER,
  destinationAddress: ADMIN_WALLET,
};

const call = (body: unknown) =>
  POST(new NextRequest(jsonRequest("http://localhost/api/transactions", "POST", body)));

const inserted = {
  id: "tx-1",
  user_id: "user-1",
  credit_amount: 10,
  amount_usdc: 10,
  tx_hash: HASH.toLowerCase(),
  chain: String(SupportedChainId.ARC_TESTNET),
  status: "pending",
  created_at: "2026-09-18T00:00:00Z",
  wallet_id: USER,
};

beforeEach(() => {
  admin.from.mockReset();
  admin.rpc.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("POST /api/transactions", () => {
  it("requires a signed-in user before doing anything else", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    const res = await call(validBody);
    expect(res.status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it.each([
    ["a malformed hash", { txHash: "0x1234" }],
    ["a non-hex hash", { txHash: `0x${"zz".repeat(32)}` }],
    ["an unsupported chain", { chainId: 1 }],
    ["a non-address wallet", { walletAddress: "0xabc" }],
    ["zero credits", { credits: 0, usdcAmount: 0 }],
    ["negative credits", { credits: -5, usdcAmount: -5 }],
    ["a string amount", { usdcAmount: "10" }],
    ["a non-address destination", { destinationAddress: "nope" }],
  ])("rejects %s", async (_name, override) => {
    const res = await call({ ...validBody, ...override });
    expect(res.status).toBe(400);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rejects a price the client made up", async () => {
    const res = await call({ ...validBody, credits: 1_000_000, usdcAmount: 1 });
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({
      error: "usdcAmount does not match the credits requested",
    });
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("rejects a destination that is not a platform wallet", async () => {
    queueTables(admin, { admin_wallets: [queryBuilder({ data: [] })] });
    const res = await call(validBody);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "Destination is not a platform wallet" });
  });

  it("records a pending row with a lower-cased hash and never credits", async () => {
    const insert = queryBuilder({ data: inserted });
    queueTables(admin, {
      admin_wallets: [queryBuilder({ data: [{ id: "w1" }] })],
      transactions: [insert],
    });

    const res = await call(validBody);
    expect(res.status).toBe(201);

    const row = insert.insert.mock.calls[0][0];
    expect(row).toMatchObject({
      transaction_type: "USER",
      user_id: "user-1",
      tx_hash: HASH.toLowerCase(),
      idempotency_key: `${SupportedChainId.ARC_TESTNET}:${HASH.toLowerCase()}`,
      status: "pending",
      credit_amount: 10,
      exchange_rate: 1,
      destination_address: ADMIN_WALLET,
    });
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("falls back to the primary admin wallet when no destination is sent", async () => {
    const insert = queryBuilder({ data: inserted });
    queueTables(admin, {
      admin_wallets: [queryBuilder({ data: { address: ADMIN_WALLET } })],
      transactions: [insert],
    });

    const body: Partial<typeof validBody> = { ...validBody };
    delete body.destinationAddress;
    const res = await call(body);
    expect(res.status).toBe(201);
    expect(insert.insert.mock.calls[0][0].destination_address).toBe(ADMIN_WALLET);
  });

  it("returns the existing row when its owner retries", async () => {
    queueTables(admin, {
      admin_wallets: [queryBuilder({ data: [{ id: "w1" }] })],
      transactions: [
        queryBuilder({ error: { message: "duplicate", code: "23505" } }),
        queryBuilder({ data: inserted }),
      ],
    });
    const res = await call(validBody);
    expect(res.status).toBe(200);
    expect((await res.json()).transactionId).toBe("tx-1");
  });

  it("does not hand another user's transaction to someone who replays its hash", async () => {
    queueTables(admin, {
      admin_wallets: [queryBuilder({ data: [{ id: "w1" }] })],
      transactions: [
        queryBuilder({ error: { message: "duplicate", code: "23505" } }),
        queryBuilder({ data: { ...inserted, user_id: "someone-else" } }),
      ],
    });
    const res = await call(validBody);
    expect(res.status).toBe(409);
    expect(JSON.stringify(await res.json())).not.toContain("tx-1");
  });

  it("does not leak database error details", async () => {
    queueTables(admin, {
      admin_wallets: [queryBuilder({ data: [{ id: "w1" }] })],
      transactions: [queryBuilder({ error: { message: "secret schema detail", code: "XX000" } })],
    });
    const res = await call(validBody);
    expect(res.status).toBe(500);
    expect(JSON.stringify(await res.json())).not.toContain("secret");
  });
});
