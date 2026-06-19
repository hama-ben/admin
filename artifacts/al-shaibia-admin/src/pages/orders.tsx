import { useEffect, useState } from "react";
import { supabase, type Order } from "@/lib/supabase";
import { ALGERIAN_WILAYAS, formatDZD, formatDate } from "@/lib/constants";
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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 20;

  useEffect(() => {
    setPage(0);
  }, [statusFilter, dateFrom, dateTo]);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        let query = supabase
          .from("orders")
          .select(
            "*, customer:user_id(id,name,phone), driver:driver_id(id,name,phone)",
            { count: "exact" }
          );

        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }
        if (dateFrom) {
          query = query.gte("created_at", new Date(dateFrom).toISOString());
        }
        if (dateTo) {
          const toDate = new Date(dateTo);
          toDate.setDate(toDate.getDate() + 1);
          query = query.lte("created_at", toDate.toISOString());
        }

        query = query
          .order("created_at", { ascending: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const { data, count, error } = await query;
        if (error) throw error;

        setOrders((data as Order[]) || []);
        if (count !== null) setTotalCount(count);
      } catch (err: any) {
        console.error("Failed to fetch orders", err);
        toast({ title: "Error fetching orders", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [statusFilter, dateFrom, dateTo, page, toast]);

  const handleExportCSV = () => {
    const headers = ["Order ID", "Customer", "Customer Phone", "Driver", "Water Volume", "Barrels", "Price (DZD)", "Status", "Date"];
    const csvContent = [
      headers.join(","),
      ...orders.map((o) => [
        o.id,
        `"${o.customer?.name || "N/A"}"`,
        `"${o.customer?.phone || ""}"`,
        `"${o.driver?.name || "Unassigned"}"`,
        `"${o.water_volume}"`,
        o.barrel_count,
        o.total_price,
        `"${STATUS_LABELS[o.status] || o.status}"`,
        formatDate(o.created_at),
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `orders_export_${new Date().toISOString().split("T")[0]}.csv`;
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  function getStatusBadge(status: string) {
    const label = STATUS_LABELS[status] || status;
    const style = STATUS_STYLES[status] || "";
    return (
      <Badge variant="outline" className={style}>
        {label}
      </Badge>
    );
  }

  function getDeliveryInfo(order: Order) {
    if (!order.driver) return null;
    const elapsed = Math.round((Date.now() - new Date(order.created_at).getTime()) / 60000);
    return (
      <div className="text-xs text-muted-foreground mt-0.5">
        {elapsed > 60
          ? `${Math.round(elapsed / 60)}h ${elapsed % 60}m`
          : `${elapsed}m`}
      </div>
    );
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
            <SelectTrigger className="w-[220px]">
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
          <label className="text-xs text-muted-foreground font-medium">From Date</label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">To Date</label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Driver / Delivery</TableHead>
              <TableHead>Order Details</TableHead>
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
                  No orders found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map((order) => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">
                    {order.id.slice(0, 8)}…
                  </TableCell>
                  <TableCell>
                    <div className="font-medium">{order.customer?.name || <span className="text-muted-foreground italic">Unknown</span>}</div>
                    {order.customer?.phone && (
                      <div className="text-xs text-muted-foreground font-mono">{order.customer.phone}</div>
                    )}
                  </TableCell>
                  <TableCell>
                    {order.driver ? (
                      <div>
                        <div className="font-medium">{order.driver.name}</div>
                        {order.status !== "تم التوصيل" && getDeliveryInfo(order)}
                      </div>
                    ) : (
                      <span className="text-muted-foreground italic text-sm">Unassigned</span>
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
