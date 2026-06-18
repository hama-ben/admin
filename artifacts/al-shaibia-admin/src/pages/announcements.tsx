import { useEffect, useState } from "react";
import { supabase, type Announcement } from "@/lib/supabase";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useToast } from "@/hooks/use-toast";
import { Megaphone, Send, Users, Truck, Globe } from "lucide-react";
import { formatDate } from "@/lib/constants";

const BADGE_STYLES: Record<string, string> = {
  Info: "bg-blue-500/20 text-blue-400 border-blue-500/20",
  Warning: "bg-amber-500/20 text-amber-400 border-amber-500/20",
  Success: "bg-green-500/20 text-green-400 border-green-500/20",
  Promo: "bg-purple-500/20 text-purple-400 border-purple-500/20",
};

const AUDIENCE_ICONS: Record<string, typeof Globe> = {
  Everyone: Globe,
  Drivers: Truck,
  Consumers: Users,
  all: Globe,
};

const formSchema = z.object({
  title: z.string().min(1, "Title is required"),
  badge_text: z.enum(["Info", "Warning", "Success", "Promo"] as const),
  target_audience: z.enum(["Everyone", "Drivers", "Consumers"] as const),
  content: z.string().min(1, "Message is required"),
});

type FormValues = z.infer<typeof formSchema>;

export default function AnnouncementsPage() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const { toast } = useToast();

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      title: "",
      badge_text: "Info",
      target_audience: "Everyone",
      content: "",
    },
  });

  useEffect(() => {
    fetchAnnouncements();

    const channel = supabase
      .channel("announcements-realtime")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "announcements" }, (payload) => {
        setAnnouncements((prev) => [payload.new as Announcement, ...prev]);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  async function fetchAnnouncements() {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("announcements")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      setAnnouncements(data || []);
    } catch (err: any) {
      toast({ title: "Error fetching announcements", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  const onSubmit = async (values: FormValues) => {
    setSubmitting(true);
    try {
      const { error } = await supabase.from("announcements").insert({
        title: values.title,
        badge_text: values.badge_text,
        target_audience: values.target_audience,
        content: values.content,
        is_active: true,
      });
      if (error) throw error;
      toast({ title: "Announcement published", description: "Your announcement is now live." });
      form.reset();
    } catch (err: any) {
      toast({ title: "Failed to publish", description: err.message, variant: "destructive" });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="p-8 space-y-8 animate-in fade-in duration-500">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Announcements</h1>
        <p className="text-muted-foreground mt-1">Publish updates to drivers and consumers on the platform.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
            <Megaphone className="w-5 h-5 text-primary" /> Create New Announcement
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Title</FormLabel>
                    <FormControl>
                      <Input placeholder="Announcement title..." {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                <FormField
                  control={form.control}
                  name="badge_text"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Badge Type</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select badge type" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Info">Info</SelectItem>
                          <SelectItem value="Warning">Warning</SelectItem>
                          <SelectItem value="Success">Success</SelectItem>
                          <SelectItem value="Promo">Promo</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="target_audience"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Target Audience</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select audience" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="Everyone">Everyone</SelectItem>
                          <SelectItem value="Drivers">Drivers</SelectItem>
                          <SelectItem value="Consumers">Consumers</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={form.control}
                name="content"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Message</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Write your announcement message here..."
                        className="min-h-[120px] resize-none"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={submitting} className="gap-2">
                <Send className="w-4 h-4" />
                {submitting ? "Publishing..." : "Publish Announcement"}
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <div>
        <h2 className="text-xl font-semibold mb-4">Past Announcements</h2>
        {loading ? (
          <div className="space-y-4">
            {Array(3).fill(0).map((_, i) => (
              <Card key={i}>
                <CardContent className="p-5 space-y-3">
                  <div className="flex gap-3">
                    <Skeleton className="h-6 w-16" />
                    <Skeleton className="h-6 w-24" />
                  </div>
                  <Skeleton className="h-5 w-48" />
                  <Skeleton className="h-4 w-full" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : announcements.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground bg-card border rounded-lg border-dashed">
            <Megaphone className="w-12 h-12 mb-4 opacity-30" />
            <h3 className="text-lg font-medium text-foreground">No announcements yet</h3>
            <p className="text-sm mt-1">Published announcements will appear here.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {announcements.map((ann) => {
              const badgeStyle = BADGE_STYLES[ann.badge_text ?? "Info"] ?? BADGE_STYLES["Info"];
              const AudienceIcon = AUDIENCE_ICONS[ann.target_audience] ?? Globe;
              return (
                <Card key={ann.id} className="border-border bg-card">
                  <CardContent className="p-5">
                    <div className="flex flex-wrap items-center gap-2 mb-3">
                      {ann.badge_text && (
                        <Badge variant="outline" className={badgeStyle}>
                          {ann.badge_text}
                        </Badge>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <AudienceIcon className="w-3.5 h-3.5" />
                        {ann.target_audience}
                      </div>
                      <span className="text-xs text-muted-foreground ml-auto">{formatDate(ann.created_at)}</span>
                    </div>
                    <h3 className="font-semibold text-base mb-2">{ann.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">{ann.content}</p>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
