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

import { useEffect, useState } from "react";
import { format } from "date-fns";

interface ClientDateProps {
  date: Date | string;
  formatString?: string;
}

/**
 * Client-side date formatter that prevents hydration mismatches.
 * Only renders the formatted date after the component mounts on the client.
 * This ensures consistent formatting between server and client renders.
 */
export function ClientDate({ date, formatString = "PPpp" }: ClientDateProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // During SSR, return empty content to avoid hydration mismatch
    // The actual date will render after mount
    return <span suppressHydrationWarning>&nbsp;</span>;
  }

  try {
    const dateObj = typeof date === "string" ? new Date(date) : date;
    return <span suppressHydrationWarning>{format(dateObj, formatString)}</span>;
  } catch {
    return <span suppressHydrationWarning>Invalid date</span>;
  }
}

