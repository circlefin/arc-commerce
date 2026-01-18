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

import { WalletStatusCard } from "@/components/wallet/wallet-status-card";
import { PurchaseCreditsCard } from "@/components/wallet/purchase-credits-card";
import { TransactionHistory } from "@/components/transaction-history-table";

export function UserDashboard() {
  return (
    <div className="flex-1 w-full flex flex-col gap-8 items-start">
      {/* Page Header */}
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">
          Connect your wallet to purchase credits and view your history.
        </p>
      </div>

      {/* Scalable Grid Layout for Cards */}
      <div className="w-full grid grid-cols-1 lg:grid-cols-2 gap-8">
        <WalletStatusCard />
        <PurchaseCreditsCard />
      </div>

      {/* Section for the Transaction History Table */}
      <div className="w-full">
        <TransactionHistory />
      </div>
    </div>
  );
}