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

import { supabaseAdminClient } from "@/lib/supabase/admin-client";

/**
 * Address that receives user credit purchases: the oldest ENABLED admin wallet.
 * Returns null when none exists.
 */
export async function getPrimaryDestinationAddress(): Promise<string | null> {
  const { data, error } = await supabaseAdminClient
    .from("admin_wallets")
    .select("address")
    .eq("status", "ENABLED")
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(error.message);
  return data?.address ?? null;
}

/**
 * True when `address` belongs to one of the platform's admin wallets.
 * Purchases may only be recorded against addresses the platform controls.
 */
export async function isAdminWalletAddress(address: string): Promise<boolean> {
  const { data, error } = await supabaseAdminClient
    .from("admin_wallets")
    .select("id")
    .ilike("address", address)
    .limit(1);

  if (error) throw new Error(error.message);
  return (data?.length ?? 0) > 0;
}
