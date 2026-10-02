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

import { afterAll, beforeAll, describe, expect, it } from "vitest";
import {
  anonymous,
  cleanup,
  createUser,
  creditsOf,
  ensureAdminUser,
  insertUserPurchase,
  service,
  signIn,
} from "./helpers";

afterAll(cleanup);

const ADMIN = "admin@admin.com";
let alice: Awaited<ReturnType<typeof createUser>>;
let bob: Awaited<ReturnType<typeof createUser>>;
let aliceTx: { id: string };
let bobTx: { id: string };

beforeAll(async () => {
  await ensureAdminUser();
  alice = await createUser();
  bob = await createUser();
  aliceTx = await insertUserPurchase(alice.id);
  bobTx = await insertUserPurchase(bob.id);
});

describe("transactions row-level security", () => {
  it("lets a user read only their own transactions", async () => {
    const client = await signIn(alice.email);
    const { data, error } = await client.from("transactions").select("id");

    expect(error).toBeNull();
    const ids = data!.map((row) => row.id);
    expect(ids).toContain(aliceTx.id);
    expect(ids).not.toContain(bobTx.id);
  });

  it("does not let a user fetch another user's transaction by id", async () => {
    const client = await signIn(alice.email);
    const { data } = await client.from("transactions").select("*").eq("id", bobTx.id);
    expect(data).toEqual([]);
  });

  it("lets the admin read every transaction", async () => {
    const client = await signIn(ADMIN);
    const { data, error } = await client.from("transactions").select("id");

    expect(error).toBeNull();
    const ids = data!.map((row) => row.id);
    expect(ids).toEqual(expect.arrayContaining([aliceTx.id, bobTx.id]));
  });

  it("shows nothing to anonymous visitors", async () => {
    const { data } = await anonymous().from("transactions").select("id");
    expect(data ?? []).toEqual([]);
  });

  it("does not let a user write to transactions", async () => {
    const client = await signIn(alice.email);
    const { data } = await client
      .from("transactions")
      .update({ status: "complete" })
      .eq("id", aliceTx.id)
      .select();
    expect(data ?? []).toEqual([]);

    const { data: row } = await service.from("transactions").select("status").eq("id", aliceTx.id).single();
    expect(row!.status).toBe("pending");
  });
});

describe("credits", () => {
  it("lets a user read only their own balance", async () => {
    const client = await signIn(alice.email);
    const { data } = await client.from("credits").select("user_id");
    expect(data!.map((row) => row.user_id)).toEqual([alice.id]);
  });

  it("does not let a user create or edit a credit row", async () => {
    const client = await signIn(alice.email);

    const insert = await client.from("credits").insert({ user_id: alice.id, credits: 1_000_000 });
    expect(insert.error).not.toBeNull();

    const update = await client.from("credits").update({ credits: 1_000_000 }).eq("user_id", alice.id).select();
    expect(update.data ?? []).toEqual([]);

    expect(await creditsOf(alice.id)).toBe(0);
  });
});

describe("privileged functions", () => {
  it.each([
    ["increment_credits", { user_id_to_update: "", amount_to_add: 1_000_000 }],
    [
      "settle_user_transaction",
      { p_transaction_id: "00000000-0000-0000-0000-000000000000", p_new_status: "complete" },
    ],
  ])("%s cannot be called by a signed-in user", async (fn, args) => {
    const client = await signIn(alice.email);
    const { error } = await client.rpc(fn, { ...args, ...(fn === "increment_credits" ? { user_id_to_update: alice.id } : {}) });
    expect(error?.code).toBe("42501"); // permission denied
    expect(await creditsOf(alice.id)).toBe(0);
  });

  it("cannot be called anonymously", async () => {
    const { error } = await anonymous().rpc("increment_credits", {
      user_id_to_update: alice.id,
      amount_to_add: 1,
    });
    expect(error).not.toBeNull();
    expect(await creditsOf(alice.id)).toBe(0);
  });
});
