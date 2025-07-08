import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { useSidebar } from "@/hooks/use-sidebar";
import { Database, List, CheckCircle, Link2, FileText, Settings, User, LogOut, Users, ChevronLeft, ChevronRight, Key, Code } from "lucide-react";
import { cn } from "@/lib/utils";
import { Logo } from "@/components/ui/logo";
import { DashboardIcon } from "@/components/ui/dashboard-icon";
import { UserAvatar } from "@/components/ui/user-avatar";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: DashboardIcon, roles: ["admin", "user", "reporter"] },
  { name: "Data Sources", href: "/data-sources", icon: Database, roles: ["admin", "user", "reporter"] },
  { name: "Indicators", href: "/indicators", icon: List, roles: ["admin", "user", "reporter"] },
  { name: "Whitelist", href: "/whitelist", icon: CheckCircle, roles: ["admin", "user", "reporter"] },
  { name: "Public Links", href: "/public-links", icon: Link2, roles: ["admin", "user", "reporter"] },
  { name: "API Tokens", href: "/api-tokens", icon: Key, roles: ["admin", "user"] },
  { name: "API Docs", href: "/api-docs", icon: Code, roles: ["admin", "user"] },
  { name: "Audit Logs", href: "/audit-logs", icon: FileText, roles: ["admin"] },
  { name: "Users", href: "/users", icon: Users, roles: ["admin", "user", "reporter"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();
  const { isCollapsed, toggleSidebar } = useSidebar();

  const filteredNavigation = navigation.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <div 
      className={cn(
        "fixed inset-y-0 left-0 z-50 shadow-lg transform lg:translate-x-0 transition-all duration-300 ease-in-out",
        isCollapsed ? "w-16" : "w-64"
      )} 
      style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))' }}
    >
      <div className="flex items-center justify-between h-16 px-4" style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))' }}>
        <div className="flex items-center">
          <Logo size="sm" />
          {!isCollapsed && (
            <span className="ml-3 text-white text-lg font-semibold">The Blacklist</span>
          )}
        </div>
        <button
          onClick={toggleSidebar}
          className="text-gray-300 hover:text-white transition-colors p-1 rounded"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>
      <nav className="mt-8">
        <div className="px-4 space-y-2">
          {filteredNavigation.map((item) => {
            const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "flex items-center text-sm font-medium rounded-md transition-colors group relative",
                    isCollapsed ? "px-2 py-2 justify-center" : "px-4 py-2",
                    isActive
                      ? "text-white bg-gray-800"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                  title={isCollapsed ? item.name : undefined}
                >
                  <item.icon className={cn("h-5 w-5", !isCollapsed && "mr-3")} />
                  {!isCollapsed && (
                    <span>{item.name}</span>
                  )}
                  {/* Tooltip for collapsed state */}
                  {isCollapsed && (
                    <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                      {item.name}
                    </div>
                  )}
                </a>
              </Link>
            );
          })}
        </div>
      </nav>
      <div className="absolute bottom-0 w-full p-4">
        <div className={cn(
          "flex items-center text-gray-300 text-sm",
          isCollapsed ? "justify-center flex-col space-y-2" : "justify-between"
        )}>
          {!isCollapsed ? (
            <>
              <div className="flex items-center">
                <div className="mr-2">
                  <UserAvatar user={user} size="sm" />
                </div>
                <div>
                  <p className="font-medium">{user?.username}</p>
                  <p className="text-xs text-gray-400 capitalize">{user?.role}</p>
                </div>
              </div>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white transition-colors"
              >
                <LogOut className="h-4 w-4" />
              </button>
            </>
          ) : (
            <>
              <div className="group relative">
                <UserAvatar user={user} size="sm" />
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  {user?.username} ({user?.role})
                </div>
              </div>
              <button
                onClick={logout}
                className="text-gray-400 hover:text-white transition-colors group relative"
              >
                <LogOut className="h-4 w-4" />
                <div className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap z-50">
                  Logout
                </div>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
