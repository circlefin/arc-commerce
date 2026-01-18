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

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { ConnectWalletButton } from "@/components/wallet/connect-wallet-button";
import { NetworkIndicator } from "@/components/wallet/network-indicator";
import { UsdcBalance } from "@/components/wallet/usdc-balance";
import { Separator } from "@/components/ui/separator";

export function WalletStatusCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Wallet Status</CardTitle>
        <CardDescription>
          Connect your wallet and check your network and USDC balance.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col space-y-3 text-sm">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Connection</span>
            <ConnectWalletButton />
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">Network</span>
            <NetworkIndicator />
          </div>
          <Separator />
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">USDC Balance</span>
            <UsdcBalance />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}