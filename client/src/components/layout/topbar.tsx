import { Menu, Bell } from "lucide-react";
import { useLocation } from "wouter";

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
  const title = pageTitle[location as keyof typeof pageTitle] || "Dashboard";

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
          <div className="flex items-center space-x-2">
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
              <span className="h-1.5 w-1.5 bg-green-400 rounded-full mr-1"></span>
              System Online
            </span>
          </div>
          <button className="text-gray-400 hover:text-gray-500 relative">
            <Bell className="h-5 w-5" />
            <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 text-white rounded-full text-xs flex items-center justify-center">
              0
            </span>
          </button>
        </div>
      </div>
    </div>
  );
}
