import { useEffect, useState } from "react";
import { supabase, type PendingDriver, type DriverDetails, insertTargetedAnnouncement } from "@/lib/supabase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, Image as ImageIcon } from "lucide-react";

export default function DriverQueuePage() {
  const [drivers, setDrivers] = useState<(PendingDriver & { details?: DriverDetails })[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingDrivers();

    const channel = supabase
      .channel("driver-queue-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "users" }, () => {
        fetchPendingDrivers();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchPendingDrivers() {
    setLoading(true);
    try {
      const { data: pendingUsers, error: usersError } = await supabase
        .from("users")
        .select("id, name, phone, wilaya, commune, account_status, user_type, subscription_expires_at")
        .eq("user_type", "سائق")
        .eq("account_status", "pending");

      if (usersError) throw usersError;
      if (!pendingUsers || pendingUsers.length === 0) {
        setDrivers([]);
        return;
      }

      const userIds = pendingUsers.map((u) => u.id);
      const { data: detailsData } = await supabase
        .from("driver_details")
        .select("*")
        .in("driver_id", userIds);

      const detailsMap = new Map<string, DriverDetails>();
      (detailsData || []).forEach((d) => detailsMap.set(d.driver_id, d));

      setDrivers(pendingUsers.map((u) => ({ ...u, details: detailsMap.get(u.id) })));
    } catch (err: any) {
      console.error("Failed to fetch driver queue", err);
      toast({ title: "Error fetching queue", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  async function handleApprove(driverId: string) {
    setActionLoading(driverId);
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ account_status: "active" })
        .eq("id", driverId);

      if (updateError) throw updateError;

      const annError = await insertTargetedAnnouncement(
        "تم قبولك بيننا",
        "مرحبا بك",
        "Success",
        driverId
      );

      if (annError) {
        console.warn("Announcement insert warning:", annError.message);
      }

      toast({ title: "Driver Approved", description: "The driver has been approved and notified." });
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  async function handleReject(driverId: string) {
    setActionLoading(driverId);
    try {
      const { error: updateError } = await supabase
        .from("users")
        .update({ account_status: "rejected" })
        .eq("id", driverId);

      if (updateError) throw updateError;

      const annError = await insertTargetedAnnouncement(
        "تم رفض طلبك",
        "عذراً، لم يتم قبول طلبك. يرجى التواصل معنا عبر الفيسبوك: https://www.facebook.com/profile.php?id=61590856328769",
        "Warning",
        driverId
      );

      if (annError) {
        console.warn("Announcement insert warning:", annError.message);
      }

      toast({ title: "Driver Rejected", description: "The driver has been rejected." });
      setDrivers((prev) => prev.filter((d) => d.id !== driverId));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    } finally {
      setActionLoading(null);
    }
  }

  function PhotoBox({ url, label }: { url?: string | null; label: string }) {
    return (
      <div
        className="border rounded-md overflow-hidden aspect-video relative group cursor-pointer"
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
          <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground text-center p-2">
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
        <h1 className="text-3xl font-bold tracking-tight">Driver Queue</h1>
        <p className="text-muted-foreground mt-2">Review and approve pending driver applications.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i}>
              <CardContent className="p-6 space-y-4">
                <Skeleton className="h-6 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
                <div className="grid grid-cols-2 gap-3">
                  <Skeleton className="h-24 w-full" />
                  <Skeleton className="h-24 w-full" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : drivers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-card border rounded-lg border-dashed">
          <Check className="w-12 h-12 mb-4 text-green-500/50" />
          <h3 className="text-xl font-medium text-foreground">Queue is empty</h3>
          <p>All pending drivers have been reviewed.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {drivers.map((driver) => (
            <Card key={driver.id} className="flex flex-col border-border bg-card">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span>{driver.name}</span>
                  {driver.wilaya && (
                    <span className="text-xs font-normal text-muted-foreground px-2 py-1 bg-muted rounded-full">
                      {driver.wilaya}
                    </span>
                  )}
                </CardTitle>
                <div className="text-sm text-muted-foreground font-mono">{driver.phone}</div>
              </CardHeader>

              <CardContent className="p-4 flex-1">
                {driver.details ? (
                  <div className="grid grid-cols-2 gap-3">
                    <PhotoBox url={driver.details.truck_front_photo_url} label="Truck" />
                    <PhotoBox url={driver.details.driver_license_url} label="License" />
                    {driver.details.truck_side_photo_url && (
                      <PhotoBox url={driver.details.truck_side_photo_url} label="Truck Side" />
                    )}
                  </div>
                ) : (
                  <div className="flex items-center justify-center h-24 text-sm text-muted-foreground border border-dashed rounded-md">
                    No documents uploaded
                  </div>
                )}
              </CardContent>

              <CardFooter className="grid grid-cols-2 gap-3 p-4 bg-muted/10 border-t border-border">
                <Button
                  variant="outline"
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20 gap-1.5"
                  onClick={() => handleReject(driver.id)}
                  disabled={actionLoading === driver.id}
                >
                  <X className="w-4 h-4" /> رفض
                </Button>
                <Button
                  className="w-full bg-green-600 hover:bg-green-700 text-white gap-1.5"
                  onClick={() => handleApprove(driver.id)}
                  disabled={actionLoading === driver.id}
                >
                  <Check className="w-4 h-4" /> قبول
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0">
          {selectedImage && (
            <img src={selectedImage} alt="Document Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
