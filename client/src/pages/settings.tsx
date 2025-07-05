import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Save, TestTube, UserPlus, Edit, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface Setting {
  id: number;
  key: string;
  value: string;
  encrypted: boolean;
  updatedAt: string;
}

interface SystemUser {
  id: number;
  username: string;
  role: string;
  authType: string;
  lastLogin: string | null;
  isActive: boolean;
}

export default function Settings() {
  const [ldapSettings, setLdapSettings] = useState({
    server: "",
    port: 389,
    baseDN: "",
    bindDN: "",
    password: "",
    enabled: false,
  });

  const [systemSettings, setSystemSettings] = useState({
    defaultFetchInterval: 3600,
    maxFileSize: 100000,
    logRetention: 90,
    blacklistUpdateInterval: 5,
  });

  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: settings, isLoading: settingsLoading } = useQuery<Setting[]>({
    queryKey: ["/api/settings"],
    onSuccess: (data) => {
      const settingsMap = data.reduce((acc, setting) => {
        acc[setting.key] = setting.value;
        return acc;
      }, {} as Record<string, string>);

      // Populate LDAP settings
      setLdapSettings({
        server: settingsMap["ldap.server"] || "",
        port: parseInt(settingsMap["ldap.port"] || "389"),
        baseDN: settingsMap["ldap.baseDN"] || "",
        bindDN: settingsMap["ldap.bindDN"] || "",
        password: settingsMap["ldap.password"] || "",
        enabled: settingsMap["ldap.enabled"] === "true",
      });

      // Populate system settings
      setSystemSettings({
        defaultFetchInterval: parseInt(settingsMap["system.defaultFetchInterval"] || "3600"),
        maxFileSize: parseInt(settingsMap["system.maxFileSize"] || "100000"),
        logRetention: parseInt(settingsMap["system.logRetention"] || "90"),
        blacklistUpdateInterval: parseInt(settingsMap["system.blacklistUpdateInterval"] || "5"),
      });
    },
  });

  const { data: users, isLoading: usersLoading } = useQuery<SystemUser[]>({
    queryKey: ["/api/users"],
  });

  const saveLdapMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/settings", {
      "ldap.server": ldapSettings.server,
      "ldap.port": ldapSettings.port.toString(),
      "ldap.baseDN": ldapSettings.baseDN,
      "ldap.bindDN": ldapSettings.bindDN,
      "ldap.password": ldapSettings.password,
      "ldap.enabled": ldapSettings.enabled.toString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "LDAP settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save LDAP settings",
        variant: "destructive",
      });
    },
  });

  const saveSystemMutation = useMutation({
    mutationFn: () => apiRequest("PUT", "/api/settings", {
      "system.defaultFetchInterval": systemSettings.defaultFetchInterval.toString(),
      "system.maxFileSize": systemSettings.maxFileSize.toString(),
      "system.logRetention": systemSettings.logRetention.toString(),
      "system.blacklistUpdateInterval": systemSettings.blacklistUpdateInterval.toString(),
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings"] });
      toast({
        title: "Success",
        description: "System settings saved successfully",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to save system settings",
        variant: "destructive",
      });
    },
  });

  const testLdapConnection = async () => {
    try {
      await apiRequest("POST", "/api/settings/test-ldap", ldapSettings);
      toast({
        title: "Success",
        description: "LDAP connection test successful",
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "LDAP connection test failed",
        variant: "destructive",
      });
    }
  };

  const getRoleColor = (role: string) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800";
      case "user":
        return "bg-blue-100 text-blue-800";
      case "reporter":
        return "bg-gray-100 text-gray-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  if (settingsLoading || usersLoading) {
    return (
      <main className="flex-1 p-6">
        <div className="max-w-4xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="h-64 bg-gray-200 rounded"></div>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="sm:flex sm:items-center">
          <div className="sm:flex-auto">
            <h1 className="text-xl font-semibold text-gray-900">Settings</h1>
            <p className="mt-2 text-sm text-gray-700">Configure system settings and authentication options.</p>
          </div>
        </div>

        {/* LDAP Configuration */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>LDAP / Active Directory Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveLdapMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="ldap-server">LDAP Server</Label>
                  <Input
                    id="ldap-server"
                    placeholder="ldap://your-server.com:389"
                    value={ldapSettings.server}
                    onChange={(e) => setLdapSettings({ ...ldapSettings, server: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ldap-port">Port</Label>
                  <Input
                    id="ldap-port"
                    type="number"
                    placeholder="389"
                    value={ldapSettings.port}
                    onChange={(e) => setLdapSettings({ ...ldapSettings, port: parseInt(e.target.value) || 389 })}
                  />
                </div>
                <div>
                  <Label htmlFor="ldap-base-dn">Base DN</Label>
                  <Input
                    id="ldap-base-dn"
                    placeholder="dc=company,dc=com"
                    value={ldapSettings.baseDN}
                    onChange={(e) => setLdapSettings({ ...ldapSettings, baseDN: e.target.value })}
                  />
                </div>
                <div>
                  <Label htmlFor="ldap-bind-dn">Bind DN</Label>
                  <Input
                    id="ldap-bind-dn"
                    placeholder="cn=admin,dc=company,dc=com"
                    value={ldapSettings.bindDN}
                    onChange={(e) => setLdapSettings({ ...ldapSettings, bindDN: e.target.value })}
                  />
                </div>
                <div className="md:col-span-2">
                  <Label htmlFor="ldap-password">Bind Password</Label>
                  <Input
                    id="ldap-password"
                    type="password"
                    placeholder="Password"
                    value={ldapSettings.password}
                    onChange={(e) => setLdapSettings({ ...ldapSettings, password: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="ldap-enabled"
                  checked={ldapSettings.enabled}
                  onCheckedChange={(checked) => setLdapSettings({ ...ldapSettings, enabled: !!checked })}
                />
                <Label htmlFor="ldap-enabled">Enable LDAP Authentication</Label>
              </div>
              <div className="flex justify-between">
                <Button
                  type="button"
                  variant="outline"
                  onClick={testLdapConnection}
                  className="border-gray-300 text-gray-700 hover:bg-gray-50"
                >
                  <TestTube className="h-4 w-4 mr-2" />
                  Test Connection
                </Button>
                <Button
                  type="submit"
                  disabled={saveLdapMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save LDAP Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* System Configuration */}
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>System Configuration</CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={(e) => { e.preventDefault(); saveSystemMutation.mutate(); }} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="default-fetch-interval">Default Fetch Interval (seconds)</Label>
                  <Input
                    id="default-fetch-interval"
                    type="number"
                    value={systemSettings.defaultFetchInterval}
                    onChange={(e) => setSystemSettings({ ...systemSettings, defaultFetchInterval: parseInt(e.target.value) || 3600 })}
                  />
                </div>
                <div>
                  <Label htmlFor="max-file-size">Max Indicators per File</Label>
                  <Input
                    id="max-file-size"
                    type="number"
                    value={systemSettings.maxFileSize}
                    onChange={(e) => setSystemSettings({ ...systemSettings, maxFileSize: parseInt(e.target.value) || 100000 })}
                  />
                </div>
                <div>
                  <Label htmlFor="log-retention">Log Retention (days)</Label>
                  <Input
                    id="log-retention"
                    type="number"
                    value={systemSettings.logRetention}
                    onChange={(e) => setSystemSettings({ ...systemSettings, logRetention: parseInt(e.target.value) || 90 })}
                  />
                </div>
                <div>
                  <Label htmlFor="blacklist-update-interval">Blacklist Update Interval (minutes)</Label>
                  <Input
                    id="blacklist-update-interval"
                    type="number"
                    value={systemSettings.blacklistUpdateInterval}
                    onChange={(e) => setSystemSettings({ ...systemSettings, blacklistUpdateInterval: parseInt(e.target.value) || 5 })}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  type="submit"
                  disabled={saveSystemMutation.isPending}
                  className="bg-blue-600 hover:bg-blue-700 text-white"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Save System Settings
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        {/* User Management */}
        <Card className="mt-6">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>User Management</CardTitle>
              <Button className="bg-blue-600 hover:bg-blue-700 text-white">
                <UserPlus className="h-4 w-4 mr-2" />
                Add User
              </Button>
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Username</TableHead>
                  <TableHead>Role</TableHead>
                  <TableHead>Auth Type</TableHead>
                  <TableHead>Last Login</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center text-gray-500 py-8">
                      No users found
                    </TableCell>
                  </TableRow>
                ) : (
                  users?.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell className="font-medium">{user.username}</TableCell>
                      <TableCell>
                        <Badge className={getRoleColor(user.role)}>
                          {user.role.charAt(0).toUpperCase() + user.role.slice(1)}
                        </Badge>
                      </TableCell>
                      <TableCell className="capitalize">{user.authType}</TableCell>
                      <TableCell className="text-sm text-gray-500">
                        {user.lastLogin ? new Date(user.lastLogin).toLocaleString() : "Never"}
                      </TableCell>
                      <TableCell>
                        <Badge className={user.isActive ? "bg-green-100 text-green-800" : "bg-gray-100 text-gray-800"}>
                          {user.isActive ? "Active" : "Inactive"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end space-x-2">
                          <Button variant="ghost" size="sm" className="text-blue-600 hover:text-blue-900">
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" className="text-red-600 hover:text-red-900">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
