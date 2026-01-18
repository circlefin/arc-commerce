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

import { useState, useMemo } from "react";
import { useFormStatus } from "react-dom";
import {
  ColumnDef,
  ColumnFiltersState,
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  SortingState,
  useReactTable,
} from "@tanstack/react-table";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PlusCircle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  createAdminWallet,
  updateAdminWalletStatus,
} from "@/lib/actions/admin-wallets";
import { AdminWalletsToolbar } from "@/components/admin-wallets-table/toolbar";
import { Database } from "@/types/supabase";
import { ConfirmableAction } from "@/components/admin-wallets-table/columns";
import { TransferDialog } from "@/components/admin-wallets-table/transfer-dialog";
import { BalanceDialog } from "@/components/admin-wallets-table/balance-dialog";

type Wallet = Database["public"]["Tables"]["admin_wallets"]["Row"];

const SUPPORTED_CHAINS = [
  { id: "ARC-TESTNET", name: "Arc Testnet" },
  { id: "AVAX-FUJI", name: "Avalanche Fuji" },
  { id: "BASE-SEPOLIA", name: "Base Sepolia" },
];

interface AdminWalletsTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
}

function CreateWalletSubmitButton({ isFormValid }: { isFormValid: boolean }) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" disabled={pending || !isFormValid}>
      {pending ? (
        <>
          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          Creating...
        </>
      ) : (
        "Create Wallet"
      )}
    </Button>
  );
}

export function AdminWalletsTable<TData, TValue>({
  columns,
  data,
}: AdminWalletsTableProps<TData, TValue>) {
  const [sorting, setSorting] = useState<SortingState>([]);
  const [columnFilters, setColumnFilters] =
    useState<ColumnFiltersState>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const [newWalletLabel, setNewWalletLabel] = useState("");
  const [newWalletBlockchain, setNewWalletBlockchain] = useState("");

  const [confirmationState, setConfirmationState] = useState<{
    wallet: Wallet;
    action: ConfirmableAction;
  } | null>(null);

  const [transferSourceWallet, setTransferSourceWallet] =
    useState<Wallet | null>(null);

  const [walletForBalanceCheck, setWalletForBalanceCheck] =
    useState<Wallet | null>(null);

  const confirmationDetails: Record<
    ConfirmableAction,
    { title: string; description: string; actionText: string }
  > = {
    DISABLED: {
      title: "Are you sure you want to disable this wallet?",
      description:
        "This will prevent the wallet from being used for any new transactions. This action can be undone.",
      actionText: "Yes, Disable",
    },
    ARCHIVED: {
      title: "Are you sure you want to archive this wallet?",
      description:
        "This action is permanent and cannot be undone. The wallet will be removed from the active list.",
      actionText: "Yes, Archive",
    },
  };

  const table = useReactTable({
    data,
    columns,
    filterFns: { dateBetween: () => true },
    state: { sorting, columnFilters },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    meta: {
      openConfirmationDialog: (wallet: Wallet, action: ConfirmableAction) => {
        setConfirmationState({ wallet, action });
      },
      openTransferDialog: (wallet: Wallet) => {
        setTransferSourceWallet(wallet);
      },
      openBalanceDialog: (wallet: Wallet) => {
        setWalletForBalanceCheck(wallet);
      },
    },
  });

  const handleConfirmAction = () => {
    if (confirmationState) {
      const { wallet, action } = confirmationState;
      const promise = updateAdminWalletStatus(wallet.id, action);
      toast.promise(promise, {
        loading: `Updating status to ${action}...`,
        success: "Wallet status updated successfully.",
        error: (err) => `Failed to update status: ${err.message}`,
      });
    }
    setConfirmationState(null);
  };

  const otherWallets = useMemo(
    () => (data as Wallet[]).filter((w) => w.id !== transferSourceWallet?.id),
    [data, transferSourceWallet]
  );

  // We explicitly check that `newWalletBlockchain` is not an empty string.
  // This ensures the expression always returns a true boolean.
  const isCreateFormValid = useMemo(() => {
    return newWalletLabel.trim().length >= 3 && newWalletBlockchain !== "";
  }, [newWalletLabel, newWalletBlockchain]);

  const handleCreateDialogOpenChange = (open: boolean) => {
    setIsCreateDialogOpen(open);
    if (!open) {
      setNewWalletLabel("");
      setNewWalletBlockchain("");
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <AdminWalletsToolbar table={table} />
        <Dialog
          open={isCreateDialogOpen}
          onOpenChange={handleCreateDialogOpenChange}
        >
          <DialogTrigger asChild>
            <Button>
              <PlusCircle className="mr-2 h-4 w-4" />
              Create New Wallet
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[425px]">
            <form
              action={async (formData) => {
                const result = await createAdminWallet(formData);
                if (result.error) {
                  toast.error("Creation Failed", {
                    description: result.error,
                  });
                } else {
                  toast.success("Wallet created successfully.");
                  handleCreateDialogOpenChange(false);
                }
              }}
            >
              <DialogHeader>
                <DialogTitle>Create New Admin Wallet</DialogTitle>
                <DialogDescription>
                  This will create a new Circle wallet for platform use.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="label" className="text-right">
                    Label
                  </Label>
                  <Input
                    id="label"
                    name="label"
                    placeholder="e.g., 'Secondary wallet'"
                    className="col-span-3"
                    required
                    value={newWalletLabel}
                    onChange={(e) => setNewWalletLabel(e.target.value)}
                  />
                </div>
                <div className="grid grid-cols-4 items-center gap-4">
                  <Label htmlFor="blockchain" className="text-right">
                    Blockchain
                  </Label>
                  <Select
                    name="blockchain"
                    required
                    value={newWalletBlockchain}
                    onValueChange={setNewWalletBlockchain}
                  >
                    <SelectTrigger className="col-span-3 w-full">
                      <SelectValue placeholder="Select a blockchain" />
                    </SelectTrigger>
                    <SelectContent>
                      {SUPPORTED_CHAINS.map((chain) => (
                        <SelectItem key={chain.id} value={chain.id}>
                          {chain.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <CreateWalletSubmitButton isFormValid={isCreateFormValid} />
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {flexRender(
                      header.column.columnDef.header,
                      header.getContext()
                    )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows?.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center"
                >
                  No admin wallets found.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex items-center justify-end space-x-2 py-4">
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.previousPage()}
          disabled={!table.getCanPreviousPage()}
        >
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={() => table.nextPage()}
          disabled={!table.getCanNextPage()}
        >
          Next
        </Button>
      </div>

      <AlertDialog
        open={!!confirmationState}
        onOpenChange={(open: boolean) => !open && setConfirmationState(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmationState &&
                confirmationDetails[confirmationState.action].title}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmationState &&
                confirmationDetails[confirmationState.action].description}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmAction}
              className={
                confirmationState?.action === "ARCHIVED"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmationState &&
                confirmationDetails[confirmationState.action].actionText}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <TransferDialog
        sourceWallet={transferSourceWallet}
        otherWallets={otherWallets}
        onClose={() => setTransferSourceWallet(null)}
      />

      <BalanceDialog
        wallet={walletForBalanceCheck}
        onClose={() => setWalletForBalanceCheck(null)}
      />
    </div>
  );
}