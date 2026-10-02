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
import { getCurrentUser } from "@/lib/auth/admin";
import { getPrimaryDestinationAddress } from "@/lib/payments/destination";

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    if (!(await getCurrentUser())) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const address = await getPrimaryDestinationAddress();
    if (!address) {
      return NextResponse.json({ error: "No destination wallet found." }, { status: 404 });
    }

    return NextResponse.json({ address });
  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Failed to fetch destination wallet:", message);
    return NextResponse.json({ error: "Failed to fetch destination wallet." }, { status: 500 });
  }
}
