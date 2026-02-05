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

import { useState, useEffect, useMemo } from "react";
import { useAccount, useConnect, useDisconnect } from "wagmi";
import { Button } from "@/components/ui/button";
import { Copy, Check } from "lucide-react";
import { toast } from "sonner";
import { DEFAULT_CHAIN } from "@/lib/wagmi/config";

export function ConnectWalletButton() {
  const { address, isConnected } = useAccount();
  const { connect, connectors, status: connectStatus } = useConnect();
  const { disconnect } = useDisconnect();

  const [isClient, setIsClient] = useState(false);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setIsClient(true);
  }, []);

  const walletConnector = useMemo(
    () => connectors.find((c) => c.id === "injected"),
    [connectors]
  );

  function shortAddress(addr: string) {
    return addr.slice(0, 6) + "..." + addr.slice(-4);
  }

  // On the server, and for the initial client render, show a neutral placeholder.
  if (!isClient) {
    return (
      <Button variant="outline" disabled size="sm">
        Loading...
      </Button>
    );
  }

  // From this point on, we are on the client and can safely check window.ethereum
  if (!(window as { ethereum?: unknown }).ethereum) {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={() =>
          window.open(
            "https://metamask.io/download/",
            "_blank",
            "noopener,noreferrer"
          )
        }
      >
        Install MetaMask
      </Button>
    );
  }

  if (!isConnected) {
    return (
      <Button
        size="sm"
        disabled={!walletConnector || connectStatus === "pending"}
        onClick={() =>
          walletConnector && connect({ connector: walletConnector, chainId: DEFAULT_CHAIN.id })
        }
      >
        {connectStatus === "pending" ? "Connecting..." : "Connect Wallet"}
      </Button>
    );
  }

  const copyAddress = async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      toast.success("Address copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy address");
    }
  };

  return (
    <div className="flex items-center gap-2">
      <Button variant="secondary" size="sm" onClick={copyAddress} title={address}>
        {address ? shortAddress(address) : "Connected"}
        {copied ? (
          <Check className="w-3 h-3 ml-1" />
        ) : (
          <Copy className="w-3 h-3 ml-1" />
        )}
      </Button>
      <Button variant="outline" size="sm" onClick={() => disconnect()}>
        Disconnect
      </Button>
    </div>
  );
}
