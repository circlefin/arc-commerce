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

import { AlertTriangle, Info } from "lucide-react";
import { useNetworkSupport } from "@/lib/wagmi/useNetworkSupport";
import { DEFAULT_CHAIN } from "@/lib/wagmi/config";
import { Button } from "@/components/ui/button";
import { useState } from "react";

export function UnsupportedNetworkNotice() {
  const {
    isConnected,
    isSupported,
    currentChainId,
    unsupportedReason,
    canSwitch,
    isSwitching,
    trySwitch,
  } = useNetworkSupport();
  const [dismissed, setDismissed] = useState(false);

  const isOnDefaultChain = currentChainId === DEFAULT_CHAIN.id;

  if (!isConnected || dismissed) return null;

  if (!isSupported) {
    return (
      <div className="w-full bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-200 px-4 py-3 text-sm flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="font-medium mb-0.5">Unsupported Network</div>
          <div className="opacity-90">
            {unsupportedReason ||
              "You are connected to a network that this app does not support."}
          </div>
          <div className="mt-2 flex gap-2">
            {canSwitch && (
              <Button
                size="sm"
                onClick={() => trySwitch(DEFAULT_CHAIN.id)}
                disabled={isSwitching}
              >
                {isSwitching ? "Switching..." : `Switch to ${DEFAULT_CHAIN.name}`}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!isOnDefaultChain) {
    return (
      <div className="w-full bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-200 px-4 py-3 text-sm flex items-start gap-3">
        <Info className="h-5 w-5 shrink-0" />
        <div className="flex-1">
          <div className="font-medium mb-0.5">Switch to {DEFAULT_CHAIN.name}</div>
          <div className="opacity-90">
            This app works best on {DEFAULT_CHAIN.name}. Please switch to continue.
          </div>
          <div className="mt-2 flex gap-2">
            {canSwitch && (
              <Button
                size="sm"
                onClick={() => trySwitch(DEFAULT_CHAIN.id)}
                disabled={isSwitching}
              >
                {isSwitching ? "Switching..." : `Switch to ${DEFAULT_CHAIN.name}`}
              </Button>
            )}
            <Button
              size="sm"
              variant="outline"
              onClick={() => setDismissed(true)}
            >
              Dismiss
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
