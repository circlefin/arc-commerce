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

import { useAccount } from "wagmi";
import { useUsdcBalance } from "@/lib/wagmi/useUsdcBalance";
import { Button } from "@/components/ui/button";

export function UsdcBalance() {
  const { isConnected } = useAccount();
  const {
    formatted,
    isLoading: usdcLoading,
    hasBalance,
    unsupported: usdcUnsupported,
    error: usdcError,
  } = useUsdcBalance();

  // If the wallet is not connected, we don't show anything.
  if (!isConnected) {
    return (
      <span className="text-muted-foreground italic">
        Connect wallet to see balance
      </span>
    );
  }

  if (usdcUnsupported) {
    return (
      <Button variant="outline" disabled size="sm">
        USDC N/A on this network
      </Button>
    );
  }

  if (usdcLoading) {
    return (
      <Button variant="outline" disabled size="sm">
        Loading balance...
      </Button>
    );
  }

  if (usdcError) {
    return (
      <Button variant="outline" disabled size="sm">
        Error fetching balance
      </Button>
    );
  }

  if (hasBalance === false) {
    return (
      <span className="text-sm text-yellow-600 dark:text-yellow-400">
        No USDC balance found.
      </span>
    );
  }

  if (hasBalance && formatted) {
    const display = Number(formatted).toLocaleString(undefined, {
      maximumFractionDigits: 2,
    });
    return (
      <Button variant="outline" disabled size="sm">
        {display} USDC
      </Button>
    );
  }

  // Fallback for any unhandled state
  return null;
}