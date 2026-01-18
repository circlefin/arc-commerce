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

// components/CopyTxHashButton.tsx
"use client";
import { Button } from "@/components/ui/button";
import { Copy } from "lucide-react";

export function CopyTxHashButton({ txHash }: { txHash: string }) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className="h-6 w-6 p-0"
      onClick={() => navigator.clipboard.writeText(txHash)}
    >
      <Copy className="w-3 h-3" />
    </Button>
  );
}
