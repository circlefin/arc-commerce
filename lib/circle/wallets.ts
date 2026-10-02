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

import { Blockchain } from "@circle-fin/developer-controlled-wallets";
import { circleDeveloperSdk } from "@/lib/circle/developer-controlled-wallets-client";

export interface CreatedWallet {
  id: string;
  address: string;
  blockchain: string;
}

/**
 * Creates a wallet set and one SCA wallet in it. Server-side only: this is called
 * directly by the admin server action and the platform initializer, so no HTTP
 * route is needed (an unauthenticated route here would let anyone mint wallets).
 */
export async function createWalletSetWithWallet(
  name: string,
  blockchain?: string
): Promise<CreatedWallet> {
  const targetBlockchain = (blockchain ||
    process.env.CIRCLE_BLOCKCHAIN) as Blockchain | undefined;
  if (!targetBlockchain) {
    throw new Error(
      "Blockchain must be provided or set via the CIRCLE_BLOCKCHAIN environment variable."
    );
  }

  const walletSetResponse = await circleDeveloperSdk.createWalletSet({ name });
  const walletSet = walletSetResponse.data?.walletSet;
  if (!walletSet) {
    throw new Error("Circle API did not return a wallet set.");
  }

  const walletsResponse = await circleDeveloperSdk.createWallets({
    walletSetId: walletSet.id,
    blockchains: [targetBlockchain],
    count: 1,
    accountType: "SCA",
  });
  const wallet = walletsResponse.data?.wallets?.[0];
  if (!wallet) {
    throw new Error("Circle API did not return a wallet object.");
  }

  return {
    id: wallet.id,
    address: wallet.address,
    blockchain: wallet.blockchain,
  };
}
