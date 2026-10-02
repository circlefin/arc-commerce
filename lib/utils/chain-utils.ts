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

import { SupportedChainId, CHAIN_TO_CHAIN_NAME } from "@/lib/chains";

export function getNetworkName(chainId: string | number): string {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

  if (isNaN(numericChainId)) {
    return `Chain ${chainId}`;
  }

  return CHAIN_TO_CHAIN_NAME[numericChainId] || `Chain ${chainId}`;
}

export function chainNameToId(chainName: string): number | undefined {
  const chainKey = chainName.replace(/-/g, '_');
  return SupportedChainId[chainKey as keyof typeof SupportedChainId];
}

export function chainIdToName(chainId: number): string | undefined {
  const chainIdToNameMap: Record<number, string> = {
    [SupportedChainId.ETH_SEPOLIA]: "ETH-SEPOLIA",
    [SupportedChainId.AVAX_FUJI]: "AVAX-FUJI",
    [SupportedChainId.BASE_SEPOLIA]: "BASE-SEPOLIA",
    [SupportedChainId.ARC_TESTNET]: "ARC-TESTNET"
  };
  return chainIdToNameMap[chainId];
}

export function getExplorerUrl(chainId: string | number, txHash?: string, address?: string): string | null {
  const numericChainId = typeof chainId === 'string' ? parseInt(chainId, 10) : chainId;

  const explorerBaseUrls: Record<number, string> = {
    [SupportedChainId.ETH_SEPOLIA]: "https://sepolia.etherscan.io",
    [SupportedChainId.AVAX_FUJI]: "https://testnet.snowtrace.io",
    [SupportedChainId.BASE_SEPOLIA]: "https://sepolia.basescan.org",
    [SupportedChainId.ARC_TESTNET]: "https://testnet.arcscan.app"
  };

  const baseUrl = explorerBaseUrls[numericChainId];
  if (!baseUrl) return null;

  if (txHash) {
    return `${baseUrl}/tx/${txHash}`;
  } else if (address) {
    return `${baseUrl}/address/${address}`;
  }

  return baseUrl;
}
