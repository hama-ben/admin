import { Link, useLocation } from "wouter";
import {
  LayoutDashboard,
  Users,
  Package,
  Truck,
  CreditCard,
  Megaphone,
  AlertTriangle,
  LogOut,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/users", label: "Users", icon: Users },
  { href: "/orders", label: "Orders", icon: Package },
  { href: "/driver-queue", label: "Driver Queue", icon: Truck },
  { href: "/payments", label: "Payments — مدفوعات", icon: CreditCard },
  { href: "/announcements", label: "Announcements", icon: Megaphone },
  { href: "/disputes", label: "Disputes", icon: AlertTriangle },
];

export function Sidebar() {
  const [location] = useLocation();
  const { user, signOut } = useAuth();

  return (
    <aside className="fixed inset-y-0 left-0 w-[260px] bg-sidebar border-r border-sidebar-border text-sidebar-foreground flex flex-col z-20">
      <div className="p-6">
        <h1 className="text-3xl font-bold text-primary font-sans leading-tight">
          الشعبية
        </h1>
        <p className="text-sm text-sidebar-foreground/70 tracking-wide uppercase mt-1 font-medium">
          Admin Panel
        </p>
      </div>

      <nav className="flex-1 px-4 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = location === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center gap-3 px-3 py-2.5 rounded-md transition-colors font-medium text-sm",
                isActive
                  ? "bg-sidebar-primary/10 text-sidebar-primary"
                  : "hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
              )}
            >
              <item.icon className="w-5 h-5" />
              {item.label}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-sidebar-border space-y-3">
        {user && (
          <div className="px-1">
            <p className="text-xs text-sidebar-foreground/50 truncate">{user.email}</p>
          </div>
        )}
        <Button
          variant="ghost"
          size="sm"
          className="w-full justify-start gap-2 text-sidebar-foreground/70 hover:text-destructive hover:bg-destructive/10"
          onClick={signOut}
        >
          <LogOut className="w-4 h-4" />
          Sign out
        </Button>
        <div className="text-xs text-sidebar-foreground/50 text-center">
          Al-Shaibia Admin v1.0
        </div>
      </div>
    </aside>
  );
}

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background text-foreground font-sans flex">
      <Sidebar />
      <main className="ml-[260px] flex-1 flex flex-col w-[calc(100%-260px)]">
        {children}
      </main>
    </div>
  );
}
