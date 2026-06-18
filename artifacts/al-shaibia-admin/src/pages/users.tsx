import { useEffect, useState } from "react";
import { supabase, type User } from "@/lib/supabase";
import { ALGERIAN_WILAYAS, formatDate } from "@/lib/constants";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Search } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

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
    setPage(0); // Reset page on filter change
  }, [roleTab, debouncedSearch, wilayaFilter]);

  useEffect(() => {
    async function fetchUsers() {
      setLoading(true);
      try {
        let query = supabase.from("users").select("*", { count: "exact" });
        
        if (roleTab !== "all") {
          query = query.eq("user_type", roleTab);
        }
        if (wilayaFilter !== "all") {
          query = query.eq("wilaya", wilayaFilter);
        }
        if (debouncedSearch) {
          query = query.or(`name.ilike.%${debouncedSearch}%,phone.ilike.%${debouncedSearch}%`);
        }

        query = query.order("created_at", { ascending: false }).range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

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

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500 flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Users Management</h1>
        <p className="text-muted-foreground mt-2">Manage all consumers and drivers on the platform.</p>
      </div>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center justify-between">
        <Tabs value={roleTab} onValueChange={setRoleTab} className="w-[400px]">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="all">All</TabsTrigger>
            <TabsTrigger value="consumer">Consumers</TabsTrigger>
            <TabsTrigger value="driver">Drivers</TabsTrigger>
          </TabsList>
        </Tabs>

        <div className="flex gap-4">
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
              {ALGERIAN_WILAYAS.map(w => (
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
              <TableHead>Verified</TableHead>
              <TableHead>Joined Date</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(10).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-32" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-16" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-12" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                </TableRow>
              ))
            ) : users.length === 0 ? (
              <TableRow>
                <TableCell colSpan={6} className="text-center py-10 text-muted-foreground">
                  No users found.
                </TableCell>
              </TableRow>
            ) : (
              users.map(user => (
                <TableRow key={user.id}>
                  <TableCell className="font-medium">{user.name}</TableCell>
                  <TableCell>{user.phone}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className="capitalize">
                      {user.user_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{user.wilaya}</TableCell>
                  <TableCell>
                    <Badge variant={user.account_status === 'active' ? 'default' : 'outline'} className={user.account_status === 'active' ? 'bg-green-500/20 text-green-500 hover:bg-green-500/30 border-green-500/20' : ''}>
                      {user.account_status || 'active'}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatDate(user.created_at)}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Showing {users.length > 0 ? page * PAGE_SIZE + 1 : 0} to {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount} results
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