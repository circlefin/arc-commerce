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
import { queryBuilder, queueTables } from "../helpers/supabase-mock";

const admin = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const getAdminUser = vi.hoisted(() => vi.fn());
const kit = vi.hoisted(() => ({ send: vi.fn(), bridge: vi.fn() }));
const createWallet = vi.hoisted(() => vi.fn());
const readContract = vi.hoisted(() => vi.fn());

vi.mock("@/lib/supabase/admin-client", () => ({ supabaseAdminClient: admin }));
vi.mock("@/lib/auth/admin", () => ({ getAdminUser }));
vi.mock("@/lib/circle/app-kit-client", () => ({
  getAppKit: () => kit,
  createAdapter: () => ({}),
}));
vi.mock("@/lib/circle/wallets", () => ({ createWalletSetWithWallet: createWallet }));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("viem", async (importOriginal) => ({
  ...(await importOriginal<typeof import("viem")>()),
  createPublicClient: () => ({ readContract }),
}));

import {
  createAdminWallet,
  getAdminWalletAddresses,
  getWalletBalance,
  transferFromAdminWallet,
  transferFromAdminWalletCCTP,
  updateAdminWalletStatus,
} from "@/lib/actions/admin-wallets";

const SOURCE = { id: "w-src", chain: "ARC-TESTNET", address: "0xsource" };
const DEST = "0x2222222222222222222222222222222222222222";
const BURN_HASH = `0x${"11".repeat(32)}`;
const MINT_HASH = `0x${"22".repeat(32)}`;

/** Queues: source wallet lookup, then the ADMIN transaction insert. */
function queueSend(insertResult = { error: null }) {
  const insert = queryBuilder(insertResult);
  queueTables(admin, {
    admin_wallets: [queryBuilder({ data: SOURCE })],
    transactions: [insert],
  });
  return insert;
}

/** Queues: source wallet, destination wallet (other chain), then the insert. */
function queueBridge(insertResult = { error: null }) {
  const insert = queryBuilder(insertResult);
  queueTables(admin, {
    admin_wallets: [
      queryBuilder({ data: SOURCE }),
      queryBuilder({ data: { chain: "ETH-SEPOLIA" } }),
    ],
    transactions: [insert],
  });
  return insert;
}

beforeEach(() => {
  admin.from.mockReset();
  kit.send.mockReset();
  kit.bridge.mockReset();
  createWallet.mockReset();
  readContract.mockReset();
  getAdminUser.mockResolvedValue({ id: "admin", email: "admin@admin.com" });
});

describe("authorization", () => {
  beforeEach(() => {
    getAdminUser.mockResolvedValue(null);
  });

  it("blocks every mutating action for non-admins before any side effect", async () => {
    const form = new FormData();
    form.set("label", "Treasury");
    form.set("blockchain", "ARC-TESTNET");

    const results = await Promise.all([
      createAdminWallet(form),
      updateAdminWalletStatus("w1", "DISABLED"),
      transferFromAdminWallet("cw1", DEST, "1"),
      transferFromAdminWalletCCTP("cw1", DEST, "1"),
      getWalletBalance("0xabc", "ARC-TESTNET"),
    ]);

    for (const result of results) {
      expect(result).toEqual({ error: "Unauthorized" });
    }
    expect(await getAdminWalletAddresses()).toEqual([]);
    expect(admin.from).not.toHaveBeenCalled();
    expect(kit.send).not.toHaveBeenCalled();
    expect(kit.bridge).not.toHaveBeenCalled();
    expect(createWallet).not.toHaveBeenCalled();
    expect(readContract).not.toHaveBeenCalled();
  });
});

describe("transferFromAdminWallet (send)", () => {
  it("records a complete ADMIN row using the numeric chain id", async () => {
    const insert = queueSend();
    kit.send.mockResolvedValue({ name: "Send", state: "success", txHash: BURN_HASH });

    const result = await transferFromAdminWallet("cw1", DEST, "2.5");

    expect(result).toEqual({ success: true, txHash: BURN_HASH, warning: undefined });
    expect(insert.insert.mock.calls[0][0]).toMatchObject({
      transaction_type: "ADMIN",
      chain: "5042002",
      tx_hash: BURN_HASH,
      circle_transaction_id: BURN_HASH,
      idempotency_key: `admin:${BURN_HASH}`,
      status: "complete",
      amount_usdc: 2.5,
      wallet_id: SOURCE.address,
      destination_address: DEST,
    });
  });

  it("records a failed send as failed and reports the error", async () => {
    const insert = queueSend();
    kit.send.mockResolvedValue({ name: "Send", state: "error", errorMessage: "insufficient funds" });

    const result = await transferFromAdminWallet("cw1", DEST, "1");

    expect(result.error).toBe("insufficient funds");
    const row = insert.insert.mock.calls[0][0];
    expect(row.status).toBe("failed");
    expect(row.tx_hash).toBeNull();
    expect(row.circle_transaction_id).toMatch(/^send:/);
  });

  it("keeps a still-pending send pending", async () => {
    const insert = queueSend();
    kit.send.mockResolvedValue({ name: "Send", state: "pending", txHash: BURN_HASH });
    await transferFromAdminWallet("cw1", DEST, "1");
    expect(insert.insert.mock.calls[0][0].status).toBe("pending");
  });

  it("warns, rather than failing, when the money moved but the row could not be saved", async () => {
    queueSend({ error: { message: "db down" } as never });
    kit.send.mockResolvedValue({ name: "Send", state: "success", txHash: BURN_HASH });

    const result = await transferFromAdminWallet("cw1", DEST, "1");

    expect(result.success).toBe(true);
    expect(result.warning).toMatch(/could not be saved/);
  });

  it("rejects an unsupported source chain before calling App Kit", async () => {
    queueTables(admin, {
      admin_wallets: [queryBuilder({ data: { ...SOURCE, chain: "SOL-DEVNET" } })],
    });
    const result = await transferFromAdminWallet("cw1", DEST, "1");
    expect(result.error).toMatch(/Unsupported source chain/);
    expect(kit.send).not.toHaveBeenCalled();
  });
});

