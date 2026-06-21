import { useEffect, useState } from "react";
import { supabase, USER_TYPE_DRIVER, type User, type DriverDetails, type DriverStatus } from "@/lib/supabase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, Trash2, Image as ImageIcon, Clock, MapPin, UserX } from "lucide-react";
import { useAutoRefresh } from "@/hooks/use-auto-refresh";

interface RejectedDriver extends User {
  details?: DriverDetails | null;
  driverStatus?: DriverStatus | null;
}

export default function RejectedDriversPage() {
  const [drivers, setDrivers] = useState<RejectedDriver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<RejectedDriver | null>(null);
  const { toast } = useToast();

  async function fetchRejectedDrivers(isBackground = false) {
    if (!isBackground) setLoading(true);
    try {
      const { data: rejected, error } = await supabase
        .from("users")
        .select("id, name, phone, email, wilaya, commune, account_status, user_type, subscription_expires_at, first_approval_granted, created_at")
        .eq("user_type", USER_TYPE_DRIVER)
        .eq("account_status", "rejected")
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!rejected || rejected.length === 0) { setDrivers([]); return; }

      const userIds = rejected.map((d) => d.id);
      const [{ data: details }, { data: statuses }] = await Promise.all([
        supabase.from("driver_details").select("*").in("driver_id", userIds),
        supabase.from("driver_status").select("*").in("driver_id", userIds),
      ]);

      const detailsMap = new Map<string, DriverDetails>((details ?? []).map((d) => [d.driver_id, d]));
      const statusMap = new Map<string, DriverStatus>((statuses ?? []).map((s) => [s.driver_id, s]));

      setDrivers(rejected.map((d) => ({
        ...d,
        details: detailsMap.get(d.id) ?? null,
        driverStatus: statusMap.get(d.id) ?? null,
      })));
    } catch (err: any) {
      if (!isBackground) {
        toast({ title: "Error fetching rejected drivers", description: err.message, variant: "destructive" });
      }
    } finally {
      if (!isBackground) setLoading(false);
    }
  }

  useEffect(() => { fetchRejectedDrivers(false); }, []);
  useAutoRefresh(() => fetchRejectedDrivers(true));

  async function handleApprove(driver: RejectedDriver) {
    setActionLoading(driver.id);
    try {
      const daysToAdd = driver.first_approval_granted ? 30 : 32;
      const newExpiry = new Date();
      newExpiry.setDate(newExpiry.getDate() + daysToAdd);
      const newExpiryISO = newExpiry.toISOString();

      const { error } = await supabase
        .from("users")
        .update({
          account_status: "approved",
          subscription_expires_at: newExpiryISO,
          first_approval_granted: true,
        })
        .eq("id", driver.id);

      if (error) throw error;

      await supabase.from("announcements").insert({
        title: driver.first_approval_granted ? "تم قبول طلبك ✅" : "🎉 تم قبولك بيننا",
        content: driver.first_approval_granted
          ? "تم تجديد اشتراكك. مرحباً بعودتك إلى عائلة ميزو!"
          : "تهانينا! حصلت على هدية 30 يوماً + يومين إضافيين كمكافأة على ثقتك بنا. مرحباً بك في عائلة ميزو!",
        target_audience: "Drivers",
        badge_text: "Success",
        is_active: true,
      });

      toast({
        title: "Driver Approved ✓",
        description: `${driver.name} — subscription set to ${daysToAdd} days (expires ${newExpiry.toLocaleDateString("en-GB")}).`,
      });
      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleDelete(driver: RejectedDriver) {
    setActionLoading(driver.id);
    setDeleteTarget(null);
    try {
      const { error: detailsError } = await supabase
        .from("driver_details")
        .delete()
        .eq("driver_id", driver.id);
      if (detailsError) console.warn("driver_details delete:", detailsError.message);

      const { error: statusError } = await supabase
        .from("driver_status")
        .delete()
        .eq("driver_id", driver.id);
      if (statusError) console.warn("driver_status delete:", statusError.message);

      const { error: userError } = await supabase
        .from("users")
        .delete()
        .eq("id", driver.id);
      if (userError) throw userError;

      toast({ title: "Driver Deleted", description: `${driver.name}'s account has been permanently removed.` });
      setDrivers((prev) => prev.filter((d) => d.id !== driver.id));
    } catch (err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  function PhotoBox({ url, label }: { url?: string | null; label: string }) {
    return (
      <div
        className="border rounded-md overflow-hidden aspect-video relative group cursor-pointer bg-muted"
        onClick={() => url && setSelectedImage(url)}
      >
        {url ? (
          <>
            <img src={url} alt={label} className="object-cover w-full h-full" />
            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <ImageIcon className="w-6 h-6 text-white" />
            </div>
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center text-xs text-muted-foreground text-center p-2">
            No Image
          </div>
        )}
        <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] uppercase font-bold text-center py-1">
          {label}
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">السائقون المرفوضون</h1>
        <p className="text-muted-foreground mt-2">
          Rejected driver applications — {loading ? "…" : drivers.length} total.
        </p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" /><Skeleton className="h-4 w-1/2" />
                <div className="grid grid-cols-2 gap-3"><Skeleton className="h-24 w-full" /><Skeleton className="h-24 w-full" /></div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card border rounded-lg border-dashed">
          <UserX className="w-12 h-12 mb-4 opacity-30" />
          <h3 className="text-xl font-medium text-foreground">No rejected drivers</h3>
          <p>Rejected driver accounts will appear here.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {drivers.map((driver) => (
            <Card key={driver.id} className="flex flex-col border-border bg-card">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span className="font-semibold truncate">{driver.name || "—"}</span>
                  <Badge variant="outline" className="text-xs shrink-0 ml-2 bg-red-500/10 text-red-400 border-red-500/20">
                    مرفوض
                  </Badge>
                </CardTitle>
                <div className="space-y-1 text-xs text-muted-foreground">
                  {driver.phone && <div className="flex items-center gap-1">📞 {driver.phone}</div>}
                  {(driver.details?.wilaya || driver.wilaya) && (
                    <div className="flex items-center gap-1">
                      <MapPin className="w-3 h-3" />
                      {driver.details?.wilaya || driver.wilaya}
                      {(driver.details?.commune || driver.commune) && ` / ${driver.details?.commune || driver.commune}`}
                    </div>
                  )}
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    Registered: {driver.created_at ? new Date(driver.created_at).toLocaleDateString("en-GB") : "—"}
                  </div>
                  <div className="flex items-center gap-1">
                    <Clock className="w-3 h-3" />
                    ID: <span className="font-mono">{driver.id.slice(0, 16)}…</span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="p-4 flex-1">
                <div className="grid grid-cols-2 gap-3">
                  <PhotoBox url={driver.details?.truck_front_photo_url} label="Truck Front" />
                  <PhotoBox url={driver.details?.driver_license_url} label="License" />
                  {driver.details?.truck_side_photo_url && (
                    <PhotoBox url={driver.details.truck_side_photo_url} label="Truck Side" />
                  )}
                  {driver.details?.truck_video_url && (
                    <div className="border rounded-md overflow-hidden aspect-video relative bg-muted flex items-center justify-center">
                      <a
                        href={driver.details.truck_video_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary text-xs underline"
                      >
                        View Video
                      </a>
                      <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] uppercase font-bold text-center py-1">
                        Truck Video
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>

              <CardFooter className="grid grid-cols-2 gap-3 p-4 bg-muted/10 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 gap-1.5"
                  onClick={() => setDeleteTarget(driver)}
                  disabled={actionLoading === driver.id}
                >
                  <Trash2 className="w-4 h-4" /> حذف نهائي
                </Button>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  onClick={() => handleApprove(driver)}
                  disabled={actionLoading === driver.id}
                >
                  <Check className="w-4 h-4" /> قبول الآن
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      {/* Document image lightbox */}
      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0">
          {selectedImage && (
            <img
              src={selectedImage}
              alt="Document Preview"
              className="w-full h-auto max-h-[85vh] object-contain rounded-md"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Permanent delete confirmation dialog */}
      <Dialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="text-red-500">حذف نهائي — تأكيد</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من حذف حساب <strong>{deleteTarget?.name}</strong> بشكل نهائي؟
              سيتم حذف جميع بياناته بما فيها وثائق التسجيل. هذا الإجراء لا يمكن التراجع عنه.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={() => deleteTarget && handleDelete(deleteTarget)}
              disabled={!!actionLoading}
            >
              <Trash2 className="w-4 h-4 mr-1" /> حذف نهائي
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
