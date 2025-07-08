import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "./hooks/use-auth";
import { SidebarProvider, useSidebar } from "./hooks/use-sidebar";
import ProtectedRoute from "./components/auth/protected-route";
import Login from "./pages/login";
import Dashboard from "./pages/dashboard";
import DataSources from "./pages/data-sources";
import Indicators from "./pages/indicators";
import Whitelist from "./pages/whitelist";
import PublicLinks from "./pages/public-links";
import PublicBlacklist from "./pages/public-blacklist";
import AuditLogs from "./pages/audit-logs";
import Settings from "./pages/settings";
import Users from "./pages/users";
import ApiTokens from "./pages/api-tokens";
import ApiDocs from "./pages/api-docs";
import NotFound from "@/pages/not-found";
import Sidebar from "./components/layout/sidebar";
import Topbar from "./components/layout/topbar";
import { useAuth } from "./hooks/use-auth";
import { useAutoRefresh } from "./hooks/use-navigation";
import { cn } from "./lib/utils";

function AppContent() {
  const { user, isLoading } = useAuth();
  const { isCollapsed } = useSidebar();
  
  // Auto-refresh data when navigating between pages
  useAutoRefresh();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <Switch>
      {/* Public routes - no authentication required */}
      <Route path="/public/blacklist" component={PublicBlacklist} />
      
      {/* Protected routes - authentication required */}
      <Route>
        {!user ? (
          <Login />
        ) : (
          <div className="min-h-screen bg-gray-50">
            <Sidebar />
            <div className={cn(
              "flex flex-col min-h-screen transition-all duration-300 ease-in-out",
              isCollapsed ? "lg:pl-16" : "lg:pl-64"
            )}>
              <Topbar />
              <Switch>
                <Route path="/" component={Dashboard} />
                <Route path="/dashboard" component={Dashboard} />
                <Route path="/data-sources">
                  <ProtectedRoute allowedRoles={["admin", "user", "reporter"]}>
                    <DataSources />
                  </ProtectedRoute>
                </Route>
                <Route path="/indicators">
                  <ProtectedRoute allowedRoles={["admin", "user", "reporter"]}>
                    <Indicators />
                  </ProtectedRoute>
                </Route>
                <Route path="/whitelist">
                  <ProtectedRoute allowedRoles={["admin", "user", "reporter"]}>
                    <Whitelist />
                  </ProtectedRoute>
                </Route>
                <Route path="/public-links">
                  <ProtectedRoute allowedRoles={["admin", "user", "reporter"]}>
                    <PublicLinks />
                  </ProtectedRoute>
                </Route>
                <Route path="/audit-logs">
                  <ProtectedRoute allowedRoles={["admin", "user"]}>
                    <AuditLogs />
                  </ProtectedRoute>
                </Route>
                <Route path="/settings">
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <Settings />
                  </ProtectedRoute>
                </Route>
                <Route path="/users">
                  <ProtectedRoute allowedRoles={["admin", "user", "reporter"]}>
                    <Users />
                  </ProtectedRoute>
                </Route>
                <Route path="/api-tokens">
                  <ProtectedRoute allowedRoles={["admin", "user"]}>
                    <ApiTokens />
                  </ProtectedRoute>
                </Route>
                <Route path="/api-docs">
                  <ProtectedRoute allowedRoles={["admin", "user"]}>
                    <ApiDocs />
                  </ProtectedRoute>
                </Route>
                <Route component={NotFound} />
              </Switch>
            </div>
          </div>
        )}
      </Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <SidebarProvider>
          <AuthProvider>
            <Toaster />
            <AppContent />
          </AuthProvider>
        </SidebarProvider>
      </TooltipProvider>
    </QueryClientProvider>
  );
}

export default App;
