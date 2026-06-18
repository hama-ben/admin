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

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("all");
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 20;

  useEffect(() => {
    setPage(0); // Reset page on filter change
  }, [statusFilter, wilayaFilter, dateFrom, dateTo]);

  useEffect(() => {
    async function fetchOrders() {
      setLoading(true);
      try {
        let query = supabase.from("orders").select("*, customer:users!orders_customer_id_fkey(*), driver:users!orders_driver_id_fkey(*)", { count: "exact" });
        
        if (statusFilter !== "all") {
          query = query.eq("status", statusFilter);
        }
        if (wilayaFilter !== "all") {
          query = query.eq("wilaya", wilayaFilter);
        }
        if (dateFrom) {
          query = query.gte("created_at", new Date(dateFrom).toISOString());
        }
        if (dateTo) {
          // Add 1 day to include the end date fully
          const toDate = new Date(dateTo);
          toDate.setDate(toDate.getDate() + 1);
          query = query.lte("created_at", toDate.toISOString());
        }

        query = query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const { data, count, error } = await query;

        if (error) throw error;
        
        setOrders(data || []);
        if (count !== null) setTotalCount(count);
      } catch (err: any) {
        console.error("Failed to fetch orders", err);
        toast({ title: "Error fetching orders", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    fetchOrders();
  }, [statusFilter, wilayaFilter, dateFrom, dateTo, page, toast]);

  const handleExportCSV = () => {
    // Basic CSV export
    const headers = ["Order ID", "Customer", "Driver", "Details", "Price", "Status", "Wilaya", "Date"];
    const csvContent = [
      headers.join(","),
      ...orders.map(o => [
        o.id,
        `"${o.customer?.full_name || 'N/A'}"`,
        `"${o.driver?.full_name || 'N/A'}"`,
        `"${o.details.replace(/"/g, '""')}"`,
        o.price,
        o.status,
        o.wilaya,
        formatDate(o.created_at)
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", `orders_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Completed': return 'bg-green-500/20 text-green-500 border-green-500/20';
      case 'Pending': return 'bg-amber-500/20 text-amber-500 border-amber-500/20';
      case 'Cancelled':
      case 'Rejected': return 'bg-red-500/20 text-red-500 border-red-500/20';
      default: return '';
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Orders</h1>
          <p className="text-muted-foreground mt-2">Full history of all orders across the platform.</p>
        </div>
        <Button onClick={handleExportCSV} className="gap-2">
          <Download className="w-4 h-4" /> Export CSV
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 flex-wrap bg-card p-4 rounded-lg border">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Statuses" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="Pending">Pending</SelectItem>
              <SelectItem value="Completed">Completed</SelectItem>
              <SelectItem value="Cancelled">Cancelled</SelectItem>
              <SelectItem value="Rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Wilaya</label>
          <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Wilayas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wilayas</SelectItem>
              {ALGERIAN_WILAYAS.map(w => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">From Date</label>
          <Input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} className="w-[160px]" />
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">To Date</label>
          <Input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} className="w-[160px]" />
        </div>
      </div>

      <div className="border rounded-md overflow-hidden bg-card flex-1">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Order ID</TableHead>
              <TableHead>Customer</TableHead>
              <TableHead>Driver</TableHead>
              <TableHead className="w-[30%]">Details</TableHead>
              <TableHead>Price</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                </TableRow>
              ))
            ) : orders.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">
                  No orders found matching filters.
                </TableCell>
              </TableRow>
            ) : (
              orders.map(order => (
                <TableRow key={order.id}>
                  <TableCell className="font-mono text-xs text-muted-foreground">{order.id.slice(0, 8)}...</TableCell>
                  <TableCell className="font-medium">{order.customer?.full_name}</TableCell>
                  <TableCell>{order.driver?.full_name || <span className="text-muted-foreground italic">Unassigned</span>}</TableCell>
                  <TableCell className="text-sm truncate max-w-[200px]" title={order.details}>{order.details}</TableCell>
                  <TableCell className="font-medium whitespace-nowrap">{formatDZD(order.price)}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={getStatusColor(order.status)}>
                      {order.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(order.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {orders.length > 0 ? page * PAGE_SIZE + 1 : 0} to {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} results
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0 || loading}>
            <ChevronLeft className="w-4 h-4 mr-1" /> Previous
          </Button>
          <Button variant="outline" size="sm" onClick={() => setPage(p => p + 1)} disabled={(page + 1) * PAGE_SIZE >= totalCount || loading}>
            Next <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
        </div>
      </div>
    </div>
  );
}