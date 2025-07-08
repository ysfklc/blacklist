import { useState, useEffect, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Eye, MessageSquare, Clock } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import IndicatorDetailsModal from "@/components/indicator-details-modal";
import TempActivateDialog from "@/components/temp-activate-dialog";

const indicatorSchema = z.object({
  value: z.string().min(1, "Value is required"),
  notes: z.string().optional(),
});

type IndicatorFormData = z.infer<typeof indicatorSchema>;

interface Indicator {
  id: number;
  value: string;
  type: string;
  source: string;
  isActive: boolean;
  notes: string | null;
  notesCount?: number;
  tempActiveUntil?: string | null;
  createdAt: string;
  createdByUser?: string;
}

export default function Indicators() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [selectedIndicator, setSelectedIndicator] = useState<Indicator | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);
  const [selectedIndicators, setSelectedIndicators] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [tempActivateIndicatorId, setTempActivateIndicatorId] = useState<number | null>(null);
  const [isTempActivateDialogOpen, setIsTempActivateDialogOpen] = useState(false);
  const [filters, setFilters] = useState({
    type: "all",
    status: "all",
    source: "all",
    search: "",
  });
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(25);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Debounced search function
  const debouncedUpdateSearch = useCallback(() => {
    const timeoutId = setTimeout(() => {
      setFilters(prev => ({ ...prev, search: searchInput }));
      setPage(1); // Reset to first page when searching
    }, 500);
    return () => clearTimeout(timeoutId);
  }, [searchInput]);

  // Effect to handle debounced search
  useEffect(() => {
    const cleanup = debouncedUpdateSearch();
    return cleanup;
  }, [debouncedUpdateSearch]);

  const { data: indicators, isLoading } = useQuery({
    queryKey: ["/api/indicators", page, pageSize, filters],
    queryFn: async () => {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: pageSize.toString(),
        ...Object.fromEntries(Object.entries(filters).filter(([_, v]) => v && v !== "all")),
      });
      const response = await fetch(`/api/indicators?${params}`, {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.json();
    },
  });

  const { data: dataSources } = useQuery({
    queryKey: ["/api/data-sources"],
    queryFn: async () => {
      const response = await fetch("/api/data-sources", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.json();
    },
  });

  const { data: indicatorSources } = useQuery({
    queryKey: ["/api/indicators/sources"],
    queryFn: async () => {
      const response = await fetch("/api/indicators/sources", {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      return response.json();
    },
  });

  const form = useForm<IndicatorFormData>({
    resolver: zodResolver(indicatorSchema),
    defaultValues: {
      value: "",
      notes: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: IndicatorFormData) => 
      apiRequest("POST", "/api/indicators", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indicators"] });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Indicator created successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to create indicator",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      apiRequest("PUT", `/api/indicators/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indicators"] });
      toast({
        title: "Success",
        description: "Indicator updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update indicator",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/indicators/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/indicators"] });
      toast({
        title: "Success",
        description: "Indicator deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete indicator",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: IndicatorFormData) => {
    createMutation.mutate(data);
  };

  const handleToggleStatus = (indicator: Indicator) => {
    updateMutation.mutate({
      id: indicator.id,
      data: { isActive: !indicator.isActive },
    });
  };

  // Remove the old handleUpdateNotes function as we now use the note-taking system

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this indicator?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleTempActivate = (id: number) => {
    setTempActivateIndicatorId(id);
    setIsTempActivateDialogOpen(true);
  };

  // Multi-select handlers
  const handleSelectIndicator = (id: number) => {
    setSelectedIndicators(prev => 
      prev.includes(id) 
        ? prev.filter(indicatorId => indicatorId !== id)
        : [...prev, id]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedIndicators([]);
      setSelectAll(false);
    } else {
      const allIndicatorIds = indicators?.data?.map((indicator: Indicator) => indicator.id) || [];
      setSelectedIndicators(allIndicatorIds);
      setSelectAll(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedIndicators.length === 0) return;
    
    const confirmMessage = `Are you sure you want to delete ${selectedIndicators.length} selected indicators?`;
    if (confirm(confirmMessage)) {
      // For now, delete one by one - in a real app, you might want a bulk delete API
      selectedIndicators.forEach(id => deleteMutation.mutate(id));
      setSelectedIndicators([]);
      setSelectAll(false);
    }
  };

  const handleBulkToggleStatus = (activate: boolean) => {
    if (selectedIndicators.length === 0) return;
    
    const action = activate ? "activate" : "deactivate";
    const confirmMessage = `Are you sure you want to ${action} ${selectedIndicators.length} selected indicators?`;
    if (confirm(confirmMessage)) {
      selectedIndicators.forEach(id => {
        updateMutation.mutate({
          id,
          data: { isActive: activate },
        });
      });
      setSelectedIndicators([]);
      setSelectAll(false);
    }
  };

  // Reset selection when data changes
  useEffect(() => {
    setSelectedIndicators([]);
    setSelectAll(false);
  }, [indicators?.data]);

  // Handle page size change
  const handlePageSizeChange = (newPageSize: string) => {
    setPageSize(parseInt(newPageSize));
    setPage(1); // Reset to first page when changing page size
    setSelectedIndicators([]);
    setSelectAll(false);
  };

  const handleViewDetails = (indicator: Indicator) => {
    setSelectedIndicator(indicator);
    setIsDetailsModalOpen(true);
  };

  const canCreate = user?.role === "admin" || user?.role === "user";
  const canDelete = user?.role === "admin";

  const getTypeColor = (type: string) => {
    switch (type) {
      case "ip":
        return "bg-blue-50 text-blue-700 border border-blue-200 dark:bg-blue-900/20 dark:text-blue-400 dark:border-blue-800";
      case "domain":
        return "bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-900/20 dark:text-emerald-400 dark:border-emerald-800";
      case "hash":
        return "bg-amber-50 text-amber-700 border border-amber-200 dark:bg-amber-900/20 dark:text-amber-400 dark:border-amber-800";
      case "url":
        return "bg-red-50 text-red-700 border border-red-200 dark:bg-red-900/20 dark:text-red-400 dark:border-red-800";
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
            <h1 className="text-xl font-semibold text-foreground">Indicators</h1>
            <p className="mt-2 text-sm text-muted-foreground">Manage threat indicators including IPs, domains, hashes, and URLs.</p>
          </div>
          {canCreate && (
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
              <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Indicator
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Add Indicator</DialogTitle>
                    <p className="text-sm text-muted-foreground">
                      Enter the indicator value below. The type will be automatically detected.
                    </p>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="value"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Value</FormLabel>
                            <FormControl>
                              <Input placeholder="Enter IP, domain, hash, or URL" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />

                      <FormField
                        control={form.control}
                        name="notes"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Notes</FormLabel>
                            <FormControl>
                              <Input placeholder="Optional notes" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddModalOpen(false);
                            form.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending}>
                          Create
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        {/* Filters */}
        <Card className="mt-6">
          <CardContent className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <Select value={filters.type} onValueChange={(value) => setFilters({ ...filters, type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Types" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Types</SelectItem>
                    <SelectItem value="ip">IP Address</SelectItem>
                    <SelectItem value="domain">Domain</SelectItem>
                    <SelectItem value="hash">Hash</SelectItem>
                    <SelectItem value="url">URL</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={filters.status} onValueChange={(value) => setFilters({ ...filters, status: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Status</SelectItem>
                    <SelectItem value="active">Active</SelectItem>
                    <SelectItem value="passive">Passive</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Select value={filters.source} onValueChange={(value) => setFilters({ ...filters, source: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="All Sources" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Sources</SelectItem>
                    {indicatorSources?.map((source: any) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Input
                  placeholder="Search indicators..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Bulk Actions */}
        {selectedIndicators.length > 0 && (
          <Card className="mt-6 border-blue-200 bg-blue-50">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <span className="text-sm font-medium text-blue-800">
                    {selectedIndicators.length} indicator{selectedIndicators.length > 1 ? 's' : ''} selected
                  </span>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkToggleStatus(true)}
                      disabled={updateMutation.isPending}
                    >
                      Activate Selected
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleBulkToggleStatus(false)}
                      disabled={updateMutation.isPending}
                    >
                      Deactivate Selected
                    </Button>
                    {canDelete && (
                      <Button
                        variant="destructive"
                        size="sm"
                        onClick={handleBulkDelete}
                        disabled={deleteMutation.isPending}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Selected
                      </Button>
                    )}
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setSelectedIndicators([]);
                    setSelectAll(false);
                  }}
                >
                  Clear Selection
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Indicators Table */}
        <Card className="mt-6">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-12">
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                      aria-label="Select all indicators"
                    />
                  </TableHead>
                  <TableHead>Indicator</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created</TableHead>
                  <TableHead>Notes</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {indicators?.data?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canDelete ? 8 : 7} className="text-center text-muted-foreground py-8">
                      No indicators found
                    </TableCell>
                  </TableRow>
                ) : (
                  indicators?.data?.map((indicator: Indicator) => (
                    <TableRow key={indicator.id}>
                      <TableCell>
                        <Checkbox
                          checked={selectedIndicators.includes(indicator.id)}
                          onCheckedChange={() => handleSelectIndicator(indicator.id)}
                          aria-label={`Select indicator ${indicator.value}`}
                        />
                      </TableCell>
                      <TableCell className="font-mono text-sm">{indicator.value}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(indicator.type)}>
                          {indicator.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {indicator.source === 'manual' ? (indicator.createdByUser || 'Manual Entry') : indicator.source}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center space-x-2">
                          <Checkbox
                            checked={indicator.isActive}
                            onCheckedChange={() => handleToggleStatus(indicator)}
                            disabled={updateMutation.isPending}
                          />
                          <span className="text-sm text-foreground">
                            {indicator.isActive ? "Active" : "Passive"}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(indicator.createdAt).toLocaleDateString()}
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-6 px-2 text-xs"
                          onClick={() => handleViewDetails(indicator)}
                        >
                          <div className="relative inline-block">
                            <MessageSquare className="h-3 w-3" />
                            {(() => {
                              const notesCount = parseInt(indicator.notesCount?.toString() || '0', 10);
                              const legacyNotesCount = indicator.notes ? 1 : 0;
                              const totalCount = notesCount + legacyNotesCount;
                              return totalCount > 0 && (
                                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-3 w-3 flex items-center justify-center min-w-3 text-[10px]">
                                  {totalCount}
                                </span>
                              );
                            })()}
                          </div>
                          <span className="ml-1">Notes</span>
                        </Button>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex items-center justify-end space-x-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewDetails(indicator)}
                            title="View details and notes"
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                          {(user?.role === "admin" || user?.role === "user") && indicator.isActive && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleTempActivate(indicator.id)}
                              title="Extend activation period"
                            >
                              <Clock className="h-4 w-4" />
                            </Button>
                          )}
                          {canDelete && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(indicator.id)}
                              disabled={deleteMutation.isPending}
                              title="Delete indicator"
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Pagination */}
        {indicators?.pagination && (
          <div className="mt-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-700">
                Showing {indicators.pagination.start} to {indicators.pagination.end} of{" "}
                {indicators.pagination.total} results
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
                  const totalPages = Math.ceil(indicators.pagination.total / pageSize);
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
                disabled={!indicators.pagination.hasNext}
              >
                Next
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setPage(Math.ceil(indicators.pagination.total / pageSize))}
                disabled={!indicators.pagination.hasNext}
              >
                Last
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Indicator Details Modal */}
      <IndicatorDetailsModal
        indicator={selectedIndicator}
        isOpen={isDetailsModalOpen}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedIndicator(null);
        }}
      />

      {/* Temporary Activation Dialog */}
      <TempActivateDialog
        indicatorId={tempActivateIndicatorId}
        isOpen={isTempActivateDialogOpen}
        onClose={() => {
          setIsTempActivateDialogOpen(false);
          setTempActivateIndicatorId(null);
        }}
      />
    </main>
  );
}
