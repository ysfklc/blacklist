import { useState , useEffect, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTable, SortableColumn } from "@/components/ui/sortable-table";
import { Badge } from "@/components/ui/badge";
import { Download, Copy } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

interface AuditLog {
  id: number;
  level: string;
  action: string;
  resource: string;
  resourceId: string | null;
  details: string;
  ipAddress: string | null;
  createdAt: string;
  user: string | null;
}

export default function AuditLogs() {
  const [filters, setFilters] = useState({
    level: "all",
    action: "all",
    resource: "all",
    user: "",
    search: "",
    ipAddress: "",
    startDate: "",
    endDate: "",
  });
  const [userInput, setUserInput] = useState(""); // Local state for user input
  const [searchInput, setSearchInput] = useState(""); // Local state for search input
  const [ipInput, setIpInput] = useState(""); // Local state for IP address input
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const { user } = useAuth();
  const { toast } = useToast();

  // Debounce the user filter with 500ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, user: userInput }));
      setPage(1); // Reset to first page when filtering
    }, 500);

    return () => clearTimeout(timer);
  }, [userInput]);

  // Debounce the search filter with 500ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
      setPage(1); // Reset to first page when filtering
    }, 500);

    return () => clearTimeout(timer);
  }, [searchInput]);

  // Debounce the IP address filter with 500ms delay
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, ipAddress: ipInput }));
      setPage(1); // Reset to first page when filtering
    }, 500);

    return () => clearTimeout(timer);
  }, [ipInput]);

  const { data: logs, isLoading } = useQuery({
    queryKey: ["/api/audit-logs", page, pageSize, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v && v !== "all")),
      });
      const response = await fetch(`/api/audit-logs?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.json();
    },
  });

  const exportLogs = async () => {
    try {
      const params = new URLSearchParams({
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v && v !== "all")),
      });
      const response = await fetch(`/api/audit-logs/export?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        window.URL.revokeObjectURL(url);
        document.body.removeChild(a);
        
        toast({
          title: "Success",
          description: "Audit logs exported successfully",
        });
      }
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to export audit logs",
        variant: "destructive",
      });
    }
  };

  const handlePageSizeChange = (newSize: string) => {
    setPageSize(parseInt(newSize));
    setPage(1); // Reset to first page when changing page size
  };

  const handleCopyDetails = (details: string) => {
    navigator.clipboard.writeText(details).then(() => {
      toast({
        title: "Copied",
        description: "Log details copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  const getLevelColor = (level: string) => {
    switch (level.toLowerCase()) {
      case "error":
        return "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
      case "warning":
        return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
      case "info":
        return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      default:
        return "bg-slate-50 text-slate-700 border border-slate-200 dark:bg-slate-900/20 dark:text-slate-400 dark:border-slate-800";
    }
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-4">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-foreground">Audit Logs</h1>
            <p className="mt-2 text-sm text-muted-foreground">View system activity and user actions.</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Button
              onClick={exportLogs}
              variant="outline"
              className="border-gray-300 text-gray-700 hover:bg-gray-50"
            >
              <Download className="h-4 w-4 mr-2" />
              Export Logs
            </Button>
          </div>
        </div>

        {/* Log Filters */}
        <Card className="mt-6">
          <CardContent className="p-4 space-y-4">
            {/* Primary Search */}
            <div>
              <Input
                placeholder="Search across all log details, resources, and content..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                className="text-sm"
              />
            </div>
            
            {/* Filter Grid */}
            <div className="space-y-4">
              {/* First Row - Dropdowns */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Level</label>
                  <Select value={filters.level} onValueChange={(value) => setFilters({ ...filters, level: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Levels" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Levels</SelectItem>
                      <SelectItem value="info">Info</SelectItem>
                      <SelectItem value="warning">Warning</SelectItem>
                      <SelectItem value="error">Error</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Action</label>
                  <Select value={filters.action} onValueChange={(value) => setFilters({ ...filters, action: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Actions" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Actions</SelectItem>
                      <SelectItem value="create">Create</SelectItem>
                      <SelectItem value="update">Update</SelectItem>
                      <SelectItem value="delete">Delete</SelectItem>
                      <SelectItem value="login">Login</SelectItem>
                      <SelectItem value="logout">Logout</SelectItem>
                      <SelectItem value="fetch">Fetch</SelectItem>
                      <SelectItem value="blocked">Blocked</SelectItem>
                      <SelectItem value="temp_activate">Temp Activate</SelectItem>
                      <SelectItem value="cleanup">Cleanup</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Resource</label>
                  <Select value={filters.resource} onValueChange={(value) => setFilters({ ...filters, resource: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="All Resources" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Resources</SelectItem>
                      <SelectItem value="indicator">Indicator</SelectItem>
                      <SelectItem value="data_source">Data Source</SelectItem>
                      <SelectItem value="user">User</SelectItem>
                      <SelectItem value="whitelist">Whitelist</SelectItem>
                      <SelectItem value="settings">Settings</SelectItem>
                      <SelectItem value="audit_logs">Audit Logs</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              
              {/* Second Row - Text Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">User</label>
                  <Input
                    placeholder="Filter by username"
                    value={userInput}
                    onChange={(e) => setUserInput(e.target.value)}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">IP Address</label>
                  <Input
                    placeholder="Filter by IP address"
                    value={ipInput}
                    onChange={(e) => setIpInput(e.target.value)}
                    className="text-sm"
                  />
                </div>
              </div>
              
              {/* Third Row - Date Inputs */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Start Date</label>
                  <Input
                    type="date"
                    value={filters.startDate}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="text-sm"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">End Date</label>
                  <Input
                    type="date"
                    value={filters.endDate}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="text-sm"
                  />
                </div>
              </div>
            </div>
            
            {/* Active Filters Display */}
            {(filters.search || filters.user || filters.ipAddress || filters.startDate || filters.endDate || 
              filters.level !== "all" || filters.action !== "all" || filters.resource !== "all") && (
              <div className="flex flex-wrap gap-2 pt-2 border-t">
                <span className="text-sm text-gray-600 font-medium">Active Filters:</span>
                {filters.search && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                    Search: "{filters.search}"
                  </span>
                )}
                {filters.level !== "all" && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    Level: {filters.level}
                  </span>
                )}
                {filters.action !== "all" && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    Action: {filters.action}
                  </span>
                )}
                {filters.resource !== "all" && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    Resource: {filters.resource}
                  </span>
                )}
                {filters.user && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    User: {filters.user}
                  </span>
                )}
                {filters.ipAddress && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    IP: {filters.ipAddress}
                  </span>
                )}
                {(filters.startDate || filters.endDate) && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-gray-100 text-gray-800">
                    Date: {filters.startDate || "∞"} - {filters.endDate || "∞"}
                  </span>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setFilters({
                      level: "all",
                      action: "all",
                      resource: "all",
                      user: "",
                      search: "",
                      ipAddress: "",
                      startDate: "",
                      endDate: "",
                    });
                    setUserInput("");
                    setSearchInput("");
                    setIpInput("");
                    setPage(1);
                  }}
                  className="text-xs h-6 px-2"
                >
                  Clear All
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Audit Logs Table */}
        <Card className="mt-6">
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <SortableTable
                data={logs?.data || []}
                isLoading={isLoading}
                columns={[
                  {
                    key: "createdAt",
                    label: "Timestamp",
                    sortable: true,
                    render: (createdAt: string) => (
                      <span className="text-sm">
                        {new Date(createdAt).toLocaleString()}
                      </span>
                    )
                  },
                  {
                    key: "level",
                    label: "Level",
                    sortable: true,
                    render: (level: string) => (
                      <Badge className={getLevelColor(level)}>
                        {level.toUpperCase()}
                      </Badge>
                    )
                  },
                  {
                    key: "user",
                    label: "User",
                    sortable: true,
                    render: (user: string | null) => (
                      <span className="text-sm text-muted-foreground">
                        {user || "System"}
                      </span>
                    )
                  },
                  {
                    key: "action",
                    label: "Action",
                    sortable: true,
                    render: (action: string) => (
                      <span className="text-sm text-muted-foreground uppercase">
                        {action}
                      </span>
                    )
                  },
                  {
                    key: "resource",
                    label: "Resource",
                    sortable: true,
                    render: (resource: string) => (
                      <span className="text-sm text-muted-foreground capitalize">
                        {resource.replace('_', ' ')}
                      </span>
                    )
                  },
                  {
                    key: "details",
                    label: "Details",
                    sortable: true,
                    className: "max-w-sm",
                    render: (details: string) => (
                      <div className="flex items-center space-x-2 text-sm text-muted-foreground group">
                        <div className="truncate" title={details}>
                          {details}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleCopyDetails(details)}
                          className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    )
                  },
                  {
                    key: "ipAddress",
                    label: "IP Address",
                    sortable: true,
                    render: (ipAddress: string | null) => (
                      <span className="text-sm text-muted-foreground">
                        {ipAddress || "-"}
                      </span>
                    )
                  }
                ]}
                emptyMessage="No audit logs found"
                className="min-w-full"
              />
            </div>
          </CardContent>
        </Card>

        {/* Pagination */}
        {logs?.pagination && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Showing {logs.pagination.start} to {logs.pagination.end} of{" "}
                {logs.pagination.total} results
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Items per page:</span>
                <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                  <SelectTrigger className="w-20">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="25">25</SelectItem>
                    <SelectItem value="50">50</SelectItem>
                    <SelectItem value="100">100</SelectItem>
                    <SelectItem value="250">250</SelectItem>
                    <SelectItem value="500">500</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-1">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(1)}
                disabled={page === 1}
              >
                First
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page - 1)}
                disabled={page === 1}
              >
                Previous
              </Button>
              
              {/* Page Numbers */}
              <div className="flex items-center space-x-1">
                {(() => {
                  const totalPages = Math.ceil(logs.pagination.total / pageSize);
                  const currentPage = page;
                  const pages = [];
                  
                  // Calculate which pages to show
                  let startPage = Math.max(1, currentPage - 2);
                  let endPage = Math.min(totalPages, currentPage + 2);
                  
                  // Adjust if we're near the beginning or end
                  if (currentPage <= 3) {
                    endPage = Math.min(5, totalPages);
                  }
                  if (currentPage > totalPages - 3) {
                    startPage = Math.max(1, totalPages - 4);
                  }
                  
                  // Add first page and ellipsis if needed
                  if (startPage > 1) {
                    pages.push(
                      <Button
                        key={1}
                        variant={1 === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(1)}
                        className="w-10"
                      >
                        1
                      </Button>
                    );
                    if (startPage > 2) {
                      pages.push(
                        <span key="ellipsis1" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                  }
                  
                  // Add visible page numbers
                  for (let i = startPage; i <= endPage; i++) {
                    pages.push(
                      <Button
                        key={i}
                        variant={i === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(i)}
                        className="w-10"
                      >
                        {i}
                      </Button>
                    );
                  }
                  
                  // Add last page and ellipsis if needed
                  if (endPage < totalPages) {
                    if (endPage < totalPages - 1) {
                      pages.push(
                        <span key="ellipsis2" className="px-2 text-gray-500">
                          ...
                        </span>
                      );
                    }
                    pages.push(
                      <Button
                        key={totalPages}
                        variant={totalPages === currentPage ? "default" : "outline"}
                        size="sm"
                        onClick={() => setPage(totalPages)}
                        className="w-10"
                      >
                        {totalPages}
                      </Button>
                    );
                  }
                  
                  return pages;
                })()}
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(page + 1)}
                disabled={!logs.pagination.hasNext}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.ceil(logs.pagination.total / pageSize))}
                disabled={!logs.pagination.hasNext}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
