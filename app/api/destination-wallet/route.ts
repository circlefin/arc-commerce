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
import { supabaseAdminClient } from "@/lib/supabase/admin-client";

export const dynamic = 'force-dynamic'; // Ensures the route is not cached

export async function GET() {
  try {
    const { data, error } = await supabaseAdminClient
      .from("admin_wallets")
      .select("address")
      .order("created_at", { ascending: true }) // Get the oldest row first
      .limit(1)
      .single(); // Expect only one row

    if (error) {
      console.error("Supabase query error:", error);
      // RLS errors can be cryptic, so provide a clearer message.
      if (error.code === 'PGRST116') {
        return NextResponse.json({ error: "No destination wallet found in the database." }, { status: 404 });
      }
      throw error;
    }

    if (!data || !data.address) {
      return NextResponse.json({ error: "No destination wallet found." }, { status: 404 });
    }

    return NextResponse.json({ address: data.address });

  } catch (error) {
    const message = error instanceof Error ? error.message : "An unknown error occurred.";
    console.error("Failed to fetch destination wallet:", message);
    return NextResponse.json({ error: "Failed to fetch destination wallet." }, { status: 500 });
  }
}