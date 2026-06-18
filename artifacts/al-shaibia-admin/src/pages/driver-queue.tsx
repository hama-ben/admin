import { useEffect, useState } from "react";
import { supabase, type Driver } from "@/lib/supabase";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Check, X, CreditCard, Image as ImageIcon } from "lucide-react";

export default function DriverQueuePage() {
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchPendingDrivers();

    const channel = supabase
      .channel('drivers-queue')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'drivers', filter: 'status=eq.pending' }, () => {
        fetchPendingDrivers();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPendingDrivers() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("drivers")
        .select("*, users!inner(*)")
        .eq("status", "pending");

      if (error) throw error;
      setDrivers(data || []);
    } catch (err: any) {
      console.error("Failed to fetch driver queue", err);
      toast({ title: "Error fetching queue", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const handleAction = async (userId: string, status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ status })
        .eq("user_id", userId);

      if (error) throw error;
      
      toast({ 
        title: `Driver ${status}`, 
        description: `Successfully ${status} the driver application.` 
      });
      
      setDrivers(drivers.filter(d => d.user_id !== userId));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  const handleCCPAction = async (userId: string, ccp_status: "approved" | "rejected") => {
    try {
      const { error } = await supabase
        .from("drivers")
        .update({ ccp_status })
        .eq("user_id", userId);

      if (error) throw error;
      
      toast({ 
        title: `CCP Receipt ${ccp_status}`, 
        description: `Successfully ${ccp_status} the CCP payment receipt.` 
      });
      
      setDrivers(drivers.map(d => d.user_id === userId ? { ...d, ccp_status } : d));
    } catch (err: any) {
      toast({ title: "Action failed", description: err.message, variant: "destructive" });
    }
  };

  return (
    <div className="p-8 space-y-6 animate-in fade-in duration-500">
      <div className="bg-primary/10 border border-primary/20 rounded-lg p-6 flex flex-col md:flex-row items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-primary flex items-center gap-2">
            <CreditCard className="w-5 h-5" /> Official CCP Account for Verification
          </h2>
          <p className="text-muted-foreground mt-1">Drivers deposit verification fees here.</p>
        </div>
        <div className="mt-4 md:mt-0 bg-background/50 px-6 py-3 rounded border border-border">
          <span className="font-mono text-2xl font-bold tracking-widest text-primary">
            00799999001 <span className="text-amber-500">1234567890</span>
          </span>
        </div>
      </div>

      <div>
        <h1 className="text-3xl font-bold tracking-tight">Driver Queue</h1>
        <p className="text-muted-foreground mt-2">Review and approve pending driver applications.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
          {Array(6).fill(0).map((_, i) => (
            <Card key={i} className="overflow-hidden">
              <CardContent className="p-6">
                <Skeleton className="h-6 w-3/4 mb-4" />
                <div className="space-y-2">
                  <Skeleton className="h-20 w-full" />
                  <Skeleton className="h-20 w-full" />
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
          {drivers.map(driver => (
            <Card key={driver.user_id} className="flex flex-col border-border bg-card">
              <CardHeader className="pb-3 border-b border-border/50">
                <CardTitle className="flex justify-between items-center text-lg">
                  <span>{driver.users?.name}</span>
                  <span className="text-xs font-normal text-muted-foreground px-2 py-1 bg-muted rounded-full">
                    {driver.users?.wilaya}
                  </span>
                </CardTitle>
                <div className="text-sm text-muted-foreground">{driver.users?.phone}</div>
              </CardHeader>
              <CardContent className="p-4 space-y-4 flex-1">
                <div className="grid grid-cols-2 gap-4">
                  <div 
                    className="border rounded-md overflow-hidden aspect-video relative group cursor-pointer"
                    onClick={() => driver.license_photo_url && setSelectedImage(driver.license_photo_url)}
                  >
                    {driver.license_photo_url ? (
                      <>
                        <img src={driver.license_photo_url} alt="License" className="object-cover w-full h-full" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground text-center p-2">
                        No License Image
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] uppercase font-bold text-center py-1">License</div>
                  </div>
                  
                  <div 
                    className="border rounded-md overflow-hidden aspect-video relative group cursor-pointer"
                    onClick={() => driver.truck_photo_url && setSelectedImage(driver.truck_photo_url)}
                  >
                    {driver.truck_photo_url ? (
                      <>
                        <img src={driver.truck_photo_url} alt="Truck" className="object-cover w-full h-full" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <ImageIcon className="w-6 h-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="w-full h-full bg-muted flex items-center justify-center text-xs text-muted-foreground text-center p-2">
                        No Truck Image
                      </div>
                    )}
                    <div className="absolute bottom-0 inset-x-0 bg-background/80 text-[10px] uppercase font-bold text-center py-1">Vehicle</div>
                  </div>
                </div>

                {driver.ccp_receipt_url && (
                  <div className="mt-4 p-3 bg-muted/30 border border-border rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                      <span className="text-sm font-medium">CCP Receipt</span>
                      <span className="text-xs text-muted-foreground capitalize">Status: {driver.ccp_status || 'Pending'}</span>
                    </div>
                    <div className="flex gap-4 items-center">
                      <div 
                        className="w-16 h-16 border rounded cursor-pointer shrink-0"
                        onClick={() => setSelectedImage(driver.ccp_receipt_url)}
                      >
                        <img src={driver.ccp_receipt_url} alt="CCP Receipt" className="object-cover w-full h-full" />
                      </div>
                      {(!driver.ccp_status || driver.ccp_status === 'pending') ? (
                        <div className="flex gap-2 flex-1">
                          <Button size="sm" variant="outline" className="flex-1 text-green-500 hover:text-green-600 hover:bg-green-500/10" onClick={() => handleCCPAction(driver.user_id, 'approved')}>
                            <Check className="w-4 h-4 mr-1" /> Approve CCP
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1 text-red-500 hover:text-red-600 hover:bg-red-500/10" onClick={() => handleCCPAction(driver.user_id, 'rejected')}>
                            <X className="w-4 h-4 mr-1" /> Reject CCP
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1 flex items-center justify-center border border-dashed rounded h-10 text-sm">
                           Receipt {driver.ccp_status}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </CardContent>
              <CardFooter className="grid grid-cols-2 gap-3 p-4 bg-muted/10 border-t border-border">
                <Button 
                  variant="outline" 
                  className="w-full text-red-500 hover:text-red-600 hover:bg-red-500/10 border-red-500/20"
                  onClick={() => handleAction(driver.user_id, 'rejected')}
                >
                  <X className="w-4 h-4 mr-2" /> Reject Driver
                </Button>
                <Button 
                  className="w-full bg-green-600 hover:bg-green-700 text-white"
                  onClick={() => handleAction(driver.user_id, 'approved')}
                >
                  <Check className="w-4 h-4 mr-2" /> Approve Driver
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={!!selectedImage} onOpenChange={(open) => !open && setSelectedImage(null)}>
        <DialogContent className="max-w-4xl bg-transparent border-none shadow-none p-0">
          {selectedImage && (
            <img src={selectedImage} alt="Preview" className="w-full h-auto max-h-[85vh] object-contain rounded-md" />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}