import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Shield, BarChart3, Database, List, CheckCircle, Link2, FileText, Settings, User, LogOut } from "lucide-react";
import { cn } from "@/lib/utils";

const navigation = [
  { name: "Dashboard", href: "/dashboard", icon: BarChart3, roles: ["admin", "user", "reporter"] },
  { name: "Data Sources", href: "/data-sources", icon: Database, roles: ["admin", "user", "reporter"] },
  { name: "Indicators", href: "/indicators", icon: List, roles: ["admin", "user", "reporter"] },
  { name: "Whitelist", href: "/whitelist", icon: CheckCircle, roles: ["admin", "user", "reporter"] },
  { name: "Public Links", href: "/public-links", icon: Link2, roles: ["admin", "user", "reporter"] },
  { name: "Audit Logs", href: "/audit-logs", icon: FileText, roles: ["admin", "user"] },
  { name: "Settings", href: "/settings", icon: Settings, roles: ["admin"] },
];

export default function Sidebar() {
  const [location] = useLocation();
  const { user, logout } = useAuth();

  const filteredNavigation = navigation.filter(item => 
    user && item.roles.includes(user.role)
  );

  return (
    <div className="fixed inset-y-0 left-0 z-50 w-64 shadow-lg transform lg:translate-x-0 transition-transform duration-200 ease-in-out" style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))' }}>
      <div className="flex items-center justify-center h-16" style={{ backgroundColor: 'rgb(17 24 39 / var(--tw-bg-opacity, 1))' }}>
        <div className="flex items-center">
          <div className="h-8 w-8 bg-secondary rounded-full flex items-center justify-center mr-3">
            <Shield className="h-5 w-5 text-white" />
          </div>
          <span className="text-white text-lg font-semibold">ThreatIntel</span>
        </div>
      </div>

      <nav className="mt-8">
        <div className="px-4 space-y-2">
          {filteredNavigation.map((item) => {
            const isActive = location === item.href || (item.href === "/dashboard" && location === "/");
            return (
              <Link key={item.name} href={item.href}>
                <a
                  className={cn(
                    "flex items-center px-4 py-2 text-sm font-medium rounded-md transition-colors",
                    isActive
                      ? "text-white bg-gray-800"
                      : "text-gray-300 hover:bg-gray-800 hover:text-white"
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.name}
                </a>
              </Link>
            );
          })}
        </div>
      </nav>

      <div className="absolute bottom-0 w-full p-4">
        <div className="flex items-center justify-between text-gray-300 text-sm">
          <div className="flex items-center">
            <div className="h-8 w-8 bg-gray-600 rounded-full flex items-center justify-center mr-2">
              <User className="h-4 w-4" />
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
        </div>
      </div>
    </div>
  );
}
