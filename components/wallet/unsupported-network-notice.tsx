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
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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

  if (!isConnected || dismissed || (isSupported && isOnDefaultChain)) {
    return null;
  }

  return (
    <Alert variant={isSupported ? "default" : "destructive"} className="w-96">
      {isSupported ? <Info /> : <AlertTriangle />}
      <AlertTitle>
        {isSupported ? `Switch to ${DEFAULT_CHAIN.name}` : "Unsupported Network"}
      </AlertTitle>
      <AlertDescription>
        <p>
          {isSupported
            ? `This app works best on ${DEFAULT_CHAIN.name}. Please switch to continue.`
            : unsupportedReason ||
              "You are connected to a network that this app does not support."}
        </p>
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
          <Button size="sm" variant="outline" onClick={() => setDismissed(true)}>
            Dismiss
          </Button>
        </div>
      </AlertDescription>
    </Alert>
  );
}
