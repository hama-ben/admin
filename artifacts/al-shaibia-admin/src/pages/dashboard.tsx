import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatDZD } from "@/lib/constants";
import {
  Area,
  AreaChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  CartesianGrid,
} from "recharts";
import { Users, Truck, Package, CreditCard, Activity, Clock } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Stats {
  totalUsers: number;
  totalConsumers: number;
  totalDrivers: number;
  ordersCompleted: number;
  totalRevenue: number;
  activeDrivers: number;
  pendingVerifications: number;
}

async function safeCount(query: any): Promise<number> {
  const { count, error } = await query;
  if (error) console.error("count query error:", error.message);
  return count ?? 0;
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    fetchAll();

    const channel = supabase
      .channel("dashboard-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, fetchAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAll() {
    setLoading(true);
    try {
      // Run all counts independently so one failure doesn't block the rest
      const [
        totalUsers,
        totalConsumers,
        totalDrivers,
        ordersCompleted,
        pendingVerifications,
        activeDrivers,
      ] = await Promise.all([
        safeCount(supabase.from("users").select("*", { count: "exact", head: true })),
        safeCount(supabase.from("users").select("*", { count: "exact", head: true }).eq("user_type", "مستهلك")),
        safeCount(supabase.from("users").select("*", { count: "exact", head: true }).eq("user_type", "سائق")),
        safeCount(supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "تم التوصيل")),
        safeCount(supabase.from("users").select("*", { count: "exact", head: true }).eq("account_status", "pending")),
        safeCount(supabase.from("users").select("*", { count: "exact", head: true }).eq("user_type", "سائق").eq("account_status", "active")),
      ]);

      // Revenue: sum of total_price for completed orders (no embed needed)
      const { data: completedOrders, error: revErr } = await supabase
        .from("orders")
        .select("total_price")
        .eq("status", "تم التوصيل");
      if (revErr) console.error("revenue query error:", revErr.message);
      const totalRevenue = (completedOrders ?? []).reduce((sum, o) => sum + Number(o.total_price), 0);

      // Chart: orders per day for last 30 days
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      const { data: recentOrders, error: chartErr } = await supabase
        .from("orders")
        .select("created_at")
        .gte("created_at", since);
      if (chartErr) console.error("chart query error:", chartErr.message);

      const daily: Record<string, number> = {};
      (recentOrders ?? []).forEach((o) => {
        const d = o.created_at.slice(0, 10);
        daily[d] = (daily[d] || 0) + 1;
      });
      const chart = Object.entries(daily)
        .map(([date, count]) => ({ date, count }))
        .sort((a, b) => a.date.localeCompare(b.date));

      console.log("Dashboard stats loaded:", { totalUsers, totalConsumers, totalDrivers, ordersCompleted, pendingVerifications, activeDrivers, totalRevenue });

      setStats({ totalUsers, totalConsumers, totalDrivers, ordersCompleted, totalRevenue, activeDrivers, pendingVerifications });
      setChartData(chart);
    } catch (err: any) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Live platform metrics from Supabase.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array(7).fill(0).map((_, i) => (
            <Card key={i}><CardContent className="p-6"><Skeleton className="h-4 w-24 mb-4" /><Skeleton className="h-8 w-20" /></CardContent></Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Revenue" value={formatDZD(stats.totalRevenue)} icon={CreditCard} className="lg:col-span-1" />
          <StatCard title="Active Drivers" value={stats.activeDrivers.toString()} icon={Activity} />
          <StatCard title="Pending Verification" value={stats.pendingVerifications.toString()} icon={Clock} valueClass="text-amber-500" />
          <StatCard title="Orders Completed" value={stats.ordersCompleted.toString()} icon={Package} />
          <StatCard title="Total Users" value={stats.totalUsers.toString()} icon={Users} />
          <StatCard title="Consumers" value={stats.totalConsumers.toString()} icon={Users} />
          <StatCard title="Total Drivers" value={stats.totalDrivers.toString()} icon={Truck} />
        </div>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Orders Per Day (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-[380px]">
          {loading ? (
            <Skeleton className="w-full h-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(v) => { const d = new Date(v); return `${d.getDate()}/${d.getMonth() + 1}`; }}
                  tickLine={false} axisLine={false} dy={10}
                />
                <YAxis stroke="hsl(var(--muted-foreground))" tickLine={false} axisLine={false} dx={-10} allowDecimals={false} />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelFormatter={(l) => `Date: ${l}`}
                  formatter={(v: number) => [v, "Orders"]}
                />
                <Area type="monotone" dataKey="count" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#grad)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="flex h-full items-center justify-center text-muted-foreground">
              No order data for the last 30 days.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ title, value, icon: Icon, className = "", valueClass = "" }: { title: string; value: string; icon: any; className?: string; valueClass?: string }) {
  return (
    <Card className={className}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
