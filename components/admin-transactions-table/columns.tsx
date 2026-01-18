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

import { ColumnDef } from "@tanstack/react-table";
import { Badge } from "@/components/ui/badge";
import { CopyableCell } from "@/components/admin-wallets-table/columns";
import { AdminTransaction } from "@/types/admin-transaction";
import { getExplorerUrl } from "@/lib/utils/chain-utils";
import { ClientDate } from "@/components/ui/client-date";

export const columns: ColumnDef<AdminTransaction, unknown>[] = [
  {
    accessorKey: "circle_transaction_id",
    header: "Transaction ID",
    cell: ({ row }) => (
      <CopyableCell
        value={row.original.circle_transaction_id || row.original.id}
      />
    ),
  },
  {
    accessorKey: "source_wallet",
    header: "Source",
    cell: ({ row }) => {
      // For USER transactions, show the user's wallet_id (truncated)
      if (row.original.transaction_type === "USER" && row.original.wallet_id) {
        const wallet = row.original.wallet_id;
        return (
          <CopyableCell
            value={wallet}
          />
        );
      }
      // For ADMIN transactions, show the admin wallet label
      return row.original.source_wallet?.label ?? "N/A";
    },
  },
  {
    accessorKey: "destination_address",
    header: "Destination",
    cell: ({ row }) => {
      const chain = row.original.chain;
      const address = row.original.destination_address;

      const explorerUrl = getExplorerUrl(chain, undefined, address);

      return (
        <CopyableCell
          value={address}
          href={explorerUrl || `https://testnet.arcscan.app/address/${address}`}
        />
      );
    },
  },
  {
    accessorKey: "amount_usdc",
    header: "Amount",
    cell: ({ row }) => {
      const amount = row.original.amount_usdc || row.original.amount || 0;
      return `${amount.toLocaleString()} ${row.original.asset}`;
    },
  },
  {
    accessorKey: "transaction_type",
    header: "Type",
    cell: ({ row }) => {
      const type = row.original.transaction_type;
      // Using a Badge for consistency and readability
      return type;
    },
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status.toUpperCase();

      // Define status-specific styling for better visibility in both themes
      const getStatusStyle = () => {
        switch (status) {
          case "COMPLETE":
          case "COMPLETED":
            return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100 border-green-300 dark:border-green-700";
          case "CONFIRMED":
            return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100 border-blue-300 dark:border-blue-700";
          case "PENDING":
            return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-100 border-yellow-300 dark:border-yellow-700";
          case "FAILED":
            return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100 border-red-300 dark:border-red-700";
          default:
            return "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-100 border-gray-300 dark:border-gray-700";
        }
      };

      return (
        <Badge variant="outline" className={getStatusStyle()}>
          {status}
        </Badge>
      );
    },
  },
  {
    accessorKey: "created_at",
    header: "Timestamp",
    cell: ({ row }) => <ClientDate date={row.original.created_at} />,
  },
];