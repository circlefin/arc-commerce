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

import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
import { useState, useEffect } from "react";
import { useWaitForTransactionReceipt } from "wagmi";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { CheckCircle, Clock, XCircle, ExternalLink, Copy } from "lucide-react";
import { format } from "date-fns";
import Link from "next/link";

interface TransactionData {
  id: string;
  amount_usdc?: number;
  usdcAmount: number;
  tx_hash?: string;
  txHash: string;
  chainId: number;
  chain?: string;
  status: "pending" | "confirmed" | "failed" | "complete";
  created_at?: string;
  createdAt: string;
  fee_usdc?: number;
  fee?: number;
  networkName?: string;
}

interface TransactionConfirmationModalProps {
  isOpen: boolean;
  onClose: () => void;
  transaction: TransactionData | null;
  onRetry?: () => void;
}

const getNetworkName = (chainId: number): string => {
  const networks: Record<number, string> = {
    1: "Ethereum",
    137: "Polygon",
    8453: "Base",
    42161: "Arbitrum",
    10: "Optimism",
  };

  return networks[chainId] || `Chain ${chainId}`;
};

const DetailRow = ({ label, value }: { label: string; value: React.ReactNode }) => (
  <div className="flex justify-between items-center">
    <span className="text-sm text-muted-foreground">{label}</span>
    <span className="font-medium">{value}</span>
  </div>
);

