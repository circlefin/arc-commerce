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

import { addDays, subDays } from "date-fns";

// Define the shape of our data
export type TransactionStatus = "pending" | "confirmed" | "failed";
export type Network = "Ethereum" | "Polygon" | "Base";

export interface TransactionEvent {
  id: string;
  timestamp: Date;
  status: TransactionStatus;
  description: string;
}

export interface PurchaseTransaction {
  id: string;
  date: Date;
  credits: number;
  usdcPaid: number;
  fee: number;
  status: TransactionStatus;
  network: Network;
  txHash: string;
  events: TransactionEvent[];
}

const statuses: TransactionStatus[] = ["confirmed", "pending", "failed"];
const networks: Network[] = ["Ethereum", "Polygon", "Base"];

function createMockTransaction(id: number): PurchaseTransaction {
  const status = statuses[id % statuses.length];

  // Use a fixed start date
  const date = subDays(new Date("2025-09-25T10:00:00Z"), id * 3);

  // Generate predictable values using the ID to ensure they are the same on server and client.
  const usdcPaid = parseFloat((((id * 13.37) % 200) + 10).toFixed(2));

  // Simple, predictable hash
  const txHash = `0x${id.toString(16).padStart(4, "0")}${"a".repeat(60)}`;

  const fee = parseFloat((usdcPaid * 0.01).toFixed(2));
  const credits = Math.floor(usdcPaid);

  return {
    id: `txn_${id}`,
    date,
    credits,
    usdcPaid,
    fee,
    status,
    network: networks[id % networks.length],
    txHash,
    events: [
      {
        id: `evt1_${id}`,
        timestamp: date,
        status: "pending",
        description: "Transaction initiated by user.",
      },
      ...(status !== "pending"
        ? [
          {
            id: `evt2_${id}`,
            timestamp: addDays(date, 1),
            status: status,
            description: `Transaction ${status} on-chain.`,
          },
        ]
        : []),
    ],
  };
}

export const mockTransactions: PurchaseTransaction[] = Array.from(
  { length: 50 },
  (_, i) => createMockTransaction(i + 1)
);