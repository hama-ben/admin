import { useEffect, useState } from "react";
import { supabase, type Payment, type PaymentStatus } from "@/lib/supabase";
import { ALGERIAN_WILAYAS, formatDZD, formatDate } from "@/lib/constants";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { CreditCard, Check, X, TrendingUp, Image as ImageIcon } from "lucide-react";
import {
  AreaChart, Area, BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip, Legend
} from "recharts";

type ChartType = "area" | "bar" | "pie";

export default function PaymentsPage() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<PaymentStatus>("pending");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [revenueByWilaya, setRevenueByWilaya] = useState<{ wilaya: string; amount: number }[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
    fetchRevenueSummary();
  }, [statusTab, wilayaFilter]);

  async function fetchPayments() {
    setLoading(true);
    try {
      let query = supabase
        .from("payments")
        .select("*, driver:users!payments_driver_id_fkey(*)")
        .eq("status", statusTab)
        .order("created_at", { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      setPayments(data || []);
    } catch (err: any) {
      toast({ title: "Error fetching payments", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchRevenueSummary() {
    try {
      const { data: approvedPayments } = await supabase
        .from("payments")
        .select("amount, driver_id")
        .eq("status", "approved");

      const total = approvedPayments?.reduce((sum, p) => sum + Number(p.amount), 0) || 0;
      setTotalRevenue(total);

      const { data: joinedData } = await supabase
        .from("payments")
        .select("amount, driver:users!payments_driver_id_fkey(wilaya)")
        .eq("status", "approved");

      const byWilaya: Record<string, number> = {};
      joinedData?.forEach((p: any) => {
        const w = p.driver?.wilaya || "Unknown";
        if (wilayaFilter !== "all" && w !== wilayaFilter) return;
        byWilaya[w] = (byWilaya[w] || 0) + Number(p.amount);
      });

      const sorted = Object.entries(byWilaya)
        .map(([wilaya, amount]) => ({ wilaya, amount }))
        .sort((a, b) => b.amount - a.amount)
        .slice(0, 15);

      setRevenueByWilaya(sorted);
    } catch (err) {
      console.error("Revenue summary error", err);
    }
  }

  const handleAction = async (id: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase.from("payments").update({ status }).eq("id", id);
      if (error) throw error;
      toast({ title: `Payment ${status}`, description: `Successfully ${status} the payment.` });
      setPayments(payments.filter(p => p.id !== id));
      fetchRevenueSummary();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  const CHART_COLORS = ["hsl(185,70%,45%)", "hsl(210,80%,60%)", "hsl(150,60%,45%)", "hsl(30,80%,55%)", "hsl(270,60%,60%)"];

  const renderChart = () => {
    if (revenueByWilaya.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          No revenue data available.
        </div>
      );
    }

    if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={revenueByWilaya} dataKey="amount" nameKey="wilaya" outerRadius={120} label={({ wilaya, percent }) => `${wilaya} (${(percent * 100).toFixed(0)}%)`} labelLine>
              {revenueByWilaya.map((_, i) => (
                <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(val: number) => formatDZD(val)} contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }

    if (chartType === "bar") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={revenueByWilaya}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 18%)" vertical={false} />
            <XAxis dataKey="wilaya" stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
            <YAxis stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
            <Tooltip formatter={(val: number) => formatDZD(val)} contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
            <Bar dataKey="amount" fill="hsl(185,70%,45%)" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      );
    }

    return (
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={revenueByWilaya}>
          <defs>
            <linearGradient id="revGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="hsl(185,70%,45%)" stopOpacity={0.3} />
              <stop offset="95%" stopColor="hsl(185,70%,45%)" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 18%)" vertical={false} />
          <XAxis dataKey="wilaya" stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
          <Tooltip formatter={(val: number) => formatDZD(val)} contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
          <Area type="monotone" dataKey="amount" stroke="hsl(185,70%,45%)" strokeWidth={2} fill="url(#revGrad)" />
        </AreaChart>
      </ResponsiveContainer>
    );
  };

  const getTabBadge = (status: PaymentStatus) => {
    switch (status) {
      case "pending": return "bg-amber-500/20 text-amber-500 border-amber-500/20";
      case "approved": return "bg-green-500/20 text-green-500 border-green-500/20";
      case "rejected": return "bg-red-500/20 text-red-500 border-red-500/20";
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      {/* CCP Banner */}
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-5 flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Official CCP Verification Account
          </h2>
          <p className="text-sm text-muted-foreground mt-1">Cross-check all payment receipts against this account before approving.</p>
        </div>
        <div className="bg-background/50 px-6 py-3 rounded border border-border shrink-0">
          <span className="font-mono text-xl font-bold tracking-widest text-primary">
            00799999001 <span className="text-amber-500">1234567890</span>
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments — مدفوعات</h1>
        <p className="text-muted-foreground mt-1">Review and confirm incoming payment receipts.</p>
      </div>

      {/* Revenue Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Total Approved Revenue</p>
              <p className="text-3xl font-bold mt-2 text-primary">{formatDZD(totalRevenue)}</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Revenue by Wilaya</CardTitle>
              <div className="flex gap-2">
                <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
                  <SelectTrigger className="w-[160px] h-8 text-xs">
                    <SelectValue placeholder="All Wilayas" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Wilayas</SelectItem>
                    {ALGERIAN_WILAYAS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
                  </SelectContent>
                </Select>
                <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                  <SelectTrigger className="w-[100px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="bar">Bar</SelectItem>
                    <SelectItem value="area">Line</SelectItem>
                    <SelectItem value="pie">Pie</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardHeader>
        </Card>
      </div>

      {/* Chart */}
      <Card>
        <CardContent className="h-[300px] pt-6">
          {renderChart()}
        </CardContent>
      </Card>

      {/* Tabs */}
      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as PaymentStatus)}>
        <TabsList className="grid w-[400px] grid-cols-3">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Payment Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-24 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card border rounded-lg border-dashed">
          <CreditCard className="w-12 h-12 mb-4 opacity-30" />
          <h3 className="text-xl font-medium text-foreground">No {statusTab} payments</h3>
          <p className="text-sm mt-1">All {statusTab} payments will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {payments.map(payment => (
            <Card key={payment.id} className="flex flex-col border-border bg-card">
              <CardContent className="p-5 flex flex-col gap-4 flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-base">{(payment as any).driver?.name || "Unknown Driver"}</p>
                    <p className="text-sm text-muted-foreground">{(payment as any).driver?.phone}</p>
                  </div>
                  <Badge variant="outline" className={getTabBadge(payment.status)}>
                    {payment.status}
                  </Badge>
                </div>

                <div className="text-2xl font-bold text-primary">{formatDZD(payment.amount)}</div>

                {payment.receipt_url ? (
                  <div
                    className="relative w-full h-36 rounded-md overflow-hidden border border-border cursor-pointer group"
                    onClick={() => setSelectedImage(payment.receipt_url)}
                    data-testid={`receipt-image-${payment.id}`}
                  >
                    <img src={payment.receipt_url} alt="Receipt" className="object-cover w-full h-full" />
                    <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                      <ImageIcon className="w-6 h-6 text-white" />
                      <span className="text-white text-sm font-medium">View Full Receipt</span>
                    </div>
                  </div>
                ) : (
                  <div className="w-full h-24 rounded-md border border-dashed border-border flex items-center justify-center text-sm text-muted-foreground">
                    No receipt uploaded
                  </div>
                )}

                <p className="text-xs text-muted-foreground">{formatDate(payment.created_at)}</p>

                {payment.status === "pending" && (
                  <div className="grid grid-cols-2 gap-3 mt-auto">
                    <Button
                      variant="outline"
                      className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                      onClick={() => handleAction(payment.id, "rejected")}
                      data-testid={`button-reject-${payment.id}`}
                    >
                      <X className="w-4 h-4 mr-1" /> Reject
                    </Button>
                    <Button
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={() => handleAction(payment.id, "approved")}
                      data-testid={`button-approve-${payment.id}`}
                    >
                      <Check className="w-4 h-4 mr-1" /> Approve
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0">
          {selectedImage && (
            <img src={selectedImage} alt="Receipt Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
