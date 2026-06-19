import { useEffect, useState } from "react";
import { supabase, type Order, type User } from "@/lib/supabase";
import { formatDZD, formatDate } from "@/lib/constants";
import { ALGERIAN_WILAYAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const STATUS_LABELS: Record<string, string> = {
  "معلق": "معلق في انتظار",
  "تم التوصيل": "مكتمل",
  "ملغاة من طرف المستهلك": "ملغاة من طرف المستهلك",
};

const STATUS_STYLES: Record<string, string> = {
  "معلق": "bg-amber-500/20 text-amber-500 border-amber-500/20",
  "تم التوصيل": "bg-green-500/20 text-green-500 border-green-500/20",
  "ملغاة من طرف المستهلك": "bg-red-500/20 text-red-500 border-red-500/20",
};

interface EnrichedOrder extends Order {
  customerUser?: User;
  driverUser?: User;
}

export default function OrdersPage() {
  const [orders, setOrders] = useState<EnrichedOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 20;

  useEffect(() => { setPage(0); }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    fetchOrders();
  }, [statusFilter, dateFrom, dateTo, page]);

  async function fetchOrders() {
    setLoading(true);
    try {
      // Step 1: fetch plain orders (no embed — no FK constraints in DB)
      let query = supabase
        .from("orders")
        .select("*", { count: "exact" });

      if (statusFilter !== "all") query = query.eq("status", statusFilter);
      if (dateFrom) query = query.gte("created_at", new Date(dateFrom).toISOString());
      if (dateTo) {
        const toDate = new Date(dateTo);
        toDate.setDate(toDate.getDate() + 1);
        query = query.lte("created_at", toDate.toISOString());
      }
      query = query
        .order("created_at", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      const { data: rawOrders, count, error } = await query;
      if (error) throw error;

      if (count !== null) setTotalCount(count);

      if (!rawOrders || rawOrders.length === 0) {
        setOrders([]);
        return;
      }

      // Step 2: collect all user IDs (customers + drivers), fetch in one query
      const userIdSet = new Set<string>();
      rawOrders.forEach((o: Order) => {
        if (o.user_id) userIdSet.add(o.user_id);
        if (o.driver_id) userIdSet.add(o.driver_id);
      });
      const allUserIds = Array.from(userIdSet);

      const { data: usersData } = await supabase
        .from("users")
        .select("id, name, phone, wilaya")
        .in("id", allUserIds);

      const usersMap = new Map<string, User>();
      (usersData || []).forEach((u: User) => usersMap.set(u.id, u));

      // Step 3: enrich orders
      const enriched: EnrichedOrder[] = rawOrders.map((o: Order) => ({
        ...o,
        customerUser: o.user_id ? usersMap.get(o.user_id) : undefined,
        driverUser: o.driver_id ? usersMap.get(o.driver_id) : undefined,
      }));

      setOrders(enriched);
    } catch (err: any) {
      console.error("fetchOrders error:", err);
      toast({ title: "Error fetching orders", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  function getStatusBadge(status: string) {
    return (
      <Badge variant="outline" className={STATUS_STYLES[status] || ""}>
        {STATUS_LABELS[status] || status}
      </Badge>
    );
  }

  function handleExportCSV() {
    const headers = ["Order ID", "Customer", "Customer Phone", "Driver", "Water Volume", "Barrels", "Price (DZD)", "Status", "Date"];
    const rows = orders.map((o) => [
      o.id,
      `"${o.customerUser?.name || "N/A"}"`,
      `"${o.customerUser?.phone || ""}"`,
      `"${o.driverUser?.name || "Unassigned"}"`,
      `"${o.water_volume}"`,
      o.barrel_count,
      o.total_price,
      `"${STATUS_LABELS[o.status] || o.status}"`,
      formatDate(o.created_at),
    ].join(","));
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders_${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-2">Full history of all platform orders.</p>
        </div>
        <Button onClick={handleExportCSV} variant="outline" className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-wrap bg-card p-4 rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[240px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="معلق">معلق في انتظار</SelectItem>
              <SelectItem value="تم التوصيل">مكتمل</SelectItem>
              <SelectItem value="ملغاة من طرف المستهلك">ملغاة من طرف المستهلك</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">From</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">To</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead>Details</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No orders found.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customerUser?.name || <span className="italic text-muted-foreground">Unknown</span>}</div>
                    {order.customerUser?.phone && (
                      <div className="text-xs text-muted-foreground font-mono">{order.customerUser.phone}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.driverUser ? (
                      <div>
                        <div className="font-medium">{order.driverUser.name}</div>
                        <div className="text-xs text-muted-foreground font-mono">{order.driverUser.phone}</div>
                      </div>
                    ) : (
                      <span className="italic text-muted-foreground text-sm">Unassigned</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <div>{order.water_volume}</div>
                    <div className="text-xs text-muted-foreground">{order.barrel_count} barrel{order.barrel_count !== 1 ? "s" : ""}</div>
                  </TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{formatDZD(order.total_price)}</TableCell>
                  <TableCell>{getStatusBadge(order.status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">{formatDate(order.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {orders.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} orders
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
