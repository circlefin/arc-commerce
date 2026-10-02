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

"use client";

import { useIsClient } from "@/hooks/use-is-client";
import { format } from "date-fns";

interface ClientDateProps {
  date: Date | string;
  formatString?: string;
}

export function ClientDate({ date, formatString = "PPpp" }: ClientDateProps) {
  const mounted = useIsClient();

  if (!mounted) {
    return <span suppressHydrationWarning>&nbsp;</span>;
  }

  let formatted: string;
  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    formatted = format(dateObj, formatString);
  } catch {
    formatted = "Invalid date";
  }
  return <span suppressHydrationWarning>{formatted}</span>;
}

