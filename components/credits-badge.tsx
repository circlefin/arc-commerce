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
import { Badge } from "@/components/ui/badge";
import { createClient } from "@/lib/supabase/client";

interface CreditsBadgeProps {
  initialCredits: number;
  userId: string;
}

// This component receives the initial credit balance from the server,
// then subscribes to real-time updates to keep the display in sync.
export function CreditsBadge({ initialCredits, userId }: CreditsBadgeProps) {
  const [credits, setCredits] = useState(initialCredits);
  const [supabase] = useState(() => createClient());

  // Format the number for better readability (e.g., 1,000.50)
  const formattedBalance = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(credits);

  useEffect(() => {
    // Fetch current credits from the database
    const fetchCredits = async () => {
      const { data, error } = await supabase
        .from("credits")
        .select("credits")
        .eq("user_id", userId)
        .single();

      if (!error && data) {
        console.log("Fetched credits:", data.credits);
        setCredits(data.credits);
      } else if (error) {
        console.error("Error fetching credits:", error);
      }
    };

    // Create a channel for real-time updates
    const channel = supabase
      .channel(`credits-user-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "credits",
          filter: `user_id=eq.${userId}`, // Listen only to changes for this user
        },
        (payload) => {
          // When an update is received, get the new credits value
          if (payload.new && typeof payload.new === "object" && "credits" in payload.new) {
            const newCredits = payload.new.credits as number;
            console.log("Real-time credit event received:", payload.eventType, "New credits:", newCredits);
            // Update the component's state to re-render with the new value
            setCredits(newCredits);
          } else {
            console.warn("Received payload without expected credits field:", payload);
          }
        }
      )
      .subscribe((status) => {
        console.log("Credits subscription status:", status);
      });

    // Poll for updates every 10 seconds as a fallback
    const pollInterval = setInterval(fetchCredits, 10000);

    // Cleanup function: Unsubscribe from the channel when the component unmounts
    return () => {
      supabase.removeChannel(channel);
      clearInterval(pollInterval);
    };
  }, [userId, supabase]); // Re-run the effect only if the userId changes

  return <Badge variant="outline">Credits: {formattedBalance}</Badge>;
}