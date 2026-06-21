import { useEffect, useRef, useState } from "react";
import { supabase, USER_TYPE_DRIVER, USER_TYPE_CONSUMER, type User } from "@/lib/supabase";
import { ALGERIAN_WILAYAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

const PAGE_SIZE = 20;

function getStatusBadge(status?: string | null) {
  switch (status) {
    case "approved": return <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">Approved</Badge>;
    case "pending":  return <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>;
    case "rejected": return <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30">Rejected</Badge>;
    default:         return <Badge variant="outline">{status || "—"}</Badge>;
  }
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeTab, setTypeTab] = useState<"all" | typeof USER_TYPE_DRIVER | typeof USER_TYPE_CONSUMER>("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const filtersRef = useRef({ typeTab, statusFilter, search, wilayaFilter, page });
  filtersRef.current = { typeTab, statusFilter, search, wilayaFilter, page };

  useEffect(() => { setPage(0); }, [typeTab, statusFilter, search, wilayaFilter]);
  useEffect(() => {
    const timer = setTimeout(() => fetchUsers(false), search ? 400 : 0);
    return () => clearTimeout(timer);
  }, [typeTab, statusFilter, search, wilayaFilter, page]);

  useAutoRefresh(() => fetchUsers(true));

  async function fetchUsers(isBackground = false) {
    const { typeTab, statusFilter, search, wilayaFilter, page } = filtersRef.current;
    if (!isBackground) setLoading(true);
    try {
      let query = supabase
        .from("users")
        .select("id, name, phone, email, user_type, wilaya, commune, account_status, subscription_expires_at", { count: "exact" });

      if (typeTab !== "all") query = query.eq("user_type", typeTab);
      if (statusFilter !== "all") query = query.eq("account_status", statusFilter);
      if (wilayaFilter !== "all") query = query.eq("wilaya", wilayaFilter);
      if (search) {
        query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%,email.ilike.%${search}%`);
      }

      const { data, count, error } = await query
        .order("name")
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (error) throw error;
      setUsers((data as User[]) ?? []);
      setTotalCount(count ?? 0);
    } catch (err: any) {
      if (!isBackground) {
        toast({ title: "Error fetching users", description: err.message, variant: "destructive" });
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users</h1>
        <p className="text-muted-foreground mt-2">All registered users — drivers and consumers.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <div className="flex gap-2 flex-wrap">
          {(["all", USER_TYPE_DRIVER, USER_TYPE_CONSUMER] as const).map((t) => (
            <Button
              key={t}
              size="sm"
              variant={typeTab === t ? "default" : "outline"}
              onClick={() => setTypeTab(t)}
            >
              {t === "all" ? `All (${totalCount})` : t === USER_TYPE_DRIVER ? `Drivers (${typeTab === USER_TYPE_DRIVER ? totalCount : "…"})` : `Consumers (${typeTab === USER_TYPE_CONSUMER ? totalCount : "…"})`}
            </Button>
          ))}
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 w-[140px] text-sm"><SelectValue placeholder="Status" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="approved">Approved</SelectItem>
              <SelectItem value="rejected">Rejected</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex gap-3">
          <div className="relative w-56">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input placeholder="Search name, phone…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
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
              <TableHead>Name</TableHead>
              <TableHead>Phone</TableHead>
              <TableHead>Type</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead>Commune</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscription</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>{Array(7).fill(0).map((__, j) => <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>)}</TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-10 text-muted-foreground">No users found.</TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name || "—"}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{user.phone || "—"}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={user.user_type === USER_TYPE_DRIVER ? "bg-blue-500/10 text-blue-400 border-blue-500/20" : "bg-purple-500/10 text-purple-400 border-purple-500/20"}>
                      {user.user_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.wilaya || "—"}</TableCell>
                  <TableCell>{user.commune || "—"}</TableCell>
                  <TableCell>{getStatusBadge(user.account_status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {user.subscription_expires_at
                      ? new Date(user.subscription_expires_at).toLocaleDateString("en-GB")
                      : "—"}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {users.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
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
