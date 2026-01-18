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

type NetworkEventName =
  | "switch_attempt"
  | "switch_no_capability"
  | "switch_missing_config"
  | "switch_success"
  | "switch_failure"
  | "auto_switch_trigger"
  | "preferred_switch_trigger"
  | "preferred_switch_trigger_initial"
  | "preferred_chain_updated_external"
  | "auto_switch_pref_changed";

interface NetworkEventPayload {
  [key: string]: unknown;
  dest?: number;
  from?: number;
  to?: number;
  error?: string;
  raw?: string;
  enabled?: boolean;
  connected?: boolean;
  canSwitch?: boolean;
}

interface BufferedEvent {
  ts: number;
  name: NetworkEventName;
  data: NetworkEventPayload;
}

const buffer: BufferedEvent[] = [];
const MAX_BUFFER = 50;
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleFlush() {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    flush();
  }, 5000);
}

function flush() {
  if (!buffer.length) return;
  // Placeholder: replace with network request to your backend / analytics.
  if (process.env.NODE_ENV !== "production") {
    console.debug("[telemetry] network events", [...buffer]);
  }
  buffer.length = 0;
}

export function emitNetworkEvent(
  name: NetworkEventName,
  data: NetworkEventPayload = {}
) {
  buffer.push({ ts: Date.now(), name, data });
  if (buffer.length >= MAX_BUFFER) flush();
  else scheduleFlush();
}

export function forceFlushNetworkEvents() {
  flush();
}
