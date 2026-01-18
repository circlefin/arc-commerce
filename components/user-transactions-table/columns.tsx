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

export interface TransactionRow {
  id: string;
  date: Date;
  credits: number;
  usdcPaid: number;
  fee: number;
  status: "pending" | "confirmed" | "complete" | "failed";
  network: string;
  txHash: string;
}
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowUpDown, ExternalLink, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { getNetworkName, getExplorerUrl } from "@/lib/utils/chain-utils";

export const columns: ColumnDef<TransactionRow>[] = [
  {
    accessorKey: "date",
    header: ({ column }) => {
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => {
            if (column.getIsSorted() === "desc") {
              column.clearSorting();
            } else {
              column.toggleSorting(column.getIsSorted() === "asc");
            }
          }}
        >
          Date
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => format(row.original.date, "PP"),
    filterFn: "dateBetween",
  },
  {
    accessorKey: "credits",
    header: "Credits",
    cell: ({ row }) => row.original.credits.toLocaleString(),
  },
  {
    accessorKey: "usdcPaid",
    header: ({ column }) => {
      const sortDirection = column.getIsSorted();
      return (
        <Button
          variant="ghost"
          onClick={() => {
            if (column.getIsSorted() === "desc") {
              column.clearSorting();
            } else {
              column.toggleSorting(column.getIsSorted() === "asc");
            }
          }}
        >
          USDC Paid
          {sortDirection === "asc" ? (
            <ArrowUp className="ml-2 h-4 w-4" />
          ) : sortDirection === "desc" ? (
            <ArrowDown className="ml-2 h-4 w-4" />
          ) : (
            <ArrowUpDown className="ml-2 h-4 w-4" />
          )}
        </Button>
      );
    },
    cell: ({ row }) => `$${row.original.usdcPaid.toFixed(2)}`,
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
    accessorKey: "network",
    header: "Network",
    cell: ({ row }) => getNetworkName(row.original.network),
  },
  {
    accessorKey: "txHash",
    header: "Transaction",
    cell: ({ row }) => {
      const explorerUrl = getExplorerUrl(row.original.network, row.original.txHash);
      return (
        <a
          href={explorerUrl || "#"}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex items-center gap-2 text-blue-500 hover:underline"
        >
          {row.original.txHash.slice(0, 6)}...{row.original.txHash.slice(-4)}
          <ExternalLink className="h-4 w-4" />
        </a>
      );
    },
  },
];
