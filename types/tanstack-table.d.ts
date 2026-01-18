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

import { FilterFn } from "@tanstack/react-table";
import { RankingInfo } from "@tanstack/match-sorter-utils";
import { Database } from "@/types/supabase";
import { ConfirmableAction } from "@/components/admin-wallets-table/columns";

type Wallet = Database["public"]["Tables"]["admin_wallets"]["Row"];

declare module "@tanstack/table-core" {
  interface FilterFns {
    dateBetween?: FilterFn<unknown>;
  }

  interface TableMeta {
    openConfirmationDialog?: (wallet: Wallet, action: ConfirmableAction) => void;
    // This is the new line to add:
    openTransferDialog?: (wallet: Wallet) => void;
    openBalanceDialog?: (wallet: Wallet) => void;
  }

  interface FilterMeta {
    itemRank: RankingInfo;
  }
}