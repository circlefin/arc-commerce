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

export const USDC_DECIMALS = 6;

/** Price of one credit, in USDC. Single source of truth for client and server. */
export const USDC_PER_CREDIT = 1;

const MICRO = 10 ** USDC_DECIMALS;

/** Converts a decimal USDC amount to 6-decimal base units without float drift. */
export function usdcToMicro(usdc: number): bigint {
  return BigInt(Math.round(usdc * MICRO));
}

/** Converts USDC base units to a decimal number (for display / storage in numeric(18,6)). */
export function microToUsdc(micro: bigint): number {
  return Number(micro / BigInt(MICRO)) + Number(micro % BigInt(MICRO)) / MICRO;
}

/**
 * True when the client-supplied `usdcAmount` is what `credits` cost.
 * The server never credits based on a price the client chose.
 */
export function isPriceConsistent(credits: number, usdcAmount: number): boolean {
  if (!Number.isFinite(credits) || !Number.isFinite(usdcAmount)) return false;
  return usdcToMicro(usdcAmount) === usdcToMicro(credits * USDC_PER_CREDIT);
}
