import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import { AppLayout } from "@/components/layout";
import DashboardPage from "@/pages/dashboard";
import UsersPage from "@/pages/users";
import OrdersPage from "@/pages/orders";
import DriverQueuePage from "@/pages/driver-queue";
import PaymentsPage from "@/pages/payments";
import AnnouncementsPage from "@/pages/announcements";
import DisputesPage from "@/pages/disputes";
import LoginPage from "@/pages/login";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";

const queryClient = new QueryClient();

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <Redirect to="/login" />;
  }

  return <Component />;
}

function Router() {
  const { session, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <Switch>
      <Route path="/login">
        {session ? <Redirect to="/" /> : <LoginPage />}
      </Route>

      <Route path="/">
        <AppLayout>
          <Switch>
            <Route path="/" component={() => <ProtectedRoute component={DashboardPage} />} />
            <Route path="/users" component={() => <ProtectedRoute component={UsersPage} />} />
            <Route path="/orders" component={() => <ProtectedRoute component={OrdersPage} />} />
            <Route path="/driver-queue" component={() => <ProtectedRoute component={DriverQueuePage} />} />
            <Route path="/payments" component={() => <ProtectedRoute component={PaymentsPage} />} />
            <Route path="/announcements" component={() => <ProtectedRoute component={AnnouncementsPage} />} />
            <Route path="/disputes" component={() => <ProtectedRoute component={DisputesPage} />} />
            <Route component={NotFound} />
          </Switch>
        </AppLayout>
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
            <Router />
          </WouterRouter>
        </AuthProvider>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
