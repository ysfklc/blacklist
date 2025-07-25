import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Trash2, Plus, Copy, Eye, EyeOff, Calendar } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

interface ApiToken {
  id: number;
  name: string;
  token: string;
  isActive: boolean;
  lastUsed: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function ApiTokensPage() {
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenExpiry, setNewTokenExpiry] = useState("");
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [showTokenDialog, setShowTokenDialog] = useState(false);
  const [showPasswordDialog, setShowPasswordDialog] = useState(false);
  const [password, setPassword] = useState("");
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [viewingTokenId, setViewingTokenId] = useState<number | null>(null);
  const [revealedToken, setRevealedToken] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: tokens = [], isLoading } = useQuery<ApiToken[]>({
    queryKey: ["/api/tokens"],
  });

  const createMutation = useMutation({
    mutationFn: async (data: { name: string; expiresAt?: string }) => {
      const response = await apiRequest("POST", "/api/tokens", data);
      return await response.json();
    },
    onSuccess: (data) => {
      setCreatedToken(data.token);
      setShowTokenDialog(true);
      setIsCreateDialogOpen(false);
      setNewTokenName("");
      setNewTokenExpiry("");
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({
        title: "API Token Created",
        description: "Your new API token has been created successfully.",
      });
    },
    onError: (error: any) => {
      console.error("Token creation error:", error);
      toast({
        title: "Error",
        description: error?.message || "Failed to create API token.",
        variant: "destructive",
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("DELETE", `/api/tokens/${id}`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({
        title: "Token Deleted",
        description: "API token has been deleted successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to delete API token.",
        variant: "destructive",
      });
    },
  });

  const revokeMutation = useMutation({
    mutationFn: async (id: number) => {
      const response = await apiRequest("PATCH", `/api/tokens/${id}/revoke`);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/tokens"] });
      toast({
        title: "Token Revoked",
        description: "API token has been revoked successfully.",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to revoke API token.",
        variant: "destructive",
      });
    },
  });

  const verifyPasswordMutation = useMutation({
    mutationFn: async (password: string) => {
      if (viewingTokenId) {
        // Use the new token reveal endpoint that combines password verification and token retrieval
        const response = await apiRequest("POST", `/api/tokens/${viewingTokenId}/reveal`, { password });
        return await response.json();
      } else {
        // Fallback to just password verification
        const response = await apiRequest("POST", "/api/auth/verify-password", { password });
        return await response.json();
      }
    },
    onSuccess: (data) => {
      setShowPasswordDialog(false);
      setPassword("");
      
      if (viewingTokenId && data.token) {
        // Set the full revealed token
        setRevealedToken(data.token);
        // Keep viewingTokenId set so isTokenRevealed works correctly
      }
    },
    onError: (error: any) => {
      toast({
        title: "Invalid Password",
        description: "The password you entered is incorrect.",
        variant: "destructive",
      });
    },
  });

  const handleCreateToken = () => {
    if (!newTokenName.trim()) {
      toast({
        title: "Error",
        description: "Token name is required.",
        variant: "destructive",
      });
      return;
    }

    const data: { name: string; expiresAt?: string } = {
      name: newTokenName.trim(),
    };

    if (newTokenExpiry) {
      data.expiresAt = new Date(newTokenExpiry).toISOString();
    }

    createMutation.mutate(data);
  };

  const handleVerifyPassword = () => {
    if (!password.trim()) {
      toast({
        title: "Error",
        description: "Password is required.",
        variant: "destructive",
      });
      return;
    }

    verifyPasswordMutation.mutate(password.trim());
  };

  const handleClosePasswordDialog = () => {
    setShowPasswordDialog(false);
    setPassword("");
    setViewingTokenId(null);
  };

  const handleViewToken = (tokenId: number) => {
    setViewingTokenId(tokenId);
    setShowPasswordDialog(true);
  };

  const isTokenRevealed = (tokenId: number) => {
    return revealedToken && viewingTokenId === tokenId;
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Token copied to clipboard.",
    });
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const isExpired = (expiresAt: string | null) => {
    if (!expiresAt) return false;
    return new Date(expiresAt) < new Date();
  };

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">API Tokens</h1>
          <p className="text-muted-foreground">Manage API tokens for programmatic access</p>
        </div>
        <div>Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">API Tokens</h1>
          <p className="text-muted-foreground">
            Generate and manage API tokens for programmatic access to the The BlackList platform
          </p>
        </div>
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Create Token
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New API Token</DialogTitle>
              <DialogDescription>
                Generate a new API token for programmatic access. Keep it secure as it won't be shown again.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="tokenName">Token Name</Label>
                <Input
                  id="tokenName"
                  value={newTokenName}
                  onChange={(e) => setNewTokenName(e.target.value)}
                  placeholder="My API Token"
                />
              </div>
              <div>
                <Label htmlFor="tokenExpiry">Expiry Date (Optional)</Label>
                <Input
                  id="tokenExpiry"
                  type="datetime-local"
                  value={newTokenExpiry}
                  onChange={(e) => setNewTokenExpiry(e.target.value)}
                />
              </div>
              <Button
                onClick={handleCreateToken}
                disabled={createMutation.isPending}
                className="w-full"
              >
                {createMutation.isPending ? "Creating..." : "Create Token"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {tokens.length === 0 ? (
          <Card>
            <CardContent className="pt-6">
              <div className="text-center text-muted-foreground">
                No API tokens found. Create your first token to get started.
              </div>
            </CardContent>
          </Card>
        ) : (
          tokens.map((token: ApiToken) => (
            <Card key={token.id}>
              <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-4">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{token.name}</CardTitle>
                  <div className="flex items-center space-x-2">
                    {!token.isActive ? (
                      <Badge variant="destructive">Revoked</Badge>
                    ) : isExpired(token.expiresAt) ? (
                      <Badge variant="destructive">Expired</Badge>
                    ) : (
                      <Badge variant="default">Active</Badge>
                    )}
                  </div>
                </div>
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm">
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Delete API Token</AlertDialogTitle>
                      <AlertDialogDescription>
                        Are you sure you want to delete this API token? This action cannot be undone.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => deleteMutation.mutate(token.id)}
                        disabled={deleteMutation.isPending}
                      >
                        Delete
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Token:</span>
                      <div className="flex space-x-2">
                        {isTokenRevealed(token.id) ? (
                          <>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => copyToClipboard(revealedToken || "")}
                      >
                        <Copy className="w-4 h-4 mr-2" />
                        Copy
                      </Button>
                                                  <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setRevealedToken(null);
                                setViewingTokenId(null);
                              }}
                            >
                              <EyeOff className="w-4 h-4 mr-2" />
                              Hide
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleViewToken(token.id)}
                          >
                            <Eye className="w-4 h-4 mr-2" />
                            View
                          </Button>
                        )}
                      </div>
                    </div>
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded block break-all">
                      {isTokenRevealed(token.id) ? revealedToken : "••••••••••••••••••••••••••••••••••••••••"}
                    </code>
                  </div>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Created:</span>
                      <div className="font-medium">{formatDate(token.createdAt)}</div>
                    </div>
                    {token.expiresAt && (
                      <div>
                        <span className="text-muted-foreground">Expires:</span>
                        <div className="font-medium">{formatDate(token.expiresAt)}</div>
                      </div>
                    )}
                    {token.lastUsed && (
                      <div>
                        <span className="text-muted-foreground">Last Used:</span>
                        <div className="font-medium">{formatDate(token.lastUsed)}</div>
                      </div>
                    )}
                  </div>
                  {token.isActive && !isExpired(token.expiresAt) && (
                    <div className="pt-4 border-t">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => revokeMutation.mutate(token.id)}
                        disabled={revokeMutation.isPending}
                        className="text-red-600 hover:text-red-700 border-red-200 hover:bg-red-50"
                      >
                        {revokeMutation.isPending ? "Revoking..." : "Revoke Token"}
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Password Verification Dialog */}
      <Dialog open={showPasswordDialog} onOpenChange={handleClosePasswordDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Verify Your Password</DialogTitle>
            <DialogDescription>
              Please enter your password to view the generated API token.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label htmlFor="password">Password</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Input
                  id="password"
                  type={isPasswordVisible ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Enter your password"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleVerifyPassword();
                    }
                  }}
                />
                <Button
                  variant="outline"
                  onClick={() => setIsPasswordVisible(!isPasswordVisible)}
                >
                  {isPasswordVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </Button>
              </div>
            </div>
            <div className="flex justify-end space-x-2">
              <Button
                variant="outline"
                onClick={handleClosePasswordDialog}
              >
                Cancel
              </Button>
              <Button
                onClick={handleVerifyPassword}
                disabled={verifyPasswordMutation.isPending}
              >
                {verifyPasswordMutation.isPending ? "Verifying..." : "Verify"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Token Created Dialog */}
      <Dialog open={showTokenDialog} onOpenChange={setShowTokenDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>API Token Created</DialogTitle>
            <DialogDescription>
              Your API token has been created. Copy it now - you won't be able to see it again!
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Your API Token</Label>
              <div className="flex items-center space-x-2 mt-2">
                <Textarea
                  value={createdToken || ""}
                  readOnly
                  className="font-mono text-sm"
                  rows={3}
                />
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(createdToken || "")}
                >
                  <Copy className="w-4 h-4" />
                </Button>
              </div>
            </div>
            <div className="bg-yellow-50 dark:bg-yellow-900/20 p-4 rounded-lg">
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                <strong>Important:</strong> Store this token securely. You won't be able to see it again.
                Use it in the Authorization header: <code>Bearer your-token-here</code>
              </p>
            </div>
            <Button
              onClick={() => {
                setShowTokenDialog(false);
                setCreatedToken(null);
              }}
              className="w-full"
            >
              I've Saved My Token
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}