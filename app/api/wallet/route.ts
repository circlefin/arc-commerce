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

import { NextResponse } from "next/server";
import { circleDeveloperSdk } from "@/lib/circle/developer-controlled-wallets-client";
import { Blockchain } from "@circle-fin/developer-controlled-wallets";

export async function POST(request: Request) {
  try {
    // Destructure the optional `blockchain` from the request body.
    const { walletSetId, blockchain } = await request.json();

    if (!walletSetId) {
      return NextResponse.json(
        { error: "walletSetId is required" },
        { status: 400 }
      );
    }

    // Use the provided blockchain, or fall back to the environment variable.
    const targetBlockchain =
      blockchain || (process.env.CIRCLE_BLOCKCHAIN as Blockchain);

    if (!targetBlockchain) {
      throw new Error(
        "Blockchain must be provided in the request or as a CIRCLE_BLOCKCHAIN environment variable."
      );
    }

    const response = await circleDeveloperSdk.createWallets({
      walletSetId,
      blockchains: [targetBlockchain],
      count: 1,
      accountType: "SCA",
    });

    const newWallet = response.data?.wallets?.[0];

    if (!newWallet) {
      throw new Error("Circle API did not return a wallet object.");
    }

    return NextResponse.json(newWallet);
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : "An unexpected error occurred.";
    console.error("Error in /api/wallet:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}