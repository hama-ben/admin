import { useEffect, useState } from "react";
import { api } from "@/lib/api";

export function usePendingDisputeCount() {
  const [count, setCount] = useState(0);

  async function fetchCount() {
    try {
      const data = await api.get<{ count: number }>("/disputes/pending-count");
      setCount(data.count);
    } catch {
      // silently ignore
    }
  }

  useEffect(() => {
    fetchCount();
    const interval = setInterval(fetchCount, 30_000);
    return () => clearInterval(interval);
  }, []);

  return count;
}
