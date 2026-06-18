import { useEffect, useState, useMemo } from "react";
import { supabase } from "@/lib/supabase";
import { formatDate } from "@/lib/constants";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle, Search, Eye, Star } from "lucide-react";

type DisputeStatus = "pending" | "resolved" | "dismissed";

interface Dispute {
  id: string;
  driver_id: string | null;
  rating: number;
  comment: string | null;
  wilaya: string | null;
  status: DisputeStatus;
  created_at: string;
  user?: {
    id: string;
    name: string;
    user_type: string;
    phone?: string;
    wilaya?: string;
  } | null;
}

const STATUS_LABELS: Record<DisputeStatus, string> = {
  pending: "معلق",
  resolved: "تمت المعالجة",
  dismissed: "مغلق",
};

const STATUS_STYLES: Record<DisputeStatus, string> = {
  pending: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  resolved: "bg-green-500/20 text-green-400 border-green-500/20",
  dismissed: "bg-slate-500/20 text-slate-400 border-slate-500/20",
};

const USER_TYPE_LABELS: Record<string, string> = {
  driver: "سائق",
  consumer: "مستهلك",
  customer: "مستهلك",
};

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5">
      {Array(5).fill(0).map((_, i) => (
        <Star key={i} className={`w-3.5 h-3.5 ${i < rating ? "text-amber-400 fill-amber-400" : "text-muted-foreground/30"}`} />
      ))}
      <span className="text-xs font-medium ml-1 text-muted-foreground">{rating}/5</span>
    </div>
  );
}

