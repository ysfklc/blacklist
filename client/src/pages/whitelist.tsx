import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SortableTable, SortableColumn } from "@/components/ui/sortable-table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Trash2, Copy } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";

const whitelistSchema = z.object({
  value: z.string().min(1, "Value is required"),
  type: z.enum(["ip", "domain", "hash", "url"]),
  reason: z.string().optional(),
});

type WhitelistFormData = z.infer<typeof whitelistSchema>;

interface WhitelistEntry {
  id: number;
  value: string;
  type: string;
  reason: string | null;
  createdAt: string;
  createdBy: {
    username: string;
  };
}

interface WhitelistBlock {
  id: number;
  value: string;
  type: string;
  source: string;
  sourceName: string | null;
  attemptedAt: string;
  blockedReason: string | null;
  whitelistValue: string | null;
}

export default function Whitelist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedEntries, setSelectedEntries] = useState<number[]>([]);
  const [selectAll, setSelectAll] = useState(false);

  const { data: whitelist, isLoading } = useQuery<WhitelistEntry[]>({
    queryKey: ["/api/whitelist"],
  });

  const { data: whitelistBlocks, isLoading: blocksLoading } = useQuery({
    queryKey: ["/api/whitelist/blocks"],
  });

  const form = useForm<WhitelistFormData>({
    resolver: zodResolver(whitelistSchema),
    defaultValues: {
      value: "",
      type: "ip",
      reason: "",
    },
  });

  const createMutation = useMutation({
    mutationFn: (data: WhitelistFormData) => apiRequest("POST", "/api/whitelist", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whitelist"] });
      form.reset();
      toast({
        title: "Success",
        description: "Entry added to whitelist successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Error",
        description: error.message || "Failed to add to whitelist",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/whitelist/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/whitelist"] });
      toast({
        title: "Success",
        description: "Entry removed from whitelist successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to remove from whitelist",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: WhitelistFormData) => {
    createMutation.mutate(data);
  };

  const handleDelete = (id: number) => {
    if (confirm("Are you sure you want to remove this entry from the whitelist?")) {
      deleteMutation.mutate(id);
    }
  };

  const handleCopy = (value: string) => {
    navigator.clipboard.writeText(value).then(() => {
      toast({
        title: "Copied",
        description: "Value copied to clipboard",
      });
    }).catch(() => {
      toast({
        title: "Error",
        description: "Failed to copy to clipboard",
        variant: "destructive",
      });
    });
  };

  // Multi-select functionality
  const handleSelectEntry = (entryId: number) => {
    setSelectedEntries(prev => 
      prev.includes(entryId) 
        ? prev.filter(id => id !== entryId)
        : [...prev, entryId]
    );
  };

  const handleSelectAll = () => {
    if (selectAll) {
      setSelectedEntries([]);
      setSelectAll(false);
    } else {
      setSelectedEntries(whitelist?.map(entry => entry.id) || []);
      setSelectAll(true);
    }
  };

  const handleBulkDelete = () => {
    if (selectedEntries.length === 0) return;
    
    const confirmMessage = `Are you sure you want to remove ${selectedEntries.length} selected entries from the whitelist?`;
    if (confirm(confirmMessage)) {
      // Delete entries one by one
      selectedEntries.forEach(id => deleteMutation.mutate(id));
      setSelectedEntries([]);
      setSelectAll(false);
    }
  };

  // Reset selection when data changes
  useEffect(() => {
    setSelectedEntries([]);
    setSelectAll(false);
  }, [whitelist]);

  const canAdd = user?.role === "admin" || user?.role === "user";
  const canDelete = user?.role === "admin";

  const getTypeColor = (type: string) => {
    switch (type) {
      case "ip":
        return "bg-blue-100 text-blue-800";
      case "domain":
        return "bg-green-100 text-green-800";
      case "hash":
        return "bg-yellow-100 text-yellow-800";
      case "url":
        return "bg-red-100 text-red-800";
      default:
        return "bg-gray-100 text-gray-800";
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
            <h1 className="text-xl font-semibold text-gray-900">Whitelist Management</h1>
            <p className="mt-2 text-sm text-gray-700">Manage whitelisted indicators that should not be blacklisted.</p>
          </div>
        </div>

        {/* Whitelist Form */}
        {canAdd && (
          <Card className="mt-6">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Plus className="h-5 w-5 mr-2" />
                Add New Whitelist Entry
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="type"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Type</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="ip">IP Address</SelectItem>
                              <SelectItem value="domain">Domain</SelectItem>
                              <SelectItem value="hash">Hash</SelectItem>
                              <SelectItem value="url">URL</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name="value"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Value</FormLabel>
                          <FormControl>
                            <Input placeholder="Enter indicator value..." {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex items-end">
                      <Button type="submit" className="w-full" disabled={createMutation.isPending}>
                        Add Entry
                      </Button>
                    </div>
                  </div>
                  <FormField
                    control={form.control}
                    name="reason"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Reason</FormLabel>
                        <FormControl>
                          <Textarea
                            placeholder="Reason for whitelisting..."
                            rows={2}
                            {...field}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </form>
              </Form>
            </CardContent>
          </Card>
        )}

        {/* Bulk Operations Toolbar */}
        {selectedEntries.length > 0 && canDelete && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-blue-900">
                  {selectedEntries.length} entries selected
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleBulkDelete}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete Selected
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Whitelist Table */}
        <Card className="mt-6">
          <CardContent className="p-0">
            <SortableTable
              data={whitelist || []}
              isLoading={isLoading}
              columns={[
                ...(canDelete ? [{
                  key: "select",
                  label: "",
                  sortable: false,
                  className: "w-12",
                  headerRender: () => (
                    <Checkbox
                      checked={selectAll}
                      onCheckedChange={handleSelectAll}
                    />
                  ),
                  render: (_, entry: WhitelistEntry) => (
                    <Checkbox
                      checked={selectedEntries.includes(entry.id)}
                      onCheckedChange={() => handleSelectEntry(entry.id)}
                    />
                  )
                }] : []),
                {
                  key: "value",
                  label: "Value",
                  sortable: true,
                  render: (value: string) => (
                    <div className="flex items-center space-x-2 font-mono text-sm group">
                      <span>{value}</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleCopy(value)}
                        className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                  )
                },
                {
                  key: "type",
                  label: "Type",
                  sortable: true,
                  render: (type: string) => (
                    <Badge className={getTypeColor(type)}>
                      {type.toUpperCase()}
                    </Badge>
                  )
                },
                {
                  key: "reason",
                  label: "Reason",
                  sortable: true,
                  className: "max-w-xs",
                  render: (reason: string | null) => (
                    <span className="text-sm text-gray-500">
                      {reason || "-"}
                    </span>
                  )
                },
                {
                  key: "createdBy.username",
                  label: "Added By",
                  sortable: true,
                  render: (_, entry: WhitelistEntry) => (
                    <span className="text-sm text-gray-500">
                      {entry.createdBy?.username || "Unknown"}
                    </span>
                  )
                },
                {
                  key: "createdAt",
                  label: "Date Added",
                  sortable: true,
                  render: (createdAt: string) => (
                    <span className="text-sm text-gray-500">
                      {new Date(createdAt).toLocaleDateString()}
                    </span>
                  )
                }
              ]}
              emptyMessage="No whitelist entries found"
              renderRowActions={canDelete ? (entry: WhitelistEntry) => (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleDelete(entry.id)}
                  disabled={deleteMutation.isPending}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              ) : undefined}
            />
          </CardContent>
        </Card>

        {/* Recent Blocked Attempts */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Whitelist Blocks</CardTitle>
            <p className="text-sm text-gray-600">Indicators from feeds that were blocked by whitelist entries</p>
          </CardHeader>
          <CardContent className="p-0">
            {blocksLoading ? (
              <div className="text-center text-gray-500 py-8">
                Loading blocked attempts...
              </div>
            ) : !whitelistBlocks?.data || whitelistBlocks.data.length === 0 ? (
              <div className="text-center text-gray-500 py-8">
                <p>No blocked attempts yet. When indicators from data sources match whitelist entries, they will appear here.</p>
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Blocked Value</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Source</TableHead>
                    <TableHead>Blocked By</TableHead>
                    <TableHead>Attempted</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {whitelistBlocks.data.map((block: WhitelistBlock) => (
                    <TableRow key={block.id} className="group">
                      <TableCell className="font-mono text-sm">
                        <div className="flex items-center space-x-2">
                          <span>{block.value}</span>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleCopy(block.value)}
                            className="p-1 h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(block.type)}>
                          {block.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {block.sourceName || block.source}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-sm">
                        {block.whitelistValue || 'Unknown'}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(block.attemptedAt).toLocaleDateString()} {new Date(block.attemptedAt).toLocaleTimeString()}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
