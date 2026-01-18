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

/**
 * Converts a USDC amount string (e.g., "1.50") to its smallest unit as an integer.
 * USDC has 6 decimal places, so 1 USDC = 1,000,000 of its smallest unit.
 *
 * @param amount The amount of USDC as a string (e.g., "1", "0.01").
 * @returns The amount in the smallest unit as a number.
 */
export function convertToSmallestUnit(amount: string): number {
  // The number of decimal places for USDC
  const usdcDecimals = 6;

  // The multiplier to convert from whole units to the smallest unit
  const multiplier = 10 ** usdcDecimals; // This is 1,000,000

  // Parse the string amount to a float and multiply
  const amountInSmallestUnit = parseFloat(amount) * multiplier;

  // Return the rounded integer to avoid floating-point inaccuracies
  return Math.round(amountInSmallestUnit);
}