import { useEffect, useState } from "react";
import { supabase, type RatingDispute, type DisputeStatus } from "@/lib/supabase";
import { ALGERIAN_WILAYAS, formatDate } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Star, ArrowUpDown, CheckCircle, XCircle } from "lucide-react";

type SortDir = "asc" | "desc";

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-1">
      {Array(5).fill(0).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${i < rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
      <span className="text-sm font-medium ml-1">{rating}/5</span>
    </div>
  );
}

const STATUS_COLORS: Record<DisputeStatus, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  resolved: "bg-green-500/20 text-green-400 border-green-500/20",
  dismissed: "bg-slate-500/20 text-slate-400 border-slate-500/20",
};

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<RatingDispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortDir, setSortDir] = useState<SortDir>("asc");
  const [wilayaFilter, setWilayaFilter] = useState("all");
  const { toast } = useToast();

  useEffect(() => {
    fetchDisputes();
  }, [sortDir, wilayaFilter]);

  async function fetchDisputes() {
    setLoading(true);
    try {
      let query = supabase
        .from("ratings_disputes")
        .select("*, driver:users!ratings_disputes_driver_id_fkey(*)")
        .order("rating", { ascending: sortDir === "asc" });

      if (wilayaFilter !== "all") {
        query = query.eq("wilaya", wilayaFilter);
      }

      const { data, error } = await query;
      if (error) throw error;
      setDisputes(data || []);
    } catch (err: any) {
      toast({ title: "Error fetching disputes", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleAction = async (id: string, status: "resolved" | "dismissed") => {
    try {
      const { error } = await supabase
        .from("ratings_disputes")
        .update({ status })
        .eq("id", id);

      if (error) throw error;
      toast({ title: `Dispute ${status}`, description: `The dispute has been marked as ${status}.` });
      setDisputes(disputes.map(d => d.id === id ? { ...d, status } : d));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Disputes / Ratings</h1>
        <p className="text-muted-foreground mt-1">Review driver ratings and disputed entries from users.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 bg-card p-4 rounded-lg border border-border">
        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Sort by Rating</label>
          <Button
            variant="outline"
            size="sm"
            className="flex items-center gap-2 h-9"
            onClick={() => setSortDir(d => d === "asc" ? "desc" : "asc")}
            data-testid="button-sort-rating"
          >
            <ArrowUpDown className="w-4 h-4" />
            {sortDir === "asc" ? "Worst to Best" : "Best to Worst"}
          </Button>
        </div>

        <div className="space-y-1">
          <label className="text-xs text-muted-foreground font-medium">Wilaya</label>
          <Select value={wilayaFilter} onValueChange={setWilayaFilter}>
            <SelectTrigger className="w-[200px]" data-testid="select-wilaya-filter">
              <SelectValue placeholder="All Wilayas" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Wilayas</SelectItem>
              {ALGERIAN_WILAYAS.map(w => <SelectItem key={w} value={w}>{w}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>

        <div className="ml-auto text-sm text-muted-foreground">
          {disputes.length} entries
        </div>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>Driver</TableHead>
              <TableHead>Rating</TableHead>
              <TableHead className="w-[35%]">Comment / Complaint</TableHead>
              <TableHead>Wilaya</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Date</TableHead>
              <TableHead className="text-right">Actions</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(8).fill(0).map((_, i) => (
                <TableRow key={i}>
                  <TableCell><Skeleton className="h-5 w-28" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-full" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                  <TableCell><Skeleton className="h-5 w-32 ml-auto" /></TableCell>
                </TableRow>
              ))
            ) : disputes.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-foreground">No disputes found</p>
                  <p className="text-sm mt-1">Adjust the filters to see results.</p>
                </TableCell>
              </TableRow>
            ) : (
              disputes.map(dispute => (
                <TableRow key={dispute.id} data-testid={`row-dispute-${dispute.id}`}>
                  <TableCell className="font-medium">
                    <div>
                      <p>{(dispute as any).driver?.full_name || "Unknown Driver"}</p>
                      <p className="text-xs text-muted-foreground">{(dispute as any).driver?.phone}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <StarRating rating={dispute.rating} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dispute.comment ? (
                      <span title={dispute.comment} className="line-clamp-2">{dispute.comment}</span>
                    ) : (
                      <span className="italic">No comment</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">{dispute.wilaya}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className={STATUS_COLORS[dispute.status]}>
                      {dispute.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(dispute.created_at)}
                  </TableCell>
                  <TableCell>
                    {dispute.status === "pending" && (
                      <div className="flex justify-end gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-green-500 hover:text-green-600 hover:bg-green-500/10 border-green-500/20"
                          onClick={() => handleAction(dispute.id, "resolved")}
                          data-testid={`button-resolve-${dispute.id}`}
                        >
                          <CheckCircle className="w-3.5 h-3.5 mr-1" /> Resolve
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="text-slate-400 hover:text-slate-300 hover:bg-slate-500/10 border-slate-500/20"
                          onClick={() => handleAction(dispute.id, "dismissed")}
                          data-testid={`button-dismiss-${dispute.id}`}
                        >
                          <XCircle className="w-3.5 h-3.5 mr-1" /> Dismiss
                        </Button>
                      </div>
                    )}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
