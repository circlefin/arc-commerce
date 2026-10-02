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

import {
  createPublicClient,
  erc20Abi,
  http,
  isAddress,
  isAddressEqual,
  parseEventLogs,
  TransactionReceiptNotFoundError,
  type Hex,
  type PublicClient,
} from "viem";
import { CHAIN_DB_TO_RPC, CHAIN_IDS_TO_USDC_ADDRESSES } from "@/lib/chains";
import { chainIdToName } from "@/lib/utils/chain-utils";

export type UsdcTransferVerification =
  | { status: "verified"; blockNumber: bigint; blockHash: Hex }
  /** The transaction is not mined yet (or the RPC has not seen it). Retry later. */
  | { status: "pending" }
  | {
      status: "invalid";
      reason: "unsupported_chain" | "reverted" | "no_matching_transfer";
    };

export interface VerifyUsdcTransferParams {
  chainId: number;
  txHash: Hex;
  /** Address that must have sent the USDC. */
  from: string;
  /** Address that must have received the USDC. */
  to: string;
  /** Minimum total USDC (6-decimal base units) that must have moved from `from` to `to`. */
  minAmount: bigint;
  /** Injectable for tests; defaults to a public client on the chain's RPC. */
  client?: Pick<PublicClient, "getTransactionReceipt">;
}

/**
 * Confirms on-chain that `txHash` succeeded and moved at least `minAmount` USDC
 * from `from` to `to`. This is the only thing that should ever justify crediting
 * a user: the API never trusts amounts or hashes supplied by the browser.
 *
 * Throws on transport errors (RPC down) so callers can answer 5xx rather than
 * wrongly rejecting a real payment.
 */
export async function verifyUsdcTransfer({
  chainId,
  txHash,
  from,
  to,
  minAmount,
  client,
}: VerifyUsdcTransferParams): Promise<UsdcTransferVerification> {
  const usdcAddress = CHAIN_IDS_TO_USDC_ADDRESSES[chainId];
  const rpcUrl = CHAIN_DB_TO_RPC[chainIdToName(chainId) ?? ""];
  if (!usdcAddress || (!client && !rpcUrl)) {
    return { status: "invalid", reason: "unsupported_chain" };
  }
  if (!isAddress(from, { strict: false }) || !isAddress(to, { strict: false })) {
    return { status: "invalid", reason: "no_matching_transfer" };
  }

  const rpc = client ?? createPublicClient({ transport: http(rpcUrl) });

  let receipt;
  try {
    receipt = await rpc.getTransactionReceipt({ hash: txHash });
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) {
      return { status: "pending" };
    }
    throw error;
  }

  if (receipt.status !== "success") {
    return { status: "invalid", reason: "reverted" };
  }

  const transfers = parseEventLogs({
    abi: erc20Abi,
    eventName: "Transfer",
    logs: receipt.logs,
  });

  let moved = 0n;
  for (const log of transfers) {
    if (
      isAddressEqual(log.address, usdcAddress) &&
      isAddressEqual(log.args.from, from) &&
      isAddressEqual(log.args.to, to)
    ) {
      moved += log.args.value;
    }
  }

  if (moved < minAmount) {
    return { status: "invalid", reason: "no_matching_transfer" };
  }

  return {
    status: "verified",
    blockNumber: receipt.blockNumber,
    blockHash: receipt.blockHash,
  };
}
