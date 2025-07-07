import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trash2, Edit, Plus, Eye, Lock } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { UserAvatar } from "@/components/ui/user-avatar";

interface SystemUser {
  id: number;
  username: string;
  firstName?: string;
  lastName?: string;
  email?: string;
  role: string;
  authType: string;
  isActive: boolean;
  lastLogin: string | null;
  createdAt: string;
}

interface LdapUser {
  username: string;
  firstName: string;
  lastName: string;
  email: string;
  cn: string;
}

const userSchema = z.object({
  username: z.string().min(1, "Username is required"),
  password: z.string().optional(),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "user", "reporter"]),
  authType: z.enum(["local", "ldap"]),
  isActive: z.boolean().default(true),
}).refine((data) => {
  if (data.authType === "local" && !data.password) {
    return false;
  }
  return true;
}, {
  message: "Password is required for local authentication",
  path: ["password"],
});

const editUserSchema = z.object({
  username: z.string().min(1, "Username is required"),
  firstName: z.string().optional(),
  lastName: z.string().optional(),
  email: z.string().email().optional(),
  role: z.enum(["admin", "user", "reporter"]),
  authType: z.enum(["local", "ldap"]),
  isActive: z.boolean().default(true),
});

const adminPasswordResetSchema = z.object({
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, "Current password is required"),
  newPassword: z.string().min(6, "New password must be at least 6 characters"),
});

type UserFormData = z.infer<typeof userSchema>;
type EditUserFormData = z.infer<typeof editUserSchema>;
type PasswordChangeData = z.infer<typeof passwordChangeSchema>;
type AdminPasswordResetData = z.infer<typeof adminPasswordResetSchema>;

