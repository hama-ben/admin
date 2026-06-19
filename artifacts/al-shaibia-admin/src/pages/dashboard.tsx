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

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [chartData, setChartData] = useState<any[]>([]);

  useEffect(() => {
    async function fetchStats() {
      try {
        const [
          { count: totalUsers },
          { count: totalConsumers },
          { count: totalDrivers },
          { count: ordersCompleted },
          { count: pendingVerifications },
          { count: activeDrivers },
          { data: revenueData },
          { data: orderChartData },
        ] = await Promise.all([
          supabase.from("users").select("*", { count: "exact", head: true }),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("user_type", "مستهلك"),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("user_type", "سائق"),
          supabase.from("orders").select("*", { count: "exact", head: true }).eq("status", "تم التوصيل"),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("account_status", "pending"),
          supabase.from("users").select("*", { count: "exact", head: true }).eq("user_type", "سائق").eq("account_status", "active"),
          supabase.from("orders").select("total_price").eq("status", "تم التوصيل"),
          supabase.from("orders").select("created_at").gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        ]);

        const totalRevenue = revenueData?.reduce((sum, o) => sum + Number(o.total_price), 0) || 0;

        const dailyCounts: Record<string, number> = {};
        if (orderChartData) {
          orderChartData.forEach((o) => {
            const date = new Date(o.created_at).toISOString().split("T")[0];
            dailyCounts[date] = (dailyCounts[date] || 0) + 1;
          });
        }

        const chartFormatted = Object.entries(dailyCounts)
          .map(([date, count]) => ({ date, count }))
          .sort((a, b) => a.date.localeCompare(b.date));

        setChartData(chartFormatted);
        setStats({
          totalUsers: totalUsers || 0,
          totalConsumers: totalConsumers || 0,
          totalDrivers: totalDrivers || 0,
          ordersCompleted: ordersCompleted || 0,
          totalRevenue,
          activeDrivers: activeDrivers || 0,
          pendingVerifications: pendingVerifications || 0,
        });
      } catch (err) {
        console.error("Failed to fetch stats", err);
      } finally {
        setLoading(false);
      }
    }

    fetchStats();

    const channel = supabase
      .channel("dashboard-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "orders" }, () => fetchStats())
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => fetchStats())
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground mt-2">Live overview of Al-Shaibia platform metrics.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {Array(7).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6">
                <Skeleton className="h-4 w-24 mb-4" />
                <Skeleton className="h-8 w-32" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : stats ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <StatCard title="Total Revenue" value={formatDZD(stats.totalRevenue)} icon={CreditCard} className="col-span-full md:col-span-2 lg:col-span-1" />
          <StatCard title="Active Drivers" value={stats.activeDrivers.toString()} icon={Activity} />
          <StatCard title="Pending Verification" value={stats.pendingVerifications.toString()} icon={Clock} valueClass="text-amber-500" />
          <StatCard title="Orders Completed" value={stats.ordersCompleted.toString()} icon={Package} />
          <StatCard title="Total Users" value={stats.totalUsers.toString()} icon={Users} />
          <StatCard title="Consumers" value={stats.totalConsumers.toString()} icon={Users} />
          <StatCard title="Total Drivers" value={stats.totalDrivers.toString()} icon={Truck} />
        </div>
      ) : null}

      <Card className="col-span-4 mt-8">
        <CardHeader>
          <CardTitle>Orders (Last 30 Days)</CardTitle>
        </CardHeader>
        <CardContent className="h-[400px]">
          {loading ? (
            <Skeleton className="w-full h-full" />
          ) : chartData.length > 0 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData}>
                <defs>
                  <linearGradient id="colorCount" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis
                  dataKey="date"
                  stroke="hsl(var(--muted-foreground))"
                  tickFormatter={(val) => {
                    const d = new Date(val);
                    return `${d.getDate()}/${d.getMonth() + 1}`;
                  }}
                  tickLine={false}
                  axisLine={false}
                  dy={10}
                />
                <YAxis
                  stroke="hsl(var(--muted-foreground))"
                  tickLine={false}
                  axisLine={false}
                  dx={-10}
                  allowDecimals={false}
                />
                <Tooltip
                  contentStyle={{ backgroundColor: "hsl(var(--popover))", borderColor: "hsl(var(--border))", borderRadius: "8px" }}
                  itemStyle={{ color: "hsl(var(--foreground))" }}
                  labelFormatter={(label) => `Date: ${label}`}
                  formatter={(value: number) => [value, "Orders"]}
                />
                <Area
                  type="monotone"
                  dataKey="count"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  fillOpacity={1}
                  fill="url(#colorCount)"
                />
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

function StatCard({ title, value, icon: Icon, className = "", valueClass = "" }: any) {
  return (
    <Card className={className}>
      <CardContent className="p-6 flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-muted-foreground">{title}</p>
          <p className={`text-3xl font-bold mt-2 ${valueClass}`}>{value}</p>
        </div>
        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
          <Icon className="w-6 h-6 text-primary" />
        </div>
      </CardContent>
    </Card>
  );
}
