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

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdminDashboard } from "@/components/admin-dashboard";
import { UserDashboard } from "@/components/user-dashboard";

export default async function DashboardPage() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  // 1. Ensure a user is logged in
  if (error || !user) {
    redirect("/auth/login");
  }

  // 2. Perform the security check on the server
  // We compare the user's email with the secure environment variable.
  const isAdmin = user.email === process.env.ADMIN_EMAIL;

  // 3. Render the appropriate dashboard component
  // A regular user's browser will never receive the <AdminDashboard /> component.
  return isAdmin ? <AdminDashboard /> : <UserDashboard />;
}