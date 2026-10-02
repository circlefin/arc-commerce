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
import { jsonRequest, queryBuilder, queueTables } from "../helpers/supabase-mock";

const admin = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const getUser = vi.hoisted(() => vi.fn());
const verify = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin-client", () => ({ supabaseAdminClient: admin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));
vi.mock("@/lib/payments/verify-usdc-transfer", () => ({ verifyUsdcTransfer: verify }));

import { PATCH } from "@/app/api/transactions/[id]/route";

const HASH = `0x${"ab".repeat(32)}`;
const pendingTx = {
  id: "tx-1",
  user_id: "user-1",
  status: "pending",
  direction: "credit",
  credit_amount: 10,
  amount_usdc: 10,
  chain: "5042002",
  tx_hash: HASH,
  wallet_id: "0x1111111111111111111111111111111111111111",
  destination_address: "0x2222222222222222222222222222222222222222",
  updated_at: "2026-09-18T00:00:00Z",
  created_at: "2026-09-18T00:00:00Z",
  metadata: {},
};

const call = (body: unknown = { status: "complete", txHash: HASH }) =>
  PATCH(
    new NextRequest(jsonRequest("http://localhost/api/transactions/tx-1", "PATCH", body)),
    { params: Promise.resolve({ id: "tx-1" }) }
  );

const withTx = (tx: object | null, ...more: ReturnType<typeof queryBuilder>[]) =>
  queueTables(admin, {
    transactions: [queryBuilder({ data: tx, error: tx ? null : { message: "none" } }), ...more],
  });

beforeEach(() => {
  admin.from.mockReset();
  admin.rpc.mockReset();
  verify.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
  admin.rpc.mockResolvedValue({ data: "credited", error: null });
});

describe("PATCH /api/transactions/[id]", () => {
  it("requires a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await call()).status).toBe(401);
    expect(verify).not.toHaveBeenCalled();
  });

  it("only accepts status=complete and a well-formed hash", async () => {
    expect((await call({ status: "failed", txHash: HASH })).status).toBe(400);
    expect((await call({ status: "complete", txHash: "0x12" })).status).toBe(400);
  });

  it("refuses to touch a transaction owned by someone else", async () => {
    withTx({ ...pendingTx, user_id: "someone-else" });
    expect((await call()).status).toBe(403);
    expect(verify).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("refuses a hash that does not match the recorded one", async () => {
    withTx(pendingTx);
    const res = await call({ status: "complete", txHash: `0x${"cd".repeat(32)}` });
    expect(res.status).toBe(400);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("is a no-op for a purchase that is already settled", async () => {
    withTx({ ...pendingTx, status: "complete" });
    const res = await call();
    expect(res.status).toBe(200);
    expect(verify).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("verifies the recorded wallet, recipient and amount on-chain", async () => {
    withTx(pendingTx, queryBuilder({ data: { ...pendingTx, status: "complete" } }));
    verify.mockResolvedValue({ status: "verified", blockNumber: 7n, blockHash: "0xbeef" });

    await call();

    expect(verify).toHaveBeenCalledWith({
      chainId: 5042002,
      txHash: HASH,
      from: pendingTx.wallet_id,
      to: pendingTx.destination_address,
      minAmount: 10_000_000n,
    });
  });

  it("settles through the atomic SQL function once verified", async () => {
    withTx(pendingTx, queryBuilder({ data: { ...pendingTx, status: "complete" } }));
    verify.mockResolvedValue({ status: "verified", blockNumber: 7n, blockHash: "0xbeef" });

    const res = await call();

    expect(res.status).toBe(200);
    expect(admin.rpc).toHaveBeenCalledTimes(1);
    expect(admin.rpc).toHaveBeenCalledWith("settle_user_transaction", {
      p_transaction_id: "tx-1",
      p_new_status: "complete",
      p_metadata: {
        metamask_confirmation: expect.objectContaining({
          block_number: 7,
          block_hash: "0xbeef",
        }),
      },
    });
  });

  it("ignores block details supplied by the client", async () => {
    withTx(pendingTx, queryBuilder({ data: { ...pendingTx, status: "complete" } }));
    verify.mockResolvedValue({ status: "verified", blockNumber: 7n, blockHash: "0xbeef" });

    await call({ status: "complete", txHash: HASH, blockNumber: 999, blockHash: "0xfake" });

    const metadata = admin.rpc.mock.calls[0][1].p_metadata.metamask_confirmation;
    expect(metadata.block_number).toBe(7);
    expect(metadata.block_hash).toBe("0xbeef");
  });

  it("answers 409 and grants nothing while the transfer is unconfirmed", async () => {
    withTx(pendingTx);
    verify.mockResolvedValue({ status: "pending" });
    expect((await call()).status).toBe(409);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("answers 422 and grants nothing when the transfer does not match", async () => {
    withTx(pendingTx);
    verify.mockResolvedValue({ status: "invalid", reason: "no_matching_transfer" });
    const res = await call();
    expect(res.status).toBe(422);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("answers 502 (not 4xx) when the RPC is unreachable", async () => {
    withTx(pendingTx);
    verify.mockRejectedValue(new Error("ECONNREFUSED"));
    expect((await call()).status).toBe(502);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("surfaces a settlement failure instead of pretending success", async () => {
    withTx(pendingTx);
    verify.mockResolvedValue({ status: "verified", blockNumber: 7n, blockHash: "0xbeef" });
    admin.rpc.mockResolvedValue({ data: null, error: { message: "boom" } });
    expect((await call()).status).toBe(500);
  });
});
