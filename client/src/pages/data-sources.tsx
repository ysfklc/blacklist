import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTable, SortableColumn } from "@/components/ui/sortable-table";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Edit, Trash2, Pause, Play, Download, ExternalLink } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const dataSourceSchema = z.object({
  name: z.string().min(1, "Name is required"),
  url: z.string().url("Invalid URL"),
  indicatorTypes: z.array(z.enum(["ip", "domain", "hash", "url", "soar-url"])).min(1, "At least one indicator type is required"),
  fetchInterval: z.number().min(60, "Minimum interval is 60 seconds"),
  ignoreCertificateErrors: z.boolean().optional().default(false),
});

type DataSourceFormData = z.infer<typeof dataSourceSchema>;

interface DataSource {
  id: number;
  name: string;
  url: string;
  indicatorTypes: string[];
  fetchInterval: number;
  isActive: boolean;
  isPaused: boolean;
  ignoreCertificateErrors: boolean;
  lastFetch: string | null;
  lastFetchStatus: string | null;
  createdAt: string;
}

export default function DataSources() {
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingSource, setEditingSource] = useState<DataSource | null>(null);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: dataSources, isLoading } = useQuery<DataSource[]>({
    queryKey: ["/api/data-sources"],
  });

  const { data: settings } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });

  // Check if SOAR-URL is enabled
  const isSoarUrlEnabled = settings?.find(s => s.key === "system.enableSoarUrl")?.value === "true";

  // Get available indicator types based on settings
  const getAvailableIndicatorTypes = () => {
    const baseTypes = ["ip", "domain", "hash", "url"] as const;
    return isSoarUrlEnabled ? [...baseTypes, "soar-url" as const] : baseTypes;
  };

  const form = useForm<DataSourceFormData>({
    resolver: zodResolver(dataSourceSchema),
    defaultValues: {
      name: "",
      url: "",
      indicatorTypes: [],
      fetchInterval: 3600,
      ignoreCertificateErrors: false,
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: DataSourceFormData) => apiRequest("POST", "/api/data-sources", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      setIsAddModalOpen(false);
      form.reset();
      toast({
        title: "Success",
        description: "Data source created successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to create data source",
        variant: "destructive",
      });
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<DataSourceFormData> }) =>
      apiRequest("PUT", `/api/data-sources/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      setEditingSource(null);
      form.reset();
      toast({
        title: "Success",
        description: "Data source updated successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to update data source",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/data-sources/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Success",
        description: "Data source deleted successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete data source",
        variant: "destructive",
      });
    },
  });

  const fetchNowMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/data-sources/${id}/fetch`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Success",
        description: "Fetch started - data will be processed in the background",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to start fetch",
        variant: "destructive",
      });
    },
  });

  const pauseMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/data-sources/${id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Success",
        description: "Data source paused successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to pause data source",
        variant: "destructive",
      });
    },
  });

  const resumeMutation = useMutation({
    mutationFn: (id: number) => apiRequest("POST", `/api/data-sources/${id}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/data-sources"] });
      toast({
        title: "Success",
        description: "Data source resumed successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to start fetch",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: DataSourceFormData) => {
    if (editingSource) {
      updateMutation.mutate({ id: editingSource.id, data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (source: DataSource) => {
    setEditingSource(source);
    form.reset({
      name: source.name,
      url: source.url,
      indicatorTypes: source.indicatorTypes as ("ip" | "domain" | "hash" | "url")[],
      fetchInterval: source.fetchInterval,
      ignoreCertificateErrors: source.ignoreCertificateErrors || false,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to delete this data source?")) {
      deleteMutation.mutate(id);
    }
  };

  const isAdmin = user?.role === "admin";

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
            <h1 className="text-xl font-semibold text-gray-900">Data Sources</h1>
            <p className="mt-2 text-sm text-gray-700">Manage and configure threat intelligence data sources.</p>
          </div>
          {isAdmin && (
            <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
                            <Dialog open={isAddModalOpen} onOpenChange={(open) => {
                setIsAddModalOpen(open);
                if (!open) {
                  setEditingSource(null);
                  form.reset();
                }
              }}>
                <DialogTrigger asChild>
                  <Button onClick={() => {
                    setEditingSource(null);
                    form.reset({
                      name: "",
                      url: "",
                      indicatorTypes: [],
                      fetchInterval: 3600,
                      ignoreCertificateErrors: false,
                    });
                  }}>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Source
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>{editingSource ? "Edit Data Source" : "Add Data Source"}</DialogTitle>
                  </DialogHeader>
                  <Form {...form}>
                    <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                      <FormField
                        control={form.control}
                        name="name"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Name</FormLabel>
                            <FormControl>
                              <Input placeholder="Source name" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="url"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>URL</FormLabel>
                            <FormControl>
                              <Input placeholder="https://example.com/feed" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="indicatorTypes"
                        render={() => (
                          <FormItem>
                            <FormLabel>Indicator Types</FormLabel>
                            <div className="space-y-2">
                              {getAvailableIndicatorTypes().map((type) => (
                                <FormField
                                  key={type}
                                  control={form.control}
                                  name="indicatorTypes"
                                  render={({ field }) => {
                                    return (
                                      <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                        <FormControl>
                                          <Checkbox
                                            checked={field.value?.includes(type)}
                                            onCheckedChange={(checked) => {
                                              return checked
                                                ? field.onChange([...field.value, type])
                                                : field.onChange(
                                                    field.value?.filter((value) => value !== type)
                                                  )
                                            }}
                                          />
                                        </FormControl>
                                        <FormLabel className="font-normal capitalize">
                                          {type === "ip" ? "IP Address" : 
                                           type === "domain" ? "Domain" :
                                           type === "hash" ? "Hash" : 
                                           type === "url" ? "URL" : "SOAR-URL"}
                                        </FormLabel>
                                      </FormItem>
                                    )
                                  }}
                                />
                              ))}
                            </div>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="fetchInterval"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Fetch Interval (seconds)</FormLabel>
                            <FormControl>
                              <Input
                                type="number"
                                placeholder="3600"
                                {...field}
                                onChange={(e) => field.onChange(parseInt(e.target.value))}
                              />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="ignoreCertificateErrors"
                        render={({ field }) => (
                          <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                            <FormControl>
                              <Checkbox
                                checked={field.value}
                                onCheckedChange={field.onChange}
                              />
                            </FormControl>
                            <div className="space-y-1 leading-none">
                              <FormLabel>Ignore Certificate Errors</FormLabel>
                              <p className="text-sm text-muted-foreground">
                                Ignore SSL/TLS certificate errors when accessing this data source
                              </p>
                            </div>
                          </FormItem>
                        )}
                      />
                      <div className="flex justify-end space-x-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => {
                            setIsAddModalOpen(false);
                            setEditingSource(null);
                            form.reset();
                          }}
                        >
                          Cancel
                        </Button>
                        <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                          {editingSource ? "Update" : "Create"}
                        </Button>
                      </div>
                    </form>
                  </Form>
                </DialogContent>
              </Dialog>
            </div>
          )}
        </div>

        <Card className="mt-8">
          <CardContent className="p-0">
            <SortableTable
              data={dataSources || []}
              isLoading={isLoading}
              columns={[
                {
                  key: "name",
                  label: "Source",
                  sortable: true,
                  render: (name: string) => <span className="font-medium">{name}</span>
                },
                {
                  key: "url",
                  label: "URL",
                  sortable: true,
                  className: "max-w-xs",
                  render: (url: string) => (
                    <div className="flex items-center space-x-2 text-sm text-gray-500">
                      <div className="truncate" title={url}>
                        {url}
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}
                        className="h-6 w-6 p-0 flex-shrink-0"
                        title="Open URL in new tab"
                      >
                        <ExternalLink className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                },
                {
                  key: "indicatorTypes",
                  label: "Type",
                  sortable: true,
                  render: (types: string[]) => (
                    <span className="capitalize">{types.join(", ")}</span>
                  )
                },
                {
                  key: "fetchInterval",
                  label: "Interval",
                  sortable: true,
                  render: (interval: number) => `${interval}s`
                },
                {
                  key: "status",
                  label: "Status",
                  sortable: true,
                  render: (_, source: DataSource) => (
                    <span
                      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        !source.isActive
                          ? "bg-gray-100 text-gray-800"
                          : source.isPaused
                          ? "bg-orange-100 text-orange-800"
                          : source.lastFetchStatus === "success"
                          ? "bg-green-100 text-green-800"
                          : source.lastFetchStatus === "error"
                          ? "bg-red-100 text-red-800"
                          : "bg-yellow-100 text-yellow-800"
                      }`}
                    >
                      <span
                        className={`h-1.5 w-1.5 rounded-full mr-1 ${
                          !source.isActive
                            ? "bg-gray-400"
                            : source.isPaused
                            ? "bg-orange-400"
                            : source.lastFetchStatus === "success"
                            ? "bg-green-400"
                            : source.lastFetchStatus === "error"
                            ? "bg-red-400"
                            : "bg-yellow-400"
                        }`}
                      ></span>
                      {!source.isActive
                        ? "Inactive"
                        : source.isPaused
                        ? "Paused"
                        : source.lastFetchStatus === "success"
                        ? "Active"
                        : source.lastFetchStatus === "error"
                        ? "Error"
                        : "Pending"}
                    </span>
                  )
                },
                {
                  key: "lastFetch",
                  label: "Last Fetch",
                  sortable: true,
                  render: (lastFetch: string | null) => (
                    <span className="text-sm text-gray-500">
                      {lastFetch ? new Date(lastFetch).toLocaleString() : "Never"}
                    </span>
                  )
                },
                {
                  key: "nextFetch",
                  label: "Next Fetch",
                  sortable: false,
                  render: (_, source: DataSource) => (
                    <span className="text-sm text-gray-500">
                      {source.isPaused ? (
                        "Paused"
                      ) : source.lastFetch ? (
                        (() => {
                          const lastFetchTime = new Date(source.lastFetch).getTime();
                          const now = Date.now();
                          const elapsedSeconds = Math.floor((now - lastFetchTime) / 1000);
                          const remainingSeconds = Math.max(0, source.fetchInterval - elapsedSeconds);
                          const remainingMinutes = Math.floor(remainingSeconds / 60);
                          const remainingHours = Math.floor(remainingMinutes / 60);
                          
                          if (remainingSeconds <= 0) {
                            return "Now";
                          } else if (remainingHours > 0) {
                            return `In ${remainingHours}h ${remainingMinutes % 60}m`;
                          } else if (remainingMinutes > 0) {
                            return `In ${remainingMinutes}m`;
                          } else {
                            return `In ${remainingSeconds}s`;
                          }
                        })()
                      ) : (
                        "Pending"
                      )}
                    </span>
                  )
                }
              ]}
              emptyMessage="No data sources configured"
              renderRowActions={isAdmin ? (source: DataSource) => (
                <div className="flex justify-end space-x-1">
                  {source.isPaused ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => resumeMutation.mutate(source.id)}
                      disabled={resumeMutation.isPending}
                      title="Resume Fetching"
                    >
                      <Play className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => pauseMutation.mutate(source.id)}
                      disabled={pauseMutation.isPending}
                      title="Pause Fetching"
                    >
                      <Pause className="h-4 w-4" />
                    </Button>
                  )}
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => fetchNowMutation.mutate(source.id)}
                    disabled={fetchNowMutation.isPending || source.isPaused}
                    title={source.isPaused ? "Resume source to fetch now" : "Pull Now"}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleEdit(source)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(source.id)}
                    disabled={deleteMutation.isPending}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ) : undefined}
            />
          </CardContent>
        </Card>

        {/* Edit Modal */}
        <Dialog open={!!editingSource} onOpenChange={(open) => {
          if (!open) {
            setEditingSource(null);
            form.reset();
          }
        }}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Edit Data Source</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Name</FormLabel>
                      <FormControl>
                        <Input placeholder="Source name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="url"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>URL</FormLabel>
                      <FormControl>
                        <Input placeholder="https://example.com/feed" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="indicatorTypes"
                  render={() => (
                    <FormItem>
                      <FormLabel>Indicator Types</FormLabel>
                      <div className="space-y-2">
                        {getAvailableIndicatorTypes().map((type) => (
                          <FormField
                            key={type}
                            control={form.control}
                            name="indicatorTypes"
                            render={({ field }) => {
                              return (
                                <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                                  <FormControl>
                                    <Checkbox
                                      checked={field.value?.includes(type)}
                                      onCheckedChange={(checked) => {
                                        return checked
                                          ? field.onChange([...field.value, type])
                                          : field.onChange(
                                              field.value?.filter((value) => value !== type)
                                            )
                                      }}
                                    />
                                  </FormControl>
                                  <FormLabel className="font-normal capitalize">
                                    {type === "ip" ? "IP Address" : 
                                     type === "domain" ? "Domain" :
                                     type === "hash" ? "Hash" : "URL"}
                                  </FormLabel>
                                </FormItem>
                              )
                            }}
                          />
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="fetchInterval"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Fetch Interval (seconds)</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          placeholder="3600"
                          {...field}
                          onChange={(e) => field.onChange(parseInt(e.target.value))}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                                <FormField
                  control={form.control}
                  name="ignoreCertificateErrors"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-start space-x-3 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                      <div className="space-y-1 leading-none">
                        <FormLabel>Ignore Certificate Errors</FormLabel>
                        <p className="text-sm text-muted-foreground">
                          Ignore SSL/TLS certificate errors when accessing this data source
                        </p>
                      </div>
                    </FormItem>
                  )}
                />
                <div className="flex justify-end space-x-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setEditingSource(null);
                      form.reset();
                    }}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={updateMutation.isPending}>
                    Update
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>
    </main>
  );
}
