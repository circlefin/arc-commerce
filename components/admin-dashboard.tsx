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

import type { Database } from "@/types/supabase";
import { createClient } from "@supabase/supabase-js";
import { AdminWalletsTable } from "@/components/admin-wallets-table/table";
import { columns as walletColumns } from "@/components/admin-wallets-table/columns";
import { AdminTransactionsTable } from "@/components/admin-transactions-table/table";
import { columns as transactionColumns } from "@/components/admin-transactions-table/columns";

export async function AdminDashboard() {
  const supabaseAdmin = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // First fetch admin wallets to get their addresses
  const { data: wallets, error: walletsError } = await supabaseAdmin
    .from("admin_wallets")
    .select("*")
    .order("created_at", { ascending: false });

  if (walletsError) {
    console.error("Error fetching admin wallets:", walletsError.message);
  }

  const adminWalletAddresses = wallets?.map(w => w.address) ?? [];

  // Fetch all transactions and filter on the server side
  const { data: allTransactions, error: transactionsError } = await supabaseAdmin
    .from("transactions")
    .select("*, source_wallet:admin_wallets(label)")
    .order("created_at", { ascending: false });

  if (transactionsError) {
    console.error("Error fetching admin transactions:", transactionsError.message);
  }

  // Filter: include non-USER transactions OR USER transactions sent to admin wallets
  const transactions = allTransactions?.filter(tx => {
    const isAdminTransaction = tx.transaction_type !== "USER";
    const isUserToAdminWallet =
      tx.transaction_type === "USER" &&
      tx.destination_address &&
      adminWalletAddresses.includes(tx.destination_address);
    return isAdminTransaction || isUserToAdminWallet;
  }) ?? [];

  return (
    <div className="w-full space-y-8">
      <div className="w-full">
        <h1 className="text-3xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-muted-foreground mt-2">
          Platform operator dashboard and administrative tools.
        </p>
      </div>

      <AdminWalletsTable columns={walletColumns} data={wallets ?? []} />
      {/* Pass the initial data to the table component */}
      <AdminTransactionsTable columns={transactionColumns} initialData={transactions as any ?? []} />
    </div>
  );
}