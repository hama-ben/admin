import { Switch, Route, Router as WouterRouter } from "wouter";
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
import RejectedDriversPage from "@/pages/rejected-drivers";
import ExpiredAccountsPage from "@/pages/expired-accounts";
import SupportChatPage from "@/pages/support-chat";

const queryClient = new QueryClient();

function Router() {
  return (
    <AppLayout>
      <Switch>
        <Route path="/" component={DashboardPage} />
        <Route path="/users" component={UsersPage} />
        <Route path="/orders" component={OrdersPage} />
        <Route path="/driver-queue" component={DriverQueuePage} />
        <Route path="/payments" component={PaymentsPage} />
        <Route path="/announcements" component={AnnouncementsPage} />
        <Route path="/disputes" component={DisputesPage} />
        <Route path="/support" component={SupportChatPage} />
        <Route path="/rejected-drivers" component={RejectedDriversPage} />
        <Route path="/expired-accounts" component={ExpiredAccountsPage} />
        <Route component={NotFound} />
      </Switch>
    </AppLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <WouterRouter base={import.meta.env.BASE_URL.replace(/\/$/, "")}>
          <Router />
        </WouterRouter>
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
