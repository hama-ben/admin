import { useEffect, useState } from "react";
import { supabase, type SubscriptionPayment, type Driver, type PaymentStatus } from "@/lib/supabase";
import { formatDate } from "@/lib/constants";
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

type ChartType = "bar" | "pie";

interface EnrichedPayment extends SubscriptionPayment {
  driver?: Driver | null;
}

export default function PaymentsPage() {
  const [payments, setPayments] = useState<EnrichedPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusTab, setStatusTab] = useState<PaymentStatus>("pending");
  const [approvedCount, setApprovedCount] = useState(0);
  const [wilayaRevenue, setWilayaRevenue] = useState<{ wilaya: string; count: number }[]>([]);
  const [chartType, setChartType] = useState<ChartType>("bar");
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPayments();
    fetchSummary();
  }, [statusTab]);

  async function enrichWithDrivers(payments: SubscriptionPayment[]): Promise<EnrichedPayment[]> {
    if (payments.length === 0) return [];
    const driverIds = [...new Set(payments.map((p) => p.driver_id).filter(Boolean))];
    const { data: drivers } = await supabase.from("drivers").select("*").in("user_id", driverIds);
    const driversMap = new Map((drivers ?? []).map((d: Driver) => [d.user_id, d]));
    return payments.map((p) => ({ ...p, driver: driversMap.get(p.driver_id) ?? null }));
  }

  async function fetchPayments() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("subscription_payments")
        .select("*")
        .eq("status", statusTab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      setPayments(await enrichWithDrivers(data ?? []));
    } catch (err: any) {
      toast({ title: "Error fetching payments", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function fetchSummary() {
    try {
      const { data: approved } = await supabase
        .from("subscription_payments")
        .select("driver_id")
        .eq("status", "approved");

      setApprovedCount(approved?.length ?? 0);

      // NOTE: drivers table has no wilaya column — wilaya is in driver_details
      // We show count by driver_id prefix as a placeholder until driver_details is joined
      const byDriver: Record<string, number> = {};
      (approved ?? []).forEach((p) => {
        const key = p.driver_id?.slice(0, 8) || "Unknown";
        byDriver[key] = (byDriver[key] || 0) + 1;
      });
      setWilayaRevenue(
        Object.entries(byDriver)
          .map(([wilaya, count]) => ({ wilaya, count }))
          .sort((a, b) => b.count - a.count)
          .slice(0, 10)
      );
    } catch (err) {
      console.error("Summary error", err);
    }
  }

  async function handleApprove(payment: EnrichedPayment) {
    setActionLoading(payment.id);
    try {
      const { error } = await supabase
        .from("subscription_payments")
        .update({ status: "approved", reviewed_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (error) throw error;

      await supabase.from("announcements").insert({
        title: "تم قبول دفع وصلك",
        content: "تم إضافة 30 يوم إلى حسابك",
        target_audience: "Drivers",
        badge_text: "Success",
        is_active: true,
      });

      toast({ title: "Payment Confirmed", description: "Subscription approved." });
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
      fetchSummary();
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(payment: EnrichedPayment) {
    setActionLoading(payment.id);
    try {
      const { error } = await supabase
        .from("subscription_payments")
        .update({ status: "rejected", reviewed_at: new Date().toISOString() })
        .eq("id", payment.id);
      if (error) throw error;

      await supabase.from("announcements").insert({
        title: "تم رفض دفعك",
        content: "عذراً، لم يتم قبول وصل الدفع. يرجى التواصل معنا: https://www.facebook.com/profile.php?id=61590856328769",
        target_audience: "Drivers",
        badge_text: "Warning",
        is_active: true,
      });

      toast({ title: "Payment Rejected", description: "Driver has been notified." });
      setPayments((prev) => prev.filter((p) => p.id !== payment.id));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  const CHART_COLORS = ["hsl(185,70%,45%)", "hsl(210,80%,60%)", "hsl(150,60%,45%)", "hsl(30,80%,55%)", "hsl(270,60%,60%)"];

  const getTabStyle = (s: PaymentStatus) => ({
    pending:  "bg-amber-500/20 text-amber-500 border-amber-500/20",
    approved: "bg-green-500/20 text-green-500 border-green-500/20",
    rejected: "bg-red-500/20 text-red-500 border-red-500/20",
  }[s]);

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
              <CardTitle className="text-base">Approved by Driver</CardTitle>
              <Select value={chartType} onValueChange={(v) => setChartType(v as ChartType)}>
                <SelectTrigger className="w-[100px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="bar">Bar</SelectItem>
                  <SelectItem value="pie">Pie</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardHeader>
          <CardContent className="h-[160px]">
            {wilayaRevenue.length === 0 ? (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">No approved payments yet.</div>
            ) : chartType === "pie" ? (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={wilayaRevenue} dataKey="count" nameKey="wilaya" outerRadius={60}>
                    {wilayaRevenue.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                  </Pie>
                  <Tooltip contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={wilayaRevenue}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220 20% 18%)" vertical={false} />
                  <XAxis dataKey="wilaya" stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} tick={{ fontSize: 10 }} />
                  <YAxis stroke="hsl(210 15% 55%)" tickLine={false} axisLine={false} allowDecimals={false} />
                  <Tooltip contentStyle={{ backgroundColor: "hsl(220 22% 12%)", borderColor: "hsl(220 20% 18%)", borderRadius: "8px" }} />
                  <Bar dataKey="count" fill="hsl(185,70%,45%)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

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
            <Card key={i}><CardContent className="p-5 space-y-3">
              <Skeleton className="h-5 w-32" /><Skeleton className="h-36 w-full" /><Skeleton className="h-9 w-full" />
            </CardContent></Card>
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
          {payments.map((payment) => (
            <Card key={payment.id} className="flex flex-col border-border bg-card">
              <CardContent className="p-5 flex flex-col gap-4 flex-1">
                <div className="flex justify-between items-start">
                  <div>
                    <p className="font-semibold text-base font-mono text-sm">{payment.driver_id.slice(0, 16)}…</p>
                    <p className="text-xs text-muted-foreground mt-0.5">CCP: {payment.driver?.ccp_status || "—"}</p>
                  </div>
                  <Badge variant="outline" className={getTabStyle(payment.status)}>{payment.status}</Badge>
                </div>

                {payment.receipt_image ? (
                  <div
                    className="relative w-full h-36 rounded-md overflow-hidden border border-border cursor-pointer group"
                    onClick={() => setSelectedImage(payment.receipt_image!)}
                  >
                    <img src={payment.receipt_image} alt="Receipt" className="object-cover w-full h-full" />
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
          ))}
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0">
          {selectedImage && <img src={selectedImage} alt="Receipt Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
