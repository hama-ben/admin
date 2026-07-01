import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export function usePendingDisputeCount() {
  const [count, setCount] = useState(0);

  async function fetchCount() {
    const { count: c } = await supabase
      .from("ratings")
      .select("*", { count: "exact", head: true })
      .eq("is_disputed", true);
    setCount(c ?? 0);
  }

  useEffect(() => {
    fetchCount();
    const channel = supabase
      .channel("pending-disputes-count")
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings" }, fetchCount)
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, []);

  return count;
}
