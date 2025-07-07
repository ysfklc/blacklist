import { Menu, Bell, RefreshCw } from "lucide-react";
import { useLocation } from "wouter";
import { queryClient } from "@/lib/queryClient";
import { useState } from "react";

const pageTitle = {
  "/": "Dashboard",
  "/dashboard": "Dashboard",
  "/data-sources": "Data Sources",
  "/indicators": "Indicators",
  "/whitelist": "Whitelist",
  "/public-links": "Public Links",
  "/audit-logs": "Audit Logs",
  "/settings": "Settings",
};

export default function Topbar() {
  const [location] = useLocation();
  const [isRefreshing, setIsRefreshing] = useState(false);
  const title = pageTitle[location as keyof typeof pageTitle] || "Dashboard";

  const handleRefresh = async () => {
    setIsRefreshing(true);
    
    // Invalidate all queries for the current page to force fresh data
    switch (location) {
      case "/dashboard":
        await queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
        break;
      case "/data-sources":
        await queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
        break;
      case "/indicators":
        await queryClient.invalidateQueries({ queryKey: ["/api/indicators"] });
        await queryClient.invalidateQueries({ queryKey: ["/api/indicators/sources"] });
        break;
      case "/whitelist":
        await queryClient.invalidateQueries({ queryKey: ["/api/whitelist"] });
        break;
      case "/public-links":
        await queryClient.invalidateQueries({ queryKey: ["/api/public-files/stats"] });
        break;
      case "/audit-logs":
        await queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
        break;
      case "/users":
        await queryClient.invalidateQueries({ queryKey: ["/api/users"] });
        break;
      case "/settings":
        await queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
        break;
      default:
        await queryClient.invalidateQueries();
        break;
    }
    
    setIsRefreshing(false);
  };

  return (
    <div className="bg-white shadow-sm border-b border-gray-200 px-4 py-3 sm:px-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <button className="lg:hidden text-gray-500 hover:text-gray-600">
            <Menu className="h-5 w-5" />
          </button>
          <h1 className="ml-4 lg:ml-0 text-lg font-semibold text-gray-900">
            {title}
          </h1>
        </div>
        <div className="flex items-center space-x-4">
          <button
            onClick={handleRefresh}
            disabled={isRefreshing}
            className="flex items-center space-x-1 px-3 py-1 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50"
          >
            <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          
          
        </div>
      </div>
    </div>
  );
}