export default function Users() {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedUser, setSelectedUser] = useState<SystemUser | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [showAdminPasswordDialog, setShowAdminPasswordDialog] = useState(false);
  const [ldapSearchQuery, setLdapSearchQuery] = useState("");
  const [ldapResults, setLdapResults] = useState<LdapUser[]>([]);
  const [selectedLdapUser, setSelectedLdapUser] = useState<LdapUser | null>(null);
  const [showLdapSearch, setShowLdapSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");

  const isAdmin = user?.role === "admin";

  // Fetch users (admin only) or profile (all users)
  const { data: users, isLoading } = useQuery({
    queryKey: isAdmin ? ["/api/users"] : ["/api/users/profile"],
    enabled: !!user,
  });

  // Fetch settings to check if LDAP is enabled
  const { data: settings } = useQuery({
    queryKey: ["/api/settings"],
    enabled: isAdmin, // Only admins can view settings
  });

  // Check if LDAP is enabled
  const isLdapEnabled = settings && settings.some((setting: any) => 
    setting.key === "ldap.enabled" && setting.value === "true"
  );

  // Convert single user profile to array format for consistent rendering
  const allUsers: SystemUser[] = isAdmin ? (users || []) : (users ? [users] : []);
  
  // Filter users based on search query and role filter
  const userList = allUsers.filter((user) => {
    const matchesSearch = !searchQuery || 
      user.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (user.firstName && user.firstName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.lastName && user.lastName.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (user.email && user.email.toLowerCase().includes(searchQuery.toLowerCase()));
    
    const matchesRole = roleFilter === "all" || user.role === roleFilter;
    
    return matchesSearch && matchesRole;
  });

  const createUserMutation = useMutation({
    mutationFn: (data: UserFormData) => apiRequest("POST", "/api/users", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowCreateDialog(false);
      toast({ title: "User created successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error creating user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: (data: { id: number; userData: Partial<EditUserFormData> }) =>
      apiRequest("PUT", `/api/users/${data.id}`, data.userData),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      setShowEditDialog(false);
      setSelectedUser(null);
      toast({ title: "User updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const adminPasswordResetMutation = useMutation({
    mutationFn: (data: { id: number; password: string }) =>
      apiRequest("PUT", `/api/users/${data.id}`, { password: data.password }),
    onSuccess: () => {
      setShowAdminPasswordDialog(false);
      setSelectedUser(null);
      toast({ title: "Password reset successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error resetting password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: (id: number) => apiRequest("DELETE", `/api/users/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast({ title: "User deleted successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error deleting user",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const changePasswordMutation = useMutation({
    mutationFn: (data: PasswordChangeData) => apiRequest("PUT", "/api/users/profile/password", data),
    onSuccess: () => {
      setShowPasswordDialog(false);
      toast({ title: "Password updated successfully" });
    },
    onError: (error: any) => {
      toast({
        title: "Error updating password",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<UserFormData>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      username: "",
      password: "",
      firstName: "",
      lastName: "",
      email: "",
      role: "user",
      authType: "local",
      isActive: true,
    },
  });

  const editForm = useForm<EditUserFormData>({
    resolver: zodResolver(editUserSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      role: "user",
      authType: "local",
      isActive: true,
    },
  });

  const adminPasswordForm = useForm<AdminPasswordResetData>({
    resolver: zodResolver(adminPasswordResetSchema),
    defaultValues: {
      newPassword: "",
    },
  });

  const passwordForm = useForm<PasswordChangeData>({
    resolver: zodResolver(passwordChangeSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
    },
  });

  const onCreateSubmit = (data: UserFormData) => {
    createUserMutation.mutate(data);
  };

  const onEditSubmit = (data: EditUserFormData) => {
    if (selectedUser) {
      updateUserMutation.mutate({
        id: selectedUser.id,
        userData: data,
      });
    }
  };

  const onAdminPasswordSubmit = (data: AdminPasswordResetData) => {
    if (selectedUser) {
      adminPasswordResetMutation.mutate({
        id: selectedUser.id,
        password: data.newPassword,
      });
    }
  };

  const onPasswordSubmit = (data: PasswordChangeData) => {
    changePasswordMutation.mutate(data);
  };

  const searchLdap = async (query: string) => {
    try {
      const response = await apiRequest("GET", `/api/ldap/search?query=${encodeURIComponent(query)}`);
      setLdapResults(response as unknown as LdapUser[]);
    } catch (error) {
      toast({
        title: "Error searching LDAP",
        description: "Failed to search LDAP directory",
        variant: "destructive",
      });
    }
  };

  const handleLdapUserSelect = (ldapUser: LdapUser) => {
    setSelectedLdapUser(ldapUser);
    createForm.setValue("username", ldapUser.username);
    createForm.setValue("firstName", ldapUser.firstName);
    createForm.setValue("lastName", ldapUser.lastName);
    createForm.setValue("email", ldapUser.email);
    createForm.setValue("authType", "ldap");
    createForm.setValue("password", undefined);
    setShowLdapSearch(false);
  };

  const handleAuthTypeChange = (authType: "local" | "ldap") => {
    createForm.setValue("authType", authType);
    if (authType === "ldap") {
      createForm.setValue("password", undefined);
      setShowLdapSearch(true);
    } else {
      setShowLdapSearch(false);
      setSelectedLdapUser(null);
    }
  };

  const handleEdit = (user: SystemUser) => {
    setSelectedUser(user);
    editForm.reset({
      username: user.username,
      firstName: user.firstName || '',
      lastName: user.lastName || '',
      email: user.email || '',
      role: user.role as "admin" | "user" | "reporter",
      authType: user.authType as "local" | "ldap",
      isActive: user.isActive,
    });
    setShowEditDialog(true);
  };

  const handleDelete = (id: number) => {
    deleteUserMutation.mutate(id);
  };

  if (isLoading) {
    return <div>Loading...</div>;
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Users</h1>
          <p className="text-muted-foreground">
            {isAdmin ? "Manage system users and their permissions" : "View and manage your profile"}
          </p>
        </div>
        <div className="flex gap-2">
          {!isAdmin && (
            <Dialog open={showPasswordDialog} onOpenChange={setShowPasswordDialog}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Lock className="h-4 w-4 mr-2" />
                  Change Password
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Change Password</DialogTitle>
                  <DialogDescription>
                    Enter your current password and a new password.
                  </DialogDescription>
                </DialogHeader>
                <Form {...passwordForm}>
                  <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)} className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Current Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>New Password</FormLabel>
                          <FormControl>
                            <Input type="password" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setShowPasswordDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={changePasswordMutation.isPending}>
                        {changePasswordMutation.isPending ? "Updating..." : "Update Password"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
          {isAdmin && (
            <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create New User</DialogTitle>
                  <DialogDescription>
                    Create a new user account with specified permissions.
                  </DialogDescription>
                </DialogHeader>
                <Form {...createForm}>
                  <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                    <FormField
                      control={createForm.control}
                      name="username"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Username</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={createForm.control}
                      name="authType"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Authentication Type</FormLabel>
                          <Select onValueChange={(value) => {
                            field.onChange(value);
                            handleAuthTypeChange(value as "local" | "ldap");
                          }} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select authentication type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="local">Local</SelectItem>
                              <SelectItem 
                                value="ldap" 
                                disabled={!isLdapEnabled}
                                className={!isLdapEnabled ? "opacity-50 cursor-not-allowed" : ""}
                              >
                                LDAP {!isLdapEnabled && "(Disabled)"}
                              </SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    {showLdapSearch && (
                      <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                        <div>
                          <Label htmlFor="ldap-search">Search LDAP Directory</Label>
                          <div className="flex gap-2 mt-1">
                            <Input
                              id="ldap-search"
                              placeholder="Enter username or name to search..."
                              value={ldapSearchQuery}
                              onChange={(e) => setLdapSearchQuery(e.target.value)}
                            />
                            <Button
                              type="button"
                              onClick={() => searchLdap(ldapSearchQuery)}
                              disabled={!ldapSearchQuery}
                            >
                              Search
                            </Button>
                          </div>
                        </div>
                        
                        {ldapResults.length > 0 && (
                          <div className="space-y-2">
                            <Label>Search Results</Label>
                            {ldapResults.map((result, index) => (
                              <div
                                key={index}
                                className="p-3 border rounded cursor-pointer hover:bg-gray-100"
                                onClick={() => handleLdapUserSelect(result)}
                              >
                                <div className="font-medium">{result.cn}</div>
                                <div className="text-sm text-gray-600">{result.username} • {result.email}</div>
                              </div>
                            ))}
                          </div>
                        )}

                        {selectedLdapUser && (
                          <div className="p-3 border border-green-200 rounded bg-green-50">
                            <div className="text-sm font-medium text-green-800">Selected User:</div>
                            <div className="text-sm text-green-700">{selectedLdapUser.cn} ({selectedLdapUser.username})</div>
                          </div>
                        )}
                      </div>
                    )}

                    {createForm.watch("authType") === "local" && (
                      <FormField
                        control={createForm.control}
                        name="password"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Password</FormLabel>
                            <FormControl>
                              <Input type="password" {...field} />
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    )}

                    <FormField
                      control={createForm.control}
                      name="firstName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>First Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly={createForm.watch("authType") === "ldap"}
                              className={createForm.watch("authType") === "ldap" ? "bg-gray-100" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="lastName"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Last Name</FormLabel>
                          <FormControl>
                            <Input 
                              {...field} 
                              readOnly={createForm.watch("authType") === "ldap"}
                              className={createForm.watch("authType") === "ldap" ? "bg-gray-100" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input 
                              type="email"
                              {...field} 
                              readOnly={createForm.watch("authType") === "ldap"}
                              className={createForm.watch("authType") === "ldap" ? "bg-gray-100" : ""}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={createForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Role</FormLabel>
                          <Select onValueChange={field.onChange} defaultValue={field.value}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Select a role" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              <SelectItem value="admin">Admin</SelectItem>
                              <SelectItem value="user">User</SelectItem>
                              <SelectItem value="reporter">Reporter</SelectItem>
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                        Cancel
                      </Button>
                      <Button type="submit" disabled={createUserMutation.isPending}>
                        {createUserMutation.isPending ? "Creating..." : "Create User"}
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </div>

      {/* Search and Filter Controls */}
      <div className="flex gap-4 items-center">
        <div className="flex-1">
          <Input
            placeholder="Search users by username, name, or email..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="max-w-md"
          />
        </div>
        <div className="min-w-[200px]">
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Roles</SelectItem>
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="user">User</SelectItem>
              <SelectItem value="reporter">Reporter</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="border rounded-lg">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>User</TableHead>
              <TableHead>Full Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Role</TableHead>
              <TableHead>Auth Type</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Created</TableHead>
              {isAdmin && <TableHead>Actions</TableHead>}
            </TableRow>
          </TableHeader>
          <TableBody>
            {userList.map((user: SystemUser) => (
              <TableRow key={user.id}>
                <TableCell className="font-medium">
                  <div className="flex items-center space-x-3">
                    <UserAvatar user={user} size="sm" />
                    <span>{user.username}</span>
                  </div>
                </TableCell>
                <TableCell>
                  {user.firstName || user.lastName 
                    ? `${user.firstName || ''} ${user.lastName || ''}`.trim()
                    : '-'
                  }
                </TableCell>
                <TableCell>{user.email || '-'}</TableCell>
                <TableCell>
                  <Badge variant={user.role === "admin" ? "default" : "secondary"}>
                    {user.role}
                  </Badge>
                </TableCell>
                <TableCell>
                  <Badge variant="outline">{user.authType}</Badge>
                </TableCell>
                <TableCell>
                  <Badge variant={user.isActive ? "default" : "secondary"} className={user.isActive ? "bg-green-500 hover:bg-green-600" : ""}>
                    {user.isActive ? "Active" : "Inactive"}
                  </Badge>
                </TableCell>
                <TableCell className="text-sm text-muted-foreground">
                  {new Date(user.createdAt).toLocaleDateString()}
                </TableCell>
                {isAdmin && (
                  <TableCell>
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(user)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      {user.authType === "local" && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedUser(user);
                            setShowAdminPasswordDialog(true);
                          }}
                        >
                          <Lock className="h-4 w-4" />
                        </Button>
                      )}
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                            <AlertDialogDescription>
                              This action cannot be undone. This will permanently delete the user
                              account for "{user.username}".
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel>Cancel</AlertDialogCancel>
                            <AlertDialogAction onClick={() => handleDelete(user.id)}>
                              Delete
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Edit User Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit User</DialogTitle>
            <DialogDescription>
              Update user information and permissions.
            </DialogDescription>
          </DialogHeader>
          <Form {...editForm}>
            <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
              <FormField
                control={editForm.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Username</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>First Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Last Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="role"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a role" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="admin">Admin</SelectItem>
                        <SelectItem value="user">User</SelectItem>
                        <SelectItem value="reporter">Reporter</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="authType"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Authentication Type</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select authentication type" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="local">Local</SelectItem>
                        <SelectItem 
                          value="ldap" 
                          disabled={!isLdapEnabled}
                          className={!isLdapEnabled ? "opacity-50 cursor-not-allowed" : ""}
                        >
                          LDAP {!isLdapEnabled && "(Disabled)"}
                        </SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={editForm.control}
                name="isActive"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                    <div className="space-y-0.5">
                      <FormLabel>Active Status</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Enable or disable this user account
                      </div>
                    </div>
                    <FormControl>
                      <input
                        type="checkbox"
                        checked={field.value}
                        onChange={field.onChange}
                        className="h-4 w-4"
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowEditDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={updateUserMutation.isPending}>
                  {updateUserMutation.isPending ? "Updating..." : "Update User"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Admin Password Reset Dialog */}
      <Dialog open={showAdminPasswordDialog} onOpenChange={setShowAdminPasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset User Password</DialogTitle>
            <DialogDescription>
              Reset password for {selectedUser?.username}. This will overwrite their current password.
            </DialogDescription>
          </DialogHeader>
          <Form {...adminPasswordForm}>
            <form onSubmit={adminPasswordForm.handleSubmit(onAdminPasswordSubmit)} className="space-y-4">
              <FormField
                control={adminPasswordForm.control}
                name="newPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>New Password</FormLabel>
                    <FormControl>
                      <Input type="password" {...field} placeholder="Enter new password" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-end space-x-2">
                <Button type="button" variant="outline" onClick={() => setShowAdminPasswordDialog(false)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={adminPasswordResetMutation.isPending}>
                  {adminPasswordResetMutation.isPending ? "Resetting..." : "Reset Password"}
                </Button>
              </div>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}