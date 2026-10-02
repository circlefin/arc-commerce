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

import { describe, expect, it, vi } from "vitest";
import {
  encodeAbiParameters,
  encodeEventTopics,
  erc20Abi,
  TransactionReceiptNotFoundError,
  type Hex,
} from "viem";
import { SupportedChainId, CHAIN_IDS_TO_USDC_ADDRESSES } from "@/lib/chains";
import { verifyUsdcTransfer } from "@/lib/payments/verify-usdc-transfer";

const CHAIN_ID = SupportedChainId.ARC_TESTNET;
const USDC = CHAIN_IDS_TO_USDC_ADDRESSES[CHAIN_ID];
const USER = "0x1111111111111111111111111111111111111111";
const ADMIN = "0x2222222222222222222222222222222222222222";
const OTHER = "0x3333333333333333333333333333333333333333";
const TX_HASH = `0x${"ab".repeat(32)}` as Hex;

function transferLog(address: string, from: string, to: string, value: bigint) {
  return {
    address,
    topics: encodeEventTopics({
      abi: erc20Abi,
      eventName: "Transfer",
      args: { from: from as Hex, to: to as Hex },
    }),
    data: encodeAbiParameters([{ type: "uint256" }], [value]),
    blockNumber: 10n,
    blockHash: `0x${"cd".repeat(32)}`,
    logIndex: 0,
    transactionHash: TX_HASH,
    transactionIndex: 0,
    removed: false,
  };
}

function clientReturning(receipt: { status: string; logs: unknown[] }) {
  return {
    getTransactionReceipt: vi.fn().mockResolvedValue({
      blockNumber: 10n,
      blockHash: `0x${"cd".repeat(32)}`,
      ...receipt,
    }),
  } as never;
}

const base = {
  chainId: CHAIN_ID,
  txHash: TX_HASH,
  from: USER,
  to: ADMIN,
  minAmount: 5_000_000n,
};

describe("verifyUsdcTransfer", () => {
  it("verifies a matching USDC transfer and reports the block", async () => {
    const client = clientReturning({
      status: "success",
      logs: [transferLog(USDC, USER, ADMIN, 5_000_000n)],
    });
    expect(await verifyUsdcTransfer({ ...base, client })).toEqual({
      status: "verified",
      blockNumber: 10n,
      blockHash: `0x${"cd".repeat(32)}`,
    });
  });

  it("compares addresses case-insensitively", async () => {
    const client = clientReturning({
      status: "success",
      logs: [transferLog(USDC, USER, ADMIN, 5_000_000n)],
    });
    const result = await verifyUsdcTransfer({
      ...base,
      from: USER.toUpperCase().replace("0X", "0x"),
      client,
    });
    expect(result.status).toBe("verified");
  });

  it("sums several transfers in one transaction", async () => {
    const client = clientReturning({
      status: "success",
      logs: [
        transferLog(USDC, USER, ADMIN, 3_000_000n),
        transferLog(USDC, USER, ADMIN, 2_000_000n),
      ],
    });
    expect((await verifyUsdcTransfer({ ...base, client })).status).toBe("verified");
  });

  it.each([
    ["underpays", [transferLog(USDC, USER, ADMIN, 4_999_999n)]],
    ["pays a different recipient", [transferLog(USDC, USER, OTHER, 5_000_000n)]],
    ["is sent by a different wallet", [transferLog(USDC, OTHER, ADMIN, 5_000_000n)]],
    ["is emitted by a token other than USDC", [transferLog(OTHER, USER, ADMIN, 5_000_000n)]],
    ["has no transfers", []],
  ])("rejects a transaction that %s", async (_name, logs) => {
    const client = clientReturning({ status: "success", logs });
    expect(await verifyUsdcTransfer({ ...base, client })).toEqual({
      status: "invalid",
      reason: "no_matching_transfer",
    });
  });

  it("rejects a reverted transaction even if it carries matching logs", async () => {
    const client = clientReturning({
      status: "reverted",
      logs: [transferLog(USDC, USER, ADMIN, 5_000_000n)],
    });
    expect(await verifyUsdcTransfer({ ...base, client })).toEqual({
      status: "invalid",
      reason: "reverted",
    });
  });

  it("reports pending while the receipt does not exist yet", async () => {
    const client = {
      getTransactionReceipt: vi
        .fn()
        .mockRejectedValue(new TransactionReceiptNotFoundError({ hash: TX_HASH })),
    } as never;
    expect(await verifyUsdcTransfer({ ...base, client })).toEqual({
      status: "pending",
    });
  });

  it("rethrows RPC failures so a real payment is not wrongly rejected", async () => {
    const client = {
      getTransactionReceipt: vi.fn().mockRejectedValue(new Error("rpc down")),
    } as never;
    await expect(verifyUsdcTransfer({ ...base, client })).rejects.toThrow("rpc down");
  });

  it("rejects unsupported chains and malformed addresses without calling the RPC", async () => {
    const client = { getTransactionReceipt: vi.fn() };
    expect(
      await verifyUsdcTransfer({ ...base, chainId: 1, client: client as never })
    ).toEqual({ status: "invalid", reason: "unsupported_chain" });
    expect(
      await verifyUsdcTransfer({ ...base, from: "not-an-address", client: client as never })
    ).toEqual({ status: "invalid", reason: "no_matching_transfer" });
    expect(client.getTransactionReceipt).not.toHaveBeenCalled();
  });
});