describe("transferFromAdminWalletCCTP (bridge)", () => {
  it("records the source-chain burn hash, not the destination mint hash", async () => {
    const insert = queueBridge();
    kit.bridge.mockResolvedValue({
      state: "success",
      steps: [
        { name: "Approve", state: "success", txHash: `0x${"00".repeat(32)}` },
        { name: "Burn", state: "success", txHash: BURN_HASH },
        { name: "Mint", state: "success", txHash: MINT_HASH },
      ],
    });

    const result = await transferFromAdminWalletCCTP("cw1", DEST, "5");

    expect(result.txHash).toBe(BURN_HASH);
    expect(insert.insert.mock.calls[0][0]).toMatchObject({
      tx_hash: BURN_HASH,
      status: "complete",
      chain: "5042002",
    });
  });

  it("never invents a hash: without one it generates a unique reference", async () => {
    const first = queueBridge();
    kit.bridge.mockResolvedValue({ state: "success", steps: [] });
    await transferFromAdminWalletCCTP("cw1", DEST, "5");

    const second = queueBridge();
    await transferFromAdminWalletCCTP("cw1", DEST, "5");

    const rowA = first.insert.mock.calls[0][0];
    const rowB = second.insert.mock.calls[0][0];
    expect(rowA.tx_hash).toBeNull();
    expect(rowA.circle_transaction_id).toMatch(/^bridge:/);
    expect(rowA.circle_transaction_id).not.toContain("cw1"); // not the wallet id
    // Two bridges from the same wallet must not collide on the unique key.
    expect(rowA.idempotency_key).not.toBe(rowB.idempotency_key);
  });

  it("records an errored bridge as failed and returns the step's error", async () => {
    const insert = queueBridge();
    kit.bridge.mockResolvedValue({
      state: "error",
      steps: [
        { name: "Burn", state: "success", txHash: BURN_HASH },
        { name: "Mint", state: "error", errorMessage: "attestation timed out" },
      ],
    });

    const result = await transferFromAdminWalletCCTP("cw1", DEST, "5");

    expect(result.error).toBe("attestation timed out");
    expect(insert.insert.mock.calls[0][0].status).toBe("failed");
  });

  it("fails clearly when the destination is not a known admin wallet", async () => {
    queueTables(admin, {
      admin_wallets: [
        queryBuilder({ data: SOURCE }),
        queryBuilder({ data: null, error: { message: "no rows" } }),
      ],
    });
    const result = await transferFromAdminWalletCCTP("cw1", DEST, "5");
    expect(result.error).toMatch(/Could not resolve destination chain/);
    expect(kit.bridge).not.toHaveBeenCalled();
  });
});

describe("getWalletBalance", () => {
  it("formats the on-chain balance exactly", async () => {
    readContract.mockResolvedValue(1_234_567n);
    const result = await getWalletBalance("0xabc", "ARC-TESTNET");
    expect(result.balances?.[0]).toMatchObject({
      amount: "1.234567",
      token: { symbol: "USDC", decimals: 6, blockchain: "ARC-TESTNET" },
    });
  });

  it("does not lose precision on large balances", async () => {
    readContract.mockResolvedValue(9_007_199_254_740_993_000_000n);
    const result = await getWalletBalance("0xabc", "ARC-TESTNET");
    expect(result.balances?.[0].amount).toBe("9007199254740993");
  });

  it("rejects unsupported chains", async () => {
    expect((await getWalletBalance("0xabc", "SOL-DEVNET")).error).toMatch(/Unsupported chain/);
  });
});

describe("createAdminWallet", () => {
  it("creates the wallet through the Circle helper and stores it", async () => {
    createWallet.mockResolvedValue({ id: "cw9", address: "0xnew", blockchain: "ARC-TESTNET" });
    const insert = queryBuilder({ error: null });
    queueTables(admin, { admin_wallets: [insert] });

    const form = new FormData();
    form.set("label", " Treasury ");
    form.set("blockchain", "ARC-TESTNET");

    expect(await createAdminWallet(form)).toEqual({ success: true });
    expect(createWallet).toHaveBeenCalledWith("admin-wallet- Treasury ", "ARC-TESTNET");
    expect(insert.insert).toHaveBeenCalledWith({
      circle_wallet_id: "cw9",
      label: "Treasury",
      address: "0xnew",
      chain: "ARC-TESTNET",
    });
  });

  it("validates the label", async () => {
    const form = new FormData();
    form.set("label", "ab");
    form.set("blockchain", "ARC-TESTNET");
    expect((await createAdminWallet(form)).error).toMatch(/at least 3/);
    expect(createWallet).not.toHaveBeenCalled();
  });
});
