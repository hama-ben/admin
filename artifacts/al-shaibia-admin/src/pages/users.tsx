import { useEffect, useState } from "react";
import { supabase, type Driver, type DriverDetails } from "@/lib/supabase";
import { ALGERIAN_WILAYAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search, Info } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { formatDate } from "@/lib/constants";

interface DriverRow extends Driver {
  details?: DriverDetails | null;
}

function getStatusBadge(status?: string) {
  switch (status) {
    case "approved": return <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">Approved</Badge>;
    case "pending":  return <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>;
    case "rejected": return <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30">Rejected</Badge>;
    default:         return <Badge variant="outline">{status || "—"}</Badge>;
  }
}

export default function UsersPage() {
  const [drivers, setDrivers] = useState<DriverRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState("all");
  const [search, setSearch] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();
  const PAGE_SIZE = 20;

  useEffect(() => { setPage(0); }, [statusTab, search, wilayaFilter]);

  useEffect(() => {
    const timer = setTimeout(fetchDrivers, search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [statusTab, search, wilayaFilter, page]);

  async function fetchDrivers() {
    setLoading(true);
    try {
      let query = supabase.from("drivers").select("*", { count: "exact" });
      if (statusTab !== "all") query = query.eq("status", statusTab);

      const { data, count, error } = await query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;

      // Enrich with driver_details for wilaya/commune
      if (data && data.length > 0) {
        const ids = data.map((d) => d.user_id);
        const { data: details } = await supabase
          .from("driver_details")
          .select("driver_id, wilaya, commune")
          .in("driver_id", ids);
        const detailsMap = new Map((details ?? []).map((d) => [d.driver_id, d]));

        let enriched: DriverRow[] = data.map((d) => ({ ...d, details: detailsMap.get(d.user_id) ?? null }));

        // Client-side wilaya filter (since it's in driver_details)
        if (wilayaFilter !== "all") {
          enriched = enriched.filter((d) => d.details?.wilaya === wilayaFilter);
        }

        setDrivers(enriched);
      } else {
        setDrivers([]);
      }

      setTotalCount(count ?? 0);
    } catch (err: any) {
      toast({ title: "Error fetching drivers", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const filtered = search
    ? drivers.filter((d) => d.user_id.includes(search) || d.details?.wilaya?.includes(search) || d.details?.commune?.includes(search))
    : drivers;

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Drivers</h1>
        <p className="text-muted-foreground mt-2">All registered drivers on the platform.</p>
      </div>

      {/* Note about consumers */}
      <div className="flex items-start gap-2 p-3 rounded-lg bg-blue-500/10 border border-blue-500/20 text-sm text-blue-400">
        <Info className="w-4 h-4 mt-0.5 shrink-0" />
        <span>Consumer accounts are managed in the customer-facing app. This panel shows driver accounts only (from the <code className="font-mono text-xs">drivers</code> table).</span>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex gap-2">
          {(["all", "pending", "approved", "rejected"] as const).map((s) => (
            <Button
              key={s}
              size="sm"
              variant={statusTab === s ? "default" : "outline"}
              onClick={() => setStatusTab(s)}
              className="capitalize"
            >
              {s === "all" ? `All (${totalCount})` : s}
            </Button>
          ))}
        </div>

        <div className="flex gap-3">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search ID, wilaya…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
            <SelectTrigger className="w-[180px]"><SelectValue placeholder="All Wilayas" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wilayas</SelectItem>
              {ALGERIAN_WILAYAS.map((w) => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Driver ID</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Online</TableHead>
              <TableHead>CCP Status</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Registered</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>{Array(7).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No drivers found.</TableCell>
              </TableRow>
            ) : (
              filtered.map((driver) => (
                <TableRow key={driver.user_id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{driver.user_id.slice(0, 20)}…</TableCell>
                  <TableCell>{driver.details?.wilaya || "—"}</TableCell>
                  <TableCell>{driver.details?.commune || "—"}</TableCell>
                  <TableCell>
                    <span className={`inline-block w-2 h-2 rounded-full ${driver.is_online ? "bg-green-500" : "bg-muted-foreground/40"}`} />
                  </TableCell>
                  <TableCell>{driver.ccp_status || "—"}</TableCell>
                  <TableCell>{getStatusBadge(driver.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(driver.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {filtered.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} drivers
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage((p) => Math.max(0, p - 1))} disabled={page === 0 || loading}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage((p) => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}
