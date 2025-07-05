import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2 } from "lucide-react";
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

export default function Whitelist() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: whitelist, isLoading } = useQuery<WhitelistEntry[]>({
    queryKey: ["/api/whitelist"],
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

        {/* Whitelist Table */}
        <Card className="mt-6">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Value</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Added By</TableHead>
                  <TableHead>Date Added</TableHead>
                  {canDelete && <TableHead className="text-right">Actions</TableHead>}
                </TableRow>
              </TableHeader>
              <TableBody>
                {whitelist?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={canDelete ? 6 : 5} className="text-center text-gray-500 py-8">
                      No whitelist entries found
                    </TableCell>
                  </TableRow>
                ) : (
                  whitelist?.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-mono text-sm">{entry.value}</TableCell>
                      <TableCell>
                        <Badge className={getTypeColor(entry.type)}>
                          {entry.type.toUpperCase()}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-gray-500 max-w-xs">
                        {entry.reason || "-"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {entry.createdBy?.username || "Unknown"}
                      </TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {new Date(entry.createdAt).toLocaleDateString()}
                      </TableCell>
                      {canDelete && (
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(entry.id)}
                            disabled={deleteMutation.isPending}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      )}
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        {/* Recent Blocked Attempts */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Recent Whitelist Blocks</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center text-gray-500 py-8">
              <p>Blocked attempts will be displayed here when indicators from feeds are blocked by the whitelist.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
