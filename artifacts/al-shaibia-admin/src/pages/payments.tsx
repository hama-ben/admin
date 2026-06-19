import { useEffect, useState } from "react";
import { supabase, type SubscriptionPayment, type PaymentStatus, insertTargetedAnnouncement } from "@/lib/supabase";
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
  BarChart, Bar, PieChart, Pie, Cell,
  ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip,
} from "recharts";

const FB_LINK = "https://www.facebook.com/profile.php?id=61590856328769";

type ChartType = "bar" | "pie";

function findReceiptUrl(payment: SubscriptionPayment): string | null {
  const urlKeys = Object.keys(payment).filter(
    (k) => k !== "id" && k !== "driver_id" && k !== "status" && k !== "created_at" &&
    typeof payment[k] === "string" &&
    (payment[k].startsWith("http") || payment[k].includes("supabase"))
  );
  return urlKeys.length > 0 ? payment[urlKeys[0]] : null;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<SubscriptionPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<PaymentStatus>("pending");
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [wilayaRevenue, setWilayaRevenue] = useState<{ wilaya: string; count: number }[]>([]);
  const [approvedCount, setApprovedCount] = useState(0);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
    fetchRevenueSummary();
  }, [statusTab]);

  async function fetchPayments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*, driver:driver_id(id, name, phone, wilaya, subscription_expires_at)")
        .eq("status", statusTab)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPayments((data as SubscriptionPayment[]) || []);
    } catch (err: any) {
      toast({ title: "Error fetching payments", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchRevenueSummary() {
    try {
      const { data: approved } = await supabase
        .from("subscription_payments")
        .select("*, driver:driver_id(wilaya)")
        .eq("status", "approved");

      const count = approved?.length || 0;
      setApprovedCount(count);
      const revEstimate = count * 1000;
      setTotalRevenue(revEstimate);

      const byWilaya: Record<string, number> = {};
      approved?.forEach((p: any) => {
        const w = p.driver?.wilaya || "Unknown";
        byWilaya[w] = (byWilaya[w] || 0) + 1;
      });

      setWilayaRevenue(
        Object.entries(byWilaya)
          .map(([wilaya, count]) => ({ wilaya, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 15)
      );
    } catch (err) {
      console.error("Revenue summary error", err);
    }
  }

  async function handleApprove(payment: SubscriptionPayment) {
    setActionLoading(payment.id);
    try {
      const { error: updatePayment } = await supabase
        .from("subscription_payments")
        .update({ status: "approved" })
        .eq("id", payment.id);

      if (updatePayment) throw updatePayment;

      const currentExpiry = payment.driver?.subscription_expires_at
        ? new Date(payment.driver.subscription_expires_at)
        : new Date();
      const base = Math.max(currentExpiry.getTime(), Date.now());
      const newExpiry = new Date(base + 30 * 24 * 60 * 60 * 1000);

      await supabase
        .from("users")
        .update({ subscription_expires_at: newExpiry.toISOString(), account_status: "active" })
        .eq("id", payment.driver_id);

      await insertTargetedAnnouncement(
        "تم قبول دفع وصلك",
        "تم إضافة 30 يوم إلى حسابك",
        "Success",
        payment.driver_id
      );

      toast({ title: "Payment Confirmed", description: "Subscription extended by 30 days and driver notified." });
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      fetchRevenueSummary();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(payment: SubscriptionPayment) {
    setActionLoading(payment.id);
    try {
      const { error: updatePayment } = await supabase
        .from("subscription_payments")
        .update({ status: "rejected" })
        .eq("id", payment.id);

      if (updatePayment) throw updatePayment;

      await insertTargetedAnnouncement(
        "تم رفض دفعك",
        `عذراً، لم يتم قبول وصل الدفع. يرجى التواصل معنا: ${FB_LINK}`,
        "Warning",
        payment.driver_id
      );

      toast({ title: "Payment Rejected", description: "Driver has been notified." });
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const CHART_COLORS = ["hsl(185,70%,45%)", "hsl(210,80%,60%)", "hsl(150,60%,45%)", "hsl(30,80%,55%)", "hsl(270,60%,60%)"];

  const renderChart = () => {
    if (wilayaRevenue.length === 0) {
      return (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          No approved payment data yet.
        </div>
      );
    }
    if (chartType === "pie") {
      return (
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={wilayaRevenue} dataKey="count" nameKey="wilaya" outerRadius={110}
              label={({ wilaya, percent }) => `${wilaya} (${(percent * 100).toFixed(0)}%)`}>
              {wilayaRevenue.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
            </Pie>
            <Tooltip formatter={(val: number) => [val, "Approved Payments"]}
              contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
          </PieChart>
        </ResponsiveContainer>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={wilayaRevenue}>
          <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 18%)" vertical={false} />
          <XAxis dataKey="wilaya" stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} tick={{ fontSize: 11 }} />
          <YAxis stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} allowDecimals={false} />
          <Tooltip formatter={(val: number) => [val, "Approved Payments"]}
            contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
          <Bar dataKey="count" fill="hsl(185,70%,45%)" radius={[4, 4, 0, 0]} />
        </BarChart>
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
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Payments — مدفوعات</h1>
        <p className="text-muted-foreground mt-1">Review subscription payment receipts from drivers.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardContent className="p-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-muted-foreground">Approved Payments</p>
              <p className="text-3xl font-bold mt-2 text-primary">{approvedCount}</p>
              <p className="text-xs text-muted-foreground mt-1">total confirmed subscriptions</p>
            </div>
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-base">Payments by Wilaya</CardTitle>
              <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="pie">Pie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardContent className="h-[280px] pt-6">
          {renderChart()}
        </CardContent>
      </Card>

      <Tabs value={statusTab} onValueChange={(v) => setStatusTab(v as PaymentStatus)}>
        <TabsList className="grid w-[360px] grid-cols-3">
          <TabsTrigger value="pending">Pending</TabsTrigger>
          <TabsTrigger value="approved">Approved</TabsTrigger>
          <TabsTrigger value="rejected">Rejected</TabsTrigger>
        </TabsList>
      </Tabs>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-5 space-y-3">
                <Skeleton className="h-5 w-32" />
                <Skeleton className="h-36 w-full" />
                <Skeleton className="h-9 w-full" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : payments.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card border rounded-lg border-dashed">
          <CreditCard className="w-12 h-12 mb-4 opacity-30" />
          <h3 className="text-xl font-medium text-foreground">No {statusTab} payments</h3>
          <p className="text-sm mt-1">Payment receipts will appear here when submitted.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {payments.map((payment) => {
            const receiptUrl = findReceiptUrl(payment);
            return (
              <Card key={payment.id} className="flex flex-col border-border bg-card">
                <CardContent className="p-5 flex flex-col gap-4 flex-1">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="font-semibold text-base">{payment.driver?.name || "Unknown Driver"}</p>
                      <p className="text-sm text-muted-foreground font-mono">{payment.driver?.phone}</p>
                      {payment.driver?.wilaya && (
                        <p className="text-xs text-muted-foreground">{payment.driver.wilaya}</p>
                      )}
                    </div>
                    <Badge variant="outline" className={getTabBadge(payment.status)}>
                      {payment.status}
                    </Badge>
                  </div>

                  {receiptUrl ? (
                    <div
                      className="relative w-full h-36 rounded-md overflow-hidden border border-border cursor-pointer group"
                      onClick={() => setSelectedImage(receiptUrl)}
                    >
                      <img src={receiptUrl} alt="Receipt" className="object-cover w-full h-full" />
                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        <ImageIcon className="w-6 h-6 text-white" />
                        <span className="text-white text-sm font-medium">View Receipt</span>
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
                        className="text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 gap-1"
                        onClick={() => handleReject(payment)}
                        disabled={actionLoading === payment.id}
                      >
                        <X className="w-4 h-4" /> رفض
                      </Button>
                      <Button
                        className="bg-green-600 hover:bg-green-700 text-white gap-1"
                        onClick={() => handleApprove(payment)}
                        disabled={actionLoading === payment.id}
                      >
                        <Check className="w-4 h-4" /> تأكيد
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
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
