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
import { createClient } from "@/lib/supabase/client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { AdminTransaction } from "@/types/admin-transaction";
import { getAdminWalletAddresses } from "@/lib/actions/admin-wallets";

export type { AdminTransaction };

export function useRealtimeAdminTransactions(initialData: AdminTransaction[]) {
  const [transactions, setTransactions] = useState(initialData);
  const [adminWalletAddresses, setAdminWalletAddresses] = useState<string[]>([]);
  const [isLoadingAddresses, setIsLoadingAddresses] = useState(true);
  const supabase = useMemo(() => createClient(), []);
  const router = useRouter();

  // Fetch admin wallet addresses for filtering USER transactions using server action
  useEffect(() => {
    async function fetchAdminWallets() {
      console.log("[Realtime] Fetching admin wallet addresses via server action...");
      setIsLoadingAddresses(true);

      try {
        const addresses = await getAdminWalletAddresses();
        console.log("[Realtime] Fetched admin wallet addresses:", addresses.length, addresses);
        setAdminWalletAddresses(addresses);
      } catch (error) {
        console.error("[Realtime] Error fetching admin wallets:", error);
      } finally {
        setIsLoadingAddresses(false);
      }
    }
    fetchAdminWallets();
  }, []);

  // Sync initialData to state when it changes (from router.refresh())
  useEffect(() => {
    console.log("[Realtime] Syncing initialData to state");
    setTransactions(initialData);
  }, [initialData]);

  // Set up realtime subscription (only re-subscribe if admin wallets or loading state changes)
  useEffect(() => {
    console.log("[Realtime] Setting up subscription. Admin wallet addresses:", adminWalletAddresses.length, "Loading:", isLoadingAddresses);

    // Don't set up subscription until admin wallet addresses are loaded
    // This prevents premature subscription attempts that will timeout
    if (isLoadingAddresses) {
      console.log("[Realtime] Waiting for admin wallet addresses to load before subscribing...");
      return;
    }

    console.log("[Realtime] Admin wallet addresses loaded. Proceeding with subscription setup.");

    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    // Wait for authentication before subscribing
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || cancelled) {
        console.log("[Realtime] No authenticated user, skipping subscription");
        return;
      }

      console.log("[Realtime] Creating subscription channel for authenticated user...");
      console.log("[Realtime] Admin wallet addresses available:", adminWalletAddresses.length);

      channel = supabase
        .channel("transactions_changes")
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "transactions",
            // Listen to all transactions - we'll filter client-side
          },
          (payload) => {
            console.log("[Realtime] Update received:", payload);

          const transaction = payload.new as AdminTransaction;

          // Filter: include if it's NOT a USER transaction, OR if it's a USER transaction to an admin wallet
          const isAdminTransaction = transaction.transaction_type !== "USER";
          const isUserToAdminWallet =
            transaction.transaction_type === "USER" &&
            adminWalletAddresses.length > 0 &&
            adminWalletAddresses.includes(transaction.destination_address);

          console.log("[Realtime] Filtering:", {
            transactionType: transaction.transaction_type,
            isAdminTransaction,
            isUserToAdminWallet,
            adminWalletsLoaded: adminWalletAddresses.length > 0,
            willProcess: isAdminTransaction || isUserToAdminWallet
          });

          if (!isAdminTransaction && !isUserToAdminWallet) {
            console.log("[Realtime] Ignoring USER transaction not directed to admin wallet");
            return;
          }

          if (payload.eventType === "INSERT") {
            const newTransaction = payload.new as AdminTransaction;

            // 1. Immediately add the new row with "N/A" for instant UI feedback.
            setTransactions((current) => [
              { ...newTransaction, source_wallet: { label: "Loading..." } },
              ...current,
            ]);

            // 2. Trigger a soft refresh of the page's data.
            //    Next.js will re-fetch the server component data in the background
            //    and seamlessly update the table with the complete, joined data.
            router.refresh();

            toast.info("New transaction initiated.", {
              description: `ID: ${newTransaction.circle_transaction_id?.slice(0, 15) || newTransaction.id.slice(0, 15)}...`,
            });
          }

          if (payload.eventType === "UPDATE") {
            const oldTx = payload.old as Partial<AdminTransaction>;
            const newTx = payload.new as AdminTransaction;

            console.log("[Realtime] UPDATE event:", {
              oldStatus: oldTx?.status,
              newStatus: newTx.status,
              transactionId: newTx.id,
            });

            // Update the transaction in state with all new fields (not just status)
            setTransactions((current) =>
              current.map((tx) =>
                tx.id === newTx.id
                  ? { ...tx, ...newTx }
                  : tx
              )
            );

            // Show toast notifications only if status actually changed
            const statusChanged = !oldTx?.status || oldTx.status !== newTx.status;
            if (statusChanged) {
              if (newTx.status === "confirmed") {
                toast.success("Transfer Confirmed by Circle", {
                  description: `Transaction ${newTx.circle_transaction_id?.slice(0, 15) || newTx.id.slice(0, 15)}... verified by Circle.`,
                });
              } else if (newTx.status === "complete") {
                toast.success("Transfer Complete!", {
                  description: `Funds have been deposited for ${newTx.circle_transaction_id?.slice(0, 15) || newTx.id.slice(0, 15)}...`,
                });
              } else if (newTx.status === "failed") {
                toast.error("Transaction Failed", {
                  description: `Transaction ${newTx.circle_transaction_id?.slice(0, 15) || newTx.id.slice(0, 15)}... has failed.`,
                });
              }
            }
          }
        }
      )
        .subscribe((status, err) => {
          console.log("[Realtime] Subscription status:", status, err ? `Error: ${err}` : '');
          if (status === 'SUBSCRIBED') {
            console.log("[Realtime] Successfully subscribed to transactions_changes channel");
          } else if (status === 'CHANNEL_ERROR') {
            const errorMsg = err ? err : "Unknown channel error (no error object provided)";
            console.error("[Realtime] Channel error:", errorMsg);
            toast.error("Realtime channel error", {
              description: typeof errorMsg === "string" ? errorMsg : JSON.stringify(errorMsg),
            });
          } else if (status === 'TIMED_OUT') {
            console.error("[Realtime] Subscription timed out");
            toast.error("Realtime subscription timed out");
          }
        });
    }).catch((error) => {
      console.error("[Realtime] Failed to setup realtime subscription:", error);
    });

    return () => {
      cancelled = true;
      if (channel) {
        console.log("[Realtime] Cleaning up subscription channel");
        supabase.removeChannel(channel);
      }
    };
  }, [supabase, router, adminWalletAddresses, isLoadingAddresses]);

  return transactions;
}
