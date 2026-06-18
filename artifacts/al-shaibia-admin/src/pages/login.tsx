import { ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <div className="flex justify-center">
            <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
              <ShieldCheck className="w-7 h-7 text-primary" />
            </div>
          </div>
          <h1 className="text-3xl font-bold text-primary">الشعبية</h1>
          <p className="text-muted-foreground text-sm tracking-wide uppercase font-medium">
            Admin Panel
          </p>
        </div>

        <div className="border rounded-lg shadow-sm p-6 space-y-4 bg-card">
          <div className="space-y-1">
            <h2 className="text-lg font-semibold">Sign in</h2>
            <p className="text-sm text-muted-foreground">
              Access the dashboard with your admin account.
            </p>
          </div>

          <Button
            className="w-full"
            onClick={() => { window.location.href = "/api/login"; }}
          >
            Log in
          </Button>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Restricted access — authorised personnel only.
        </p>
      </div>
    </div>
  );
}
