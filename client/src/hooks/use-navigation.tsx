import { useLocation } from "wouter";
import { useEffect } from "react";
import { queryClient } from "@/lib/queryClient";

export function useAutoRefresh() {
  const [location] = useLocation();

  useEffect(() => {
    // Invalidate queries when navigating to ensure fresh data
    const invalidateQueries = () => {
      switch (location) {
        case "/dashboard":
          queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] });
          break;
        case "/data-sources":
          queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
          break;
        case "/indicators":
          queryClient.invalidateQueries({ queryKey: ["/api/indicators"] });
          queryClient.invalidateQueries({ queryKey: ["/api/indicators/sources"] });
          break;
        case "/whitelist":
          queryClient.invalidateQueries({ queryKey: ["/api/whitelist"] });
          break;
        case "/public-links":
          queryClient.invalidateQueries({ queryKey: ["/api/public-files/stats"] });
          break;
        case "/audit-logs":
          queryClient.invalidateQueries({ queryKey: ["/api/audit-logs"] });
          break;
        case "/users":
          queryClient.invalidateQueries({ queryKey: ["/api/users"] });
          break;
        case "/settings":
          queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
          break;
        default:
          // For any other routes, invalidate all queries to ensure fresh data
          queryClient.invalidateQueries();
          break;
      }
    };

    // Small delay to ensure the navigation has completed
    const timeout = setTimeout(invalidateQueries, 100);
    
    return () => clearTimeout(timeout);
  }, [location]);
}