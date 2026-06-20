import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function usePendingDisputeCount() {
  const [count, setCount] = useState(0);

  async function fetchCount() {
    const { count: c } = await supabase
      .from("ratings_disputes")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    setCount(c ?? 0);
  }

  useEffect(() => {
    fetchCount();
    const channel = supabase
      .channel("pending-disputes-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings_disputes" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}
