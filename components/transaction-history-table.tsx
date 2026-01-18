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

import { useState, useEffect } from "react";
import {
  ColumnFiltersState,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
  FilterFn,
} from "@tanstack/react-table";
import { startOfDay, endOfDay, isValid } from "date-fns";
import { Button } from "@/components/ui/button";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import type { TransactionRow } from "@/components/user-transactions-table/columns";
import { DataTable } from "@/components/user-transactions-table/table";
import { columns } from "@/components/user-transactions-table/columns";

interface ApiTransaction {
  id: string;
  created_at: string;
  credit_amount: string | number;
  amount_usdc: string | number;
  fee_usdc: string | number;
  status: "pending" | "confirmed" | "complete" | "failed";
  chain: string;
  tx_hash: string;
}

interface TransactionHistoryProps {
  showHeader?: boolean;      // optionally render heading / back button
  backHref?: string;         // backlink destination if header shown
  className?: string;
}

const dateBetweenFilterFn: FilterFn<TransactionRow> = (
  row,
  columnId,
  filterValue: [Date | undefined, Date | undefined]
) => {
  if (!Array.isArray(filterValue)) return true;

  const [from, to] = filterValue;
  if (!from && !to) return true;

  const rowDateRaw = row.getValue<string | Date>(columnId);
  if (!rowDateRaw) return false;

  const date = new Date(rowDateRaw);
  if (!isValid(date)) return false;

  const fromDate = from ? startOfDay(from) : null;
  const toDate = to ? endOfDay(to) : null;

  if (fromDate && toDate) return date >= fromDate && date <= toDate;
  if (fromDate) return date >= fromDate;
  if (toDate) return date <= toDate;
  return true;
};

export function TransactionHistory({
  showHeader = false,
  backHref = "/dashboard",
  className = "",
}: TransactionHistoryProps) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [data, setData] = useState<TransactionRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();

    async function load() {
      try {
        const resp = await fetch("/api/transactions");
        const json = await resp.json();
        if (cancelled) return;
        const rows: TransactionRow[] = ((json.data as ApiTransaction[]) || []).map((t) => ({
          id: t.id,
          date: new Date(t.created_at),
          credits: Number(t.credit_amount),
          usdcPaid: Number(t.amount_usdc),
          fee: Number(t.fee_usdc),
          status: t.status,
          network: t.chain,
          txHash: t.tx_hash,
        }));
        setData(rows);
      } catch (error) {
        console.error("Failed to load transactions:", error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();

    // Realtime subscription (INSERT + UPDATE on transactions)
    let channel: ReturnType<typeof supabase.channel> | null = null;

    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) return;
      
      channel = supabase
        .channel("transactions-realtime")
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "transactions" },
          (payload: { new: ApiTransaction }) => {
            const t = payload.new;
            setData((prev) => {
              if (prev.find((p) => p.id === t.id)) return prev;
              const row: TransactionRow = {
                id: t.id,
                date: new Date(t.created_at),
                credits: Number(t.credit_amount),
                usdcPaid: Number(t.amount_usdc),
                fee: Number(t.fee_usdc),
                status: t.status,
                network: t.chain,
                txHash: t.tx_hash,
              };
              return [row, ...prev];
            });
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "transactions" },
          (payload: { new: ApiTransaction }) => {
            const t = payload.new;
            setData((prev) =>
              prev.map((p) =>
                p.id === t.id
                  ? {
                    id: t.id,
                    date: new Date(t.created_at),
                    credits: Number(t.credit_amount),
                    usdcPaid: Number(t.amount_usdc),
                    fee: Number(t.fee_usdc),
                    status: t.status,
                    network: t.chain,
                    txHash: t.tx_hash,
                  }
                  : p
              )
            );
          }
        )
        .subscribe();
    }).catch((error) => {
      console.error("Failed to setup realtime subscription:", error);
    });

    return () => {
      cancelled = true;
      if (channel) {
        supabase.removeChannel(channel);
      }
    };
  }, []);

  const table = useReactTable({
    data,
    columns,
    filterFns: { dateBetween: dateBetweenFilterFn },
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
  });

  return (
    <div className={showHeader ? "container mx-auto py-10 " + className : "w-full space-y-4 " + className}>
      {showHeader && (
        <div className="space-y-4 mb-4">
          <Button asChild variant="outline" className="mb-4">
            <Link href={backHref}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Link>
          </Button>
          <h1 className="text-3xl font-bold tracking-tight">Credit Purchases</h1>
          <p className="text-muted-foreground">
            View and manage your transaction history.
          </p>
        </div>
      )}
      {loading ? (
        <div className="text-sm text-muted-foreground">Loading transactions...</div>
      ) : (
        <DataTable columns={columns} data={data} table={table} />
      )}
    </div>
  );
}
