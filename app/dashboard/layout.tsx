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

import { EnvVarWarning } from "@/components/env-var-warning";
import { AuthButton } from "@/components/auth-button";
import { ThemeSwitcher } from "@/components/theme-switcher";
import { hasEnvVars } from "@/lib/utils";
import Link from "next/link";
import { WalletProvider } from "@/components/wallet/wallet-provider";

export default function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <WalletProvider>
      <main className="min-h-screen flex flex-col items-center">
        <div className="flex-1 w-full flex flex-col gap-20 items-center">
          <nav className="w-full flex justify-center border-b border-b-foreground/10 h-16">
            <div className="w-full max-w-5xl flex justify-between items-center p-3 px-5 text-sm">
              <div className="flex gap-5 items-center font-semibold">
                <ThemeSwitcher />
                <Link href={"/"}>top-up</Link>
              </div>
              <div className="flex items-center gap-3">
                {/* The wallet buttons have been removed from here */}
                {!hasEnvVars ? <EnvVarWarning /> : <AuthButton />}
              </div>
            </div>
          </nav>
          <div className="flex-1 flex flex-col gap-20 max-w-5xl w-full p-5">
            {children}
          </div>
        </div>
      </main>
    </WalletProvider>
  );
}