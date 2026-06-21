import { useEffect, useRef, useState } from "react";
import { supabase, USER_TYPE_DRIVER } from "@/lib/supabase";

export interface DriverCounts {
  pending: number;
  rejected: number;
  expired: number;
}

export function useDriverCounts(): DriverCounts {
  const [counts, setCounts] = useState<DriverCounts>({ pending: 0, rejected: 0, expired: 0 });
  const channelName = useRef(`driver-counts-${Math.random().toString(36).slice(2)}`);

  async function fetchCounts() {
    const now = new Date().toISOString();
    const [{ count: pending }, { count: rejected }, { count: expired }] = await Promise.all([
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", USER_TYPE_DRIVER)
        .eq("account_status", "pending"),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", USER_TYPE_DRIVER)
        .eq("account_status", "rejected"),
      supabase
        .from("users")
        .select("*", { count: "exact", head: true })
        .eq("user_type", USER_TYPE_DRIVER)
        .eq("account_status", "approved")
        .lt("subscription_expires_at", now),
    ]);
    setCounts({ pending: pending ?? 0, rejected: rejected ?? 0, expired: expired ?? 0 });
  }

  useEffect(() => {
    fetchCounts();
    const channel = supabase
      .channel(channelName.current)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchCounts)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return counts;
}
