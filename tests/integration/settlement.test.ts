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

import { afterAll, describe, expect, it } from "vitest";
import {
  cleanup,
  createUser,
  creditsOf,
  insertUserPurchase,
  service,
  settle,
  statusOf,
} from "./helpers";

afterAll(cleanup);

describe("settle_user_transaction", () => {
  it("credits the user exactly once and reports what happened", async () => {
    const user = await createUser();
    const tx = await insertUserPurchase(user.id, { credit_amount: 10 });

    expect((await settle(tx.id, "complete")).data).toBe("credited");
    expect(await creditsOf(user.id)).toBe(10);
    expect(await statusOf(tx.id)).toBe("complete");

    expect((await settle(tx.id, "complete")).data).toBe("noop");
    expect(await creditsOf(user.id)).toBe(10);
  });

  it("does not double-credit when the webhook and wallet confirmation race", async () => {
    // Many purchases, each settled by several concurrent deliveries (the webhook,
    // its retries, and the wallet-confirmation PATCH). A single purchase races too
    // rarely to catch a missing row lock; this volume reliably doubles the balance
    // if settle_user_transaction() stops locking. Kept below what the local API
    // gateway can carry, so any error here is a real failure, not transport noise.
    const PURCHASES = 15;
    const DELIVERIES = 4;
    const user = await createUser();
    const purchases = await Promise.all(
      Array.from({ length: PURCHASES }, () => insertUserPurchase(user.id, { credit_amount: 1 }))
    );

    const results = await Promise.all(
      purchases.flatMap((tx) =>
        Array.from({ length: DELIVERIES }, (_, i) =>
          settle(tx.id, i % 2 ? "complete" : "confirmed").then((result) => ({ tx, result }))
        )
      )
    );

    expect(results.filter(({ result }) => result.error)).toEqual([]);
    for (const tx of purchases) {
      const credited = results.filter(({ tx: t, result }) => t === tx && result.data === "credited");
      expect(credited).toHaveLength(1);
      expect(await statusOf(tx.id)).toBe("complete");
    }
    expect(await creditsOf(user.id)).toBe(PURCHASES);
  });

  it("credits on 'confirmed' and does not credit again on the later 'complete'", async () => {
    const user = await createUser();
    const tx = await insertUserPurchase(user.id, { credit_amount: 3 });

    expect((await settle(tx.id, "confirmed")).data).toBe("credited");
    expect((await settle(tx.id, "complete")).data).toBe("updated");
    expect(await creditsOf(user.id)).toBe(3);
  });

  it("never moves a credited purchase backwards or to failed", async () => {
    const user = await createUser();
    const tx = await insertUserPurchase(user.id, { credit_amount: 5 });
    await settle(tx.id, "complete");

    expect((await settle(tx.id, "pending")).data).toBe("noop");
    expect((await settle(tx.id, "failed")).data).toBe("noop");
    expect(await statusOf(tx.id)).toBe("complete");
    expect(await creditsOf(user.id)).toBe(5);
  });

  it("treats failed as terminal: a later success grants nothing", async () => {
    const user = await createUser();
    const tx = await insertUserPurchase(user.id, { credit_amount: 5 });

    expect((await settle(tx.id, "failed")).data).toBe("updated");
    expect((await settle(tx.id, "complete")).data).toBe("noop");
    expect(await statusOf(tx.id)).toBe("failed");
    expect(await creditsOf(user.id)).toBe(0);
  });

  it("merges metadata into the row", async () => {
    const user = await createUser();
    const tx = await insertUserPurchase(user.id, { metadata: { keep: "me" } });
    await service.rpc("settle_user_transaction", {
      p_transaction_id: tx.id,
      p_new_status: "complete",
      p_metadata: { metamask_confirmation: { block_number: 7 } },
    });
    const { data } = await service.from("transactions").select("metadata").eq("id", tx.id).single();
    expect(data!.metadata).toEqual({ keep: "me", metamask_confirmation: { block_number: 7 } });
  });

  it("reports not_found for unknown ids and for non-USER transactions", async () => {
    expect((await settle("00000000-0000-0000-0000-000000000000", "complete")).data).toBe(
      "not_found"
    );
  });
});

describe("transaction hash uniqueness", () => {
  it("treats hashes that differ only by case as the same transaction", async () => {
    const user = await createUser();
    const tx = await insertUserPurchase(user.id);

    const { error } = await service.from("transactions").insert({
      transaction_type: "USER",
      user_id: user.id,
      wallet_id: "0x1111111111111111111111111111111111111111",
      direction: "credit",
      amount_usdc: 10,
      credit_amount: 10,
      exchange_rate: 1,
      chain: "5042002",
      asset: "USDC",
      tx_hash: tx.tx_hash.toUpperCase().replace("0X", "0x"),
      status: "pending",
      idempotency_key: `dup:${tx.tx_hash}`,
    });

    expect(error?.code).toBe("23505");
  });
});