export function TransactionConfirmationModal({
  isOpen,
  onClose,
  transaction,
  onRetry,
}: TransactionConfirmationModalProps) {
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [realtimeTx, setRealtimeTx] = useState<TransactionData | null>(transaction);

  // Monitor transaction receipt from MetaMask/wallet
  const { data: receipt, isSuccess: isReceiptConfirmed } = useWaitForTransactionReceipt({
    hash: transaction?.txHash as `0x${string}` | undefined,
    chainId: transaction?.chainId,
    confirmations: 1,
    query: {
      enabled: !!transaction && transaction.status === "pending",
    },
  });

  // Update status to 'complete' when MetaMask confirms the transaction
  useEffect(() => {
    if (!transaction || !isReceiptConfirmed || !receipt) return;

    const updateTransactionStatus = async () => {
      try {
        const response = await fetch(`/api/transactions/${transaction.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "complete",
            txHash: transaction.txHash,
            blockNumber: Number(receipt.blockNumber),
            blockHash: receipt.blockHash,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          if (data.transaction) {
            setRealtimeTx(prev => ({
              ...prev!,
              status: "complete",
            }));
            setLastUpdated(new Date());
            toast.success("Transaction confirmed on-chain!", {
              description: "Waiting for Circle to process...",
            });
          }
        }
      } catch (error) {
        console.error("Failed to update transaction status:", error);
        // Don't show error toast - Circle webhook will still update it
      }
    };

    updateTransactionStatus();
  }, [transaction, isReceiptConfirmed, receipt]);

  useEffect(() => {
    if (!transaction || !isOpen) return;

    // Dynamically import Supabase client to avoid SSR issues
    let channel: RealtimeChannel;
    let supabase: SupabaseClient;
    let isMounted = true;

    (async () => {
      const { createClient } = await import("@/lib/supabase/client");
      supabase = createClient();

      channel = supabase
        .channel("user_transaction_changes")
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "transactions", filter: `id=eq.${transaction.id}` },
          payload => {
            if (!isMounted) return;

            const updatedTx = payload.new as TransactionData;

            if (updatedTx.status !== transaction.status) {
              setRealtimeTx(updatedTx);
              setLastUpdated(new Date());

              if (updatedTx.status === "confirmed" || updatedTx.status === "complete") {
                toast.success("Transaction confirmed!", {
                  description: `${updatedTx.amount_usdc} credits added to your account.`,
                });
              } else if (updatedTx.status === "failed") {
                toast.error("Transaction failed", {
                  description: "Your transaction was not successful.",
                });
              }

              window.dispatchEvent(new CustomEvent('transaction-updated', {
                detail: updatedTx
              }));
            }
          }
        )
        .subscribe();
    })();

    return () => {
      isMounted = false;
      if (supabase && channel) supabase.removeChannel(channel);
    };
  }, [transaction, isOpen]);

  const copyToClipboard = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Copied to clipboard");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const tx = realtimeTx || transaction;

  if (!tx) return null;

  const statusConfig = {
    pending: {
      icon: Clock,
      color: "text-yellow-600",
      bgColor: "bg-yellow-50",
      badgeVariant: "secondary" as const,
      title: "Transaction Pending",
      description: "Your transaction is being processed on the blockchain...",
    },
    completed: {
      icon: CheckCircle,
      color: "text-blue-600",
      bgColor: "bg-blue-50",
      badgeVariant: "secondary" as const,
      title: "Transaction Confirmed!",
      description: "Your transaction is confirmed on-chain. Waiting for Circle to process...",
    },
    confirmed: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      badgeVariant: "default" as const,
      title: "Payment Confirmed!",
      description: "Your credits have been successfully added to your account.",
    },
    failed: {
      icon: XCircle,
      color: "text-red-600",
      bgColor: "bg-red-50",
      badgeVariant: "destructive" as const,
      title: "Transaction Failed",
      description: "Your transaction was unsuccessful. Please try again or contact support.",
    },
    complete: {
      icon: CheckCircle,
      color: "text-green-600",
      bgColor: "bg-green-50",
      badgeVariant: "default" as const,
      title: "Transaction Complete!",
      description: "Your credits have been successfully added to your account.",
    },
  };

  const config = statusConfig[tx.status];
  const StatusIcon = config.icon;
  const networkName = tx.networkName || getNetworkName(tx.chainId || Number(tx.chain));

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className={`w-16 h-16 rounded-full ${config.bgColor} flex items-center justify-center mx-auto mb-4`}>
            <StatusIcon className={`w-8 h-8 ${config.color}`} />
          </div>
          <DialogTitle className="text-center">{config.title}</DialogTitle>
          <DialogDescription className="text-center">
            {config.description}
          </DialogDescription>
        </DialogHeader>

        <Card>
          <CardContent className="pt-6 space-y-4">
            <DetailRow
              label="Status"
              value={
                <div className="flex items-center gap-2">
                  <Badge variant={config.badgeVariant}>
                    {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                  </Badge>
                </div>
              }
            />

            <Separator />

            <DetailRow
              label="Credits Purchased"
              value={`${tx.usdcAmount || tx.amount_usdc} credits`}
            />

            <DetailRow
              label="USDC Amount"
              value={`$${tx.usdcAmount || tx.amount_usdc}`}
            />

            {typeof tx.fee_usdc === "number" && tx.fee_usdc > 0 && (
              <DetailRow
                label="Network Fee"
                value={`$${(tx.fee || tx.fee_usdc).toFixed(2)}`}
              />
            )}

            <Separator />

            <DetailRow
              label="Network"
              value={networkName}
            />

            <DetailRow
              label="Transaction Hash"
              value={
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs">
                    {(() => {
                      const hash = tx.tx_hash || tx.txHash;
                      if (!hash) return "N/A";
                      return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
                    })()}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-6 w-6 p-0"
                    onClick={() => copyToClipboard(tx.txHash || tx.tx_hash || "")}
                  >
                    <Copy className="w-3 h-3" />
                  </Button>
                </div>
              }
            />

            <DetailRow
              label="Timestamp"
              value={(() => {
                const timestamp = tx.created_at || tx.createdAt;
                if (!timestamp) return "N/A";
                try {
                  return format(new Date(timestamp), "PPpp");
                } catch {
                  return "Invalid date";
                }
              })()}
            />

            {lastUpdated && (
              <DetailRow
                label="Last Updated"
                value={format(lastUpdated, "pp")}
              />
            )}
          </CardContent>
        </Card>

        <div className="flex flex-col gap-2">
          <Button asChild variant="outline" className="w-full">
            <Link href={`https://testnet.arcscan.app/tx/${tx.txHash || tx.tx_hash}`} target="_blank" rel="noopener noreferrer">
              <ExternalLink className="w-4 h-4 mr-2" />
              View on Explorer
            </Link>
          </Button>

          {tx.status === "failed" && onRetry && (
            <Button onClick={onRetry} variant="default" className="w-full">
              Try Again
            </Button>
          )}

          {(tx.status === "confirmed" || tx.status === "complete") && (
            <Button asChild className="w-full">
              <Link href="/dashboard">
                View Transaction History
              </Link>
            </Button>
          )}

          <Button variant="ghost" onClick={onClose} className="w-full">
            Close
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
