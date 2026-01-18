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

import { useState } from "react";
import { ColumnDef, Row, Table } from "@tanstack/react-table";
import { Database } from "@/types/supabase";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { chainNameToId } from "@/lib/utils/chain-utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  ArrowUpDown,
  MoreHorizontal,
  Copy,
  ArrowUp,
  ArrowDown,
} from "lucide-react";
import { toast } from "sonner";
import { updateAdminWalletStatus } from "@/lib/actions/admin-wallets";
import { ClientDate } from "@/components/ui/client-date";

type Wallet = Database["public"]["Tables"]["admin_wallets"]["Row"];
type WalletStatus = Database["public"]["Enums"]["admin_wallet_status"];
export type ConfirmableAction = "DISABLED" | "ARCHIVED";

export const CopyableCell = ({
  value,
  href,
}: {
  value: string;
  href?: string;
}) => {
  const [hasCopied, setHasCopied] = useState(false);
  const [isTooltipOpen, setIsTooltipOpen] = useState(false);

  const copyToClipboard = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(value);
    setHasCopied(true);
    setIsTooltipOpen(true);

    setTimeout(() => {
      setHasCopied(false);
      setIsTooltipOpen(false);
    }, 2000);
  };

  const displayText = `${value.slice(0, 4)}...${value.slice(-4)}`;

  const TextElement = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="text-blue-500 hover:underline"
    >
      {displayText}
    </a>
  ) : (
    <span>{displayText}</span>
  );

  return (
    <div className="flex items-center gap-2">
      {TextElement}
      <TooltipProvider>
        <Tooltip open={isTooltipOpen} onOpenChange={setIsTooltipOpen}>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={copyToClipboard}
            >
              <Copy className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>{hasCopied ? "Copied!" : "Copy"}</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
};

const handleStatusUpdate = async (id: string, status: WalletStatus) => {
  const promise = updateAdminWalletStatus(id, status);
  toast.promise(promise, {
    loading: `Updating status to ${status}...`,
    success: "Wallet status updated successfully.",
    error: (err) => `Failed to update status: ${err.message}`,
  });
};

const ActionsCell = ({
  row,
  table,
}: {
  row: Row<Wallet>;
  table: Table<Wallet>;
}) => {
  const wallet = row.original;
  const openConfirmationDialog = table.options.meta?.openConfirmationDialog;
  const openTransferDialog = table.options.meta?.openTransferDialog;
  const openBalanceDialog = table.options.meta?.openBalanceDialog;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="h-8 w-8 p-0">
          <span className="sr-only">Open menu</span>
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuLabel>Actions</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => openBalanceDialog?.(wallet)}>
          Check Balance
        </DropdownMenuItem>
        {wallet.status === "ENABLED" && (
          <DropdownMenuItem onClick={() => openTransferDialog?.(wallet)}>
            Transfer Amount
          </DropdownMenuItem>
        )}
        {wallet.status !== "ENABLED" && (
          <DropdownMenuItem
            onClick={() => handleStatusUpdate(wallet.id, "ENABLED")}
          >
            Enable
          </DropdownMenuItem>
        )}
        {wallet.status !== "DISABLED" && (
          <DropdownMenuItem
            onClick={() => openConfirmationDialog?.(wallet, "DISABLED")}
          >
            Disable
          </DropdownMenuItem>
        )}
        {wallet.status !== "ARCHIVED" && (
          <DropdownMenuItem
            className="text-destructive"
            onClick={() => openConfirmationDialog?.(wallet, "ARCHIVED")}
          >
            Archive
          </DropdownMenuItem>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export const columns: ColumnDef<Wallet>[] = [
  {
    accessorKey: "label",
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
          Label
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
    cell: ({ row }) => {
      const label = row.original.label;
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="truncate max-w-[150px]">{label}</div>
            </TooltipTrigger>
            <TooltipContent>
              <p>{label}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    },
  },
  {
    accessorKey: "circle_wallet_id",
    header: "Circle Wallet ID",
    cell: ({ row }) => <CopyableCell value={row.original.circle_wallet_id} />,
  },
  {
    accessorKey: "address",
    header: "Address",
    cell: ({ row }) => {
      const address = row.original.address;
      const chain = row.original.chain;

      // Convert chain name to numeric ID for the utility function
      const chainId = chain ? chainNameToId(chain) : undefined;
      const { getExplorerUrl } = require("@/lib/utils/chain-utils");
      const explorerUrl = chainId
        ? getExplorerUrl(chainId, undefined, address)
        : `https://testnet.arcscan.app/address/${address}`;

      return (
        <CopyableCell
          value={address}
          href={explorerUrl || `https://testnet.arcscan.app/address/${address}`}
        />
      );
    },
  },
  {
    accessorKey: "chain",
    header: "Chain",
    cell: ({ row }) => (
      <div className="text-xs">{row.original.chain ?? "N/A"}</div>
    ),
  },
  {
    accessorKey: "status",
    header: "Status",
    cell: ({ row }) => {
      const status = row.original.status;
      const variant: "default" | "secondary" | "destructive" =
        status === "ENABLED"
          ? "default"
          : status === "DISABLED"
            ? "secondary"
            : "destructive";
      return <Badge variant={variant}>{status}</Badge>;
    },
  },
  {
    accessorKey: "created_at",
    header: "Created At",
    cell: ({ row }) => <ClientDate date={row.original.created_at} />,
  },
  {
    accessorKey: "updated_at",
    header: "Last Updated",
    cell: ({ row }) => <ClientDate date={row.original.updated_at} />,
  },
  {
    id: "actions",
    cell: ({ row, table }) => <ActionsCell row={row} table={table} />,
  },
];