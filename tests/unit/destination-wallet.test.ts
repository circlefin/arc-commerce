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

import { beforeEach, describe, expect, it, vi } from "vitest";
import { queryBuilder, queueTables } from "../helpers/supabase-mock";

const admin = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/admin-client", () => ({ supabaseAdminClient: admin }));
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import { GET } from "@/app/api/destination-wallet/route";

beforeEach(() => {
  admin.from.mockReset();
  getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });
});

describe("GET /api/destination-wallet", () => {
  it("requires a signed-in user", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect((await GET()).status).toBe(401);
    expect(admin.from).not.toHaveBeenCalled();
  });

  it("returns the oldest ENABLED admin wallet", async () => {
    const builder = queryBuilder({ data: { address: "0xabc" } });
    queueTables(admin, { admin_wallets: [builder] });

    const res = await GET();

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ address: "0xabc" });
    expect(builder.eq).toHaveBeenCalledWith("status", "ENABLED");
    expect(builder.order).toHaveBeenCalledWith("created_at", { ascending: true });
  });

  it("returns 404 when no wallet is enabled", async () => {
    queueTables(admin, { admin_wallets: [queryBuilder({ data: null })] });
    expect((await GET()).status).toBe(404);
  });
});
