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

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const getUser = vi.hoisted(() => vi.fn());
vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

import { getAdminUser, getCurrentUser, isAdminEmail } from "@/lib/auth/admin";

describe("isAdminEmail", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "Admin@Admin.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("matches case-insensitively and ignores surrounding whitespace", () => {
    expect(isAdminEmail("admin@admin.com")).toBe(true);
    expect(isAdminEmail("  ADMIN@admin.COM ")).toBe(true);
  });

  it("rejects other users and empty values", () => {
    expect(isAdminEmail("user@example.com")).toBe(false);
    expect(isAdminEmail("admin@admin.com.evil.io")).toBe(false);
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail(null)).toBe(false);
    expect(isAdminEmail(undefined)).toBe(false);
  });

  it("fails closed when ADMIN_EMAIL is unset or blank", () => {
    vi.stubEnv("ADMIN_EMAIL", "");
    expect(isAdminEmail("")).toBe(false);
    expect(isAdminEmail("anyone@example.com")).toBe(false);
    vi.stubEnv("ADMIN_EMAIL", "   ");
    expect(isAdminEmail("   ")).toBe(false);
  });
});

describe("getCurrentUser / getAdminUser", () => {
  beforeEach(() => {
    vi.stubEnv("ADMIN_EMAIL", "admin@admin.com");
  });
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("returns null when there is no session", async () => {
    getUser.mockResolvedValue({ data: { user: null } });
    expect(await getCurrentUser()).toBeNull();
    expect(await getAdminUser()).toBeNull();
  });

  it("does not treat a signed-in regular user as admin", async () => {
    const user = { id: "u1", email: "user@example.com" };
    getUser.mockResolvedValue({ data: { user } });
    expect(await getCurrentUser()).toEqual(user);
    expect(await getAdminUser()).toBeNull();
  });

  it("returns the admin user", async () => {
    const user = { id: "a1", email: "admin@admin.com" };
    getUser.mockResolvedValue({ data: { user } });
    expect(await getAdminUser()).toEqual(user);
  });
});
