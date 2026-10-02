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

import { Database } from "@/types/supabase";

type TransactionRow = Database["public"]["Tables"]["transactions"]["Row"];

/** Shape returned to the browser for a recorded USER purchase. */
export function serializeTransaction(tx: TransactionRow) {
  return {
    id: tx.id,
    credits: Number(tx.credit_amount),
    usdcAmount: Number(tx.amount_usdc),
    txHash: tx.tx_hash,
    chainId: Number(tx.chain),
    status: tx.status,
    createdAt: tx.created_at,
    walletAddress: tx.wallet_id,
  };
}
