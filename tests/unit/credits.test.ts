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

import { describe, expect, it } from "vitest";
import {
  isPriceConsistent,
  microToUsdc,
  USDC_PER_CREDIT,
  usdcToMicro,
} from "@/lib/payments/credits";

describe("usdcToMicro / microToUsdc", () => {
  it("converts without floating point drift", () => {
    expect(usdcToMicro(0.1 + 0.2)).toBe(300000n);
    expect(usdcToMicro(12.34)).toBe(12340000n);
    expect(usdcToMicro(1)).toBe(1000000n);
  });

  it("round-trips 6-decimal amounts", () => {
    for (const amount of [0.000001, 1, 12.345678, 100]) {
      expect(microToUsdc(usdcToMicro(amount))).toBe(amount);
    }
  });
});

describe("isPriceConsistent", () => {
  it("accepts the exact price", () => {
    expect(isPriceConsistent(10, 10 * USDC_PER_CREDIT)).toBe(true);
    expect(isPriceConsistent(1.5, 1.5 * USDC_PER_CREDIT)).toBe(true);
  });

  it("rejects an underpayment, however small", () => {
    expect(isPriceConsistent(10, 9.999999 * USDC_PER_CREDIT)).toBe(false);
    expect(isPriceConsistent(1_000_000, 1)).toBe(false);
  });

  it("rejects overpayment mismatches and non-finite input", () => {
    expect(isPriceConsistent(1, 2)).toBe(false);
    expect(isPriceConsistent(Number.NaN, 1)).toBe(false);
    expect(isPriceConsistent(1, Number.POSITIVE_INFINITY)).toBe(false);
  });
});