export default function DisputesPage() {
  const [disputes, setDisputes] = useState<Dispute[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [userTypeFilter, setUserTypeFilter] = useState<string>("all");
  const [selected, setSelected] = useState<Dispute | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchDisputes();

    const channel = supabase
      .channel("disputes-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "ratings_disputes" }, () => {
        fetchDisputes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchDisputes() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("ratings_disputes")
        .select("*, user:users!ratings_disputes_driver_id_fkey(id, name, user_type, phone, wilaya)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setDisputes((data as Dispute[]) || []);
    } catch (err: any) {
      toast({ title: "خطأ في جلب البيانات", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleStatusChange = async (id: string, status: DisputeStatus) => {
    try {
      const { error } = await supabase
        .from("ratings_disputes")
        .update({ status })
        .eq("id", id);
      if (error) throw error;
      setDisputes((prev) => prev.map((d) => d.id === id ? { ...d, status } : d));
      if (selected?.id === id) setSelected((s) => s ? { ...s, status } : null);
      toast({ title: "تم تحديث الحالة", description: `تم تغيير الحالة إلى "${STATUS_LABELS[status]}"` });
    } catch (err: any) {
      toast({ title: "فشل التحديث", description: err.message, variant: "destructive" });
    }
  };

  const filtered = useMemo(() => {
    return disputes.filter((d) => {
      const name = d.user?.name?.toLowerCase() ?? "";
      const comment = d.comment?.toLowerCase() ?? "";
      const matchSearch = !search || name.includes(search.toLowerCase()) || comment.includes(search.toLowerCase());
      const matchStatus = statusFilter === "all" || d.status === statusFilter;
      const matchType = userTypeFilter === "all" || d.user?.user_type === userTypeFilter;
      return matchSearch && matchStatus && matchType;
    });
  }, [disputes, search, statusFilter, userTypeFilter]);

  const pendingCount = disputes.filter((d) => d.status === "pending").length;

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">النزاعات والشكاوى</h1>
          <p className="text-muted-foreground mt-1">مراجعة رسائل الدعم وتقييمات المستخدمين.</p>
        </div>
        {pendingCount > 0 && (
          <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/20 border text-sm px-3 py-1">
            {pendingCount} معلق
          </Badge>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3 bg-card p-4 rounded-lg border border-border">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو المحتوى..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="الحالة" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">جميع الحالات</SelectItem>
            <SelectItem value="pending">معلق</SelectItem>
            <SelectItem value="resolved">تمت المعالجة</SelectItem>
            <SelectItem value="dismissed">مغلق</SelectItem>
          </SelectContent>
        </Select>

        <Select value={userTypeFilter} onValueChange={setUserTypeFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="نوع المستخدم" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">الكل</SelectItem>
            <SelectItem value="driver">سائق</SelectItem>
            <SelectItem value="consumer">مستهلك</SelectItem>
          </SelectContent>
        </Select>

        <span className="text-sm text-muted-foreground ml-auto">{filtered.length} نتيجة</span>
      </div>

      {/* Table */}
      <div className="border rounded-md overflow-hidden bg-card">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead>المستخدم</TableHead>
              <TableHead>النوع</TableHead>
              <TableHead>التقييم</TableHead>
              <TableHead className="w-[30%]">الرسالة</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-right">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {loading ? (
              Array(6).fill(0).map((_, i) => (
                <TableRow key={i}>
                  {Array(7).fill(0).map((__, j) => (
                    <TableCell key={j}><Skeleton className="h-5 w-full" /></TableCell>
                  ))}
                </TableRow>
              ))
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="text-center py-16 text-muted-foreground">
                  <AlertTriangle className="w-10 h-10 mx-auto mb-3 opacity-30" />
                  <p className="font-medium text-foreground">لا توجد نزاعات</p>
                  <p className="text-sm mt-1">جرّب تغيير خيارات البحث أو التصفية.</p>
                </TableCell>
              </TableRow>
            ) : (
              filtered.map((dispute) => (
                <TableRow key={dispute.id}>
                  <TableCell className="font-medium">
                    <p>{dispute.user?.name ?? "مستخدم مجهول"}</p>
                    {dispute.user?.phone && (
                      <p className="text-xs text-muted-foreground">{dispute.user.phone}</p>
                    )}
                  </TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {USER_TYPE_LABELS[dispute.user?.user_type ?? ""] ?? dispute.user?.user_type ?? "—"}
                    </span>
                  </TableCell>
                  <TableCell>
                    <StarRating rating={dispute.rating} />
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {dispute.comment ? (
                      <span className="line-clamp-2">{dispute.comment}</span>
                    ) : (
                      <span className="italic opacity-50">لا توجد رسالة</span>
                    )}
                  </TableCell>
                  <TableCell>
                    <Select
                      value={dispute.status}
                      onValueChange={(v) => handleStatusChange(dispute.id, v as DisputeStatus)}
                    >
                      <SelectTrigger className="h-8 w-[150px] text-xs">
                        <Badge variant="outline" className={STATUS_STYLES[dispute.status]}>
                          {STATUS_LABELS[dispute.status]}
                        </Badge>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="pending">معلق</SelectItem>
                        <SelectItem value="resolved">تمت المعالجة</SelectItem>
                        <SelectItem value="dismissed">مغلق</SelectItem>
                      </SelectContent>
                    </Select>
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground whitespace-nowrap">
                    {formatDate(dispute.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setSelected(dispute)}
                    >
                      <Eye className="w-4 h-4" />
                      عرض
                    </Button>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Detail Modal */}
      <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>تفاصيل الشكوى</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-4 pt-2">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <p className="text-muted-foreground text-xs mb-1">المستخدم</p>
                  <p className="font-medium">{selected.user?.name ?? "مجهول"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">النوع</p>
                  <p>{USER_TYPE_LABELS[selected.user?.user_type ?? ""] ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">الولاية</p>
                  <p>{selected.wilaya ?? selected.user?.wilaya ?? "—"}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">التاريخ</p>
                  <p>{formatDate(selected.created_at)}</p>
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">التقييم</p>
                  <StarRating rating={selected.rating} />
                </div>
                <div>
                  <p className="text-muted-foreground text-xs mb-1">الحالة</p>
                  <Badge variant="outline" className={STATUS_STYLES[selected.status]}>
                    {STATUS_LABELS[selected.status]}
                  </Badge>
                </div>
              </div>

              <div>
                <p className="text-muted-foreground text-xs mb-1">الرسالة / التعليق</p>
                <div className="bg-muted/40 rounded-md p-3 text-sm leading-relaxed min-h-[80px]">
                  {selected.comment ?? <span className="italic opacity-50">لا توجد رسالة</span>}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t">
                <span className="text-sm text-muted-foreground">تغيير الحالة:</span>
                <Select
                  value={selected.status}
                  onValueChange={(v) => handleStatusChange(selected.id, v as DisputeStatus)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pending">معلق</SelectItem>
                    <SelectItem value="resolved">تمت المعالجة</SelectItem>
                    <SelectItem value="dismissed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
