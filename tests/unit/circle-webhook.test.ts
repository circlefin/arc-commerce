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

import crypto from "crypto";
import { beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { queryBuilder, queueTables } from "../helpers/supabase-mock";

const admin = vi.hoisted(() => ({ from: vi.fn(), rpc: vi.fn() }));
vi.mock("@/lib/supabase/admin-client", () => ({ supabaseAdminClient: admin }));

import { POST } from "@/app/api/circle/webhook/route";

const HASH = `0x${"ab".repeat(32)}`;

// A real key pair: the route verifies real signatures against the key Circle serves.
const { publicKey, privateKey } = crypto.generateKeyPairSync("ec", {
  namedCurve: "P-256",
});
const publicKeyBase64 = publicKey.export({ type: "spki", format: "der" }).toString("base64");

function signed(body: unknown, { tamper = false } = {}) {
  const raw = JSON.stringify(body);
  const signature = crypto
    .createSign("SHA256")
    .update(raw)
    .sign(privateKey)
    .toString("base64");
  return new NextRequest("http://localhost/api/circle/webhook", {
    method: "POST",
    headers: { "x-circle-signature": signature, "x-circle-key-id": "key-1" },
    body: tamper ? raw.replace("COMPLETE", "FAILED_") : raw,
  });
}

const payload = (notification: Record<string, unknown>, type = "transactions.inbound") => ({
  subscriptionId: "sub-1",
  notificationId: `n-${Math.random()}`,
  notificationType: type,
  timestamp: "2026-09-18T00:00:00Z",
  version: 2,
  notification,
});

function queueWebhookTables(matches: { id: string }[] = [{ id: "tx-1" }]) {
  const events = queryBuilder({ error: null });
  const lookup = queryBuilder({ data: matches });
  queueTables(admin, {
    transaction_webhook_events: [events],
    transactions: [lookup],
  });
  return { events, lookup };
}

beforeAll(() => {
  vi.stubEnv("CIRCLE_API_KEY", "test-key");
});

beforeEach(() => {
  admin.from.mockReset();
  admin.rpc.mockReset();
  admin.rpc.mockResolvedValue({ data: "credited", error: null });
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({
      ok: true,
      json: async () => ({ data: { publicKey: publicKeyBase64 } }),
    }))
  );
});

describe("POST /api/circle/webhook", () => {
  it("rejects requests without signature headers", async () => {
    const res = await POST(
      new NextRequest("http://localhost/api/circle/webhook", { method: "POST", body: "{}" })
    );
    expect(res.status).toBe(400);
  });

  it("rejects a payload whose signature does not match, touching nothing", async () => {
    const res = await POST(
      signed(payload({ id: "c1", state: "COMPLETE", txHash: HASH }), { tamper: true })
    );
    expect(res.status).toBe(403);
    expect(admin.from).not.toHaveBeenCalled();
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("settles matching purchases through the atomic function", async () => {
    const { lookup } = queueWebhookTables();
    const res = await POST(signed(payload({ id: "c1", state: "COMPLETE", txHash: HASH })));

    expect(res.status).toBe(200);
    expect(lookup.ilike).toHaveBeenCalledWith("tx_hash", HASH);
    expect(admin.rpc).toHaveBeenCalledWith("settle_user_transaction", {
      p_transaction_id: "tx-1",
      p_new_status: "complete",
    });
  });

  it.each([
    ["QUEUED", "pending"],
    ["CONFIRMED", "confirmed"],
    ["FAILED", "failed"],
  ])("maps Circle state %s to %s", async (state, expected) => {
    queueWebhookTables();
    await POST(signed(payload({ id: "c1", state, txHash: HASH })));
    expect(admin.rpc.mock.calls[0][1].p_new_status).toBe(expected);
  });

  it("does nothing for the webhook test ping", async () => {
    queueTables(admin, { transaction_webhook_events: [queryBuilder({ error: null })] });
    const res = await POST(signed(payload({}, "webhooks.test")));
    expect(res.status).toBe(200);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it.each([
    ["an unknown state", { id: "c1", state: "SOMETHING_NEW", txHash: HASH }],
    ["a missing txHash", { id: "c1", state: "COMPLETE" }],
    ["a malformed txHash", { id: "c1", state: "COMPLETE", txHash: "0x1234" }],
  ])("ignores a notification with %s", async (_name, notification) => {
    queueTables(admin, { transaction_webhook_events: [queryBuilder({ error: null })] });
    const res = await POST(signed(payload(notification)));
    expect(res.status).toBe(200);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("settles nothing when no purchase matches the hash", async () => {
    queueWebhookTables([]);
    const res = await POST(signed(payload({ id: "c1", state: "COMPLETE", txHash: HASH })));
    expect(res.status).toBe(200);
    expect(admin.rpc).not.toHaveBeenCalled();
  });

  it("answers 500 when settlement fails so Circle retries the delivery", async () => {
    queueWebhookTables();
    admin.rpc.mockResolvedValue({ data: null, error: { message: "db down" } });
    const res = await POST(signed(payload({ id: "c1", state: "COMPLETE", txHash: HASH })));
    expect(res.status).toBe(500);
  });
});
