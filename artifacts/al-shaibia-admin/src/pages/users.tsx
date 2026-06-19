import { useEffect, useState } from "react";
import { supabase, type User } from "@/lib/supabase";
import { ALGERIAN_WILAYAS } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const USER_TYPE_DRIVER = "سائق";
const USER_TYPE_CONSUMER = "مستهلك";

function formatExpiry(dateString?: string) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  if (isNaN(date.getTime())) return "—";
  return new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(date);
}

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [roleTab, setRoleTab] = useState("all");
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const { toast } = useToast();

  const PAGE_SIZE = 20;

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(search), 500);
    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(0);
  }, [roleTab, debouncedSearch, wilayaFilter]);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        let query = supabase.from("users").select("*", { count: "exact" });

        if (roleTab === "driver") {
          query = query.eq("user_type", USER_TYPE_DRIVER);
        } else if (roleTab === "consumer") {
          query = query.eq("user_type", USER_TYPE_CONSUMER);
        }

        if (wilayaFilter !== "all") {
          query = query.eq("wilaya", wilayaFilter);
        }
        if (debouncedSearch) {
          query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
        }

        query = query
          .order("subscription_expires_at", { ascending: false, nullsFirst: false })
          .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

        const { data, count, error } = await query;
        if (error) throw error;

        setUsers(data || []);
        if (count !== null) setTotalCount(count);
      } catch (err: any) {
        console.error("Failed to fetch users", err);
        toast({ title: "Error fetching users", description: err.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }

    fetchUsers();
  }, [roleTab, debouncedSearch, wilayaFilter, page, toast]);

  function getRoleBadge(userType: string) {
    if (userType === USER_TYPE_DRIVER) {
      return <Badge variant="default" className="bg-primary/20 text-primary border-primary/30">سائق</Badge>;
    }
    return <Badge variant="secondary">مستهلك</Badge>;
  }

  function getStatusBadge(status?: string) {
    switch (status) {
      case "active":
        return <Badge variant="outline" className="bg-green-500/20 text-green-500 border-green-500/30">Active</Badge>;
      case "pending":
        return <Badge variant="outline" className="bg-amber-500/20 text-amber-500 border-amber-500/30">Pending</Badge>;
      case "rejected":
        return <Badge variant="outline" className="bg-red-500/20 text-red-500 border-red-500/30">Rejected</Badge>;
      default:
        return <Badge variant="outline">{status || "—"}</Badge>;
    }
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
        <p className="text-muted-foreground mt-2">Manage all consumers and drivers on the platform.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <Tabs value={roleTab} onValueChange={setRoleTab} className="w-auto">
          <TabsList>
            <TabsTrigger value="all">All ({totalCount})</TabsTrigger>
            <TabsTrigger value="consumer">مستهلك</TabsTrigger>
            <TabsTrigger value="driver">سائق</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-3">
          <div className="relative w-64">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search name or phone..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>

          <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Wilayas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wilayas</SelectItem>
              {ALGERIAN_WILAYAS.map((w) => (
                <SelectItem key={w} value={w}>{w}</SelectItem>
              ))}
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
              <TableHead>Role</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Subscription Expires</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(6).fill(0).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell className="font-mono text-sm">{user.phone || "—"}</TableCell>
                  <TableCell>{getRoleBadge(user.user_type)}</TableCell>
                  <TableCell>{user.wilaya || "—"}</TableCell>
                  <TableCell>{getStatusBadge(user.account_status)}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{formatExpiry(user.subscription_expires_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {users.length > 0 ? page * PAGE_SIZE + 1 : 0}–{Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} users
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
