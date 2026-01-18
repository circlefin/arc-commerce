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

"use client";

import { useMemo } from "react";
import { useAccount, useChainId, useReadContract } from "wagmi";
import { erc20Abi, formatUnits } from "viem";
import { getUsdcAddress } from "@/lib/wagmi/usdcAddresses";

export interface UsdcBalanceResult {
  usdcAddress?: `0x${string}`;
  balance: bigint | null;
  isLoading: boolean;
  error?: Error;
  formatted: string | null;
  hasBalance: boolean | null;
  unsupported: boolean;
}

/**
 * Reads the connected wallet's USDC balance on the current chain (if supported).
 */
export function useUsdcBalance(): UsdcBalanceResult {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();

  const usdcAddress = getUsdcAddress(chainId);
  const unsupported = Boolean(chainId && !usdcAddress);
  const enabled = Boolean(isConnected && address && usdcAddress);

  const { data, isLoading, error } = useReadContract({
    address: usdcAddress,
    abi: erc20Abi,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId,
    query: {
      enabled,
      staleTime: 15_000,
      refetchOnWindowFocus: true,
    },
  });

  const { balance, formatted, hasBalance } = useMemo(() => {
    if (!data) {
      return {
        balance: null,
        formatted: null,
        hasBalance: null as boolean | null,
      };
    }
    const raw = data as bigint;
    const has = raw > 0n;
    return {
      balance: raw,
      formatted: formatUnits(raw, 6),
      hasBalance: has,
    };
  }, [data]);

  return {
    usdcAddress,
    balance,
    isLoading,
    error: error as Error | undefined,
    formatted,
    hasBalance,
    unsupported,
  };
}
