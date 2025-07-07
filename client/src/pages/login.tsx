import { useState } from "react";
import { Link } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Logo } from "@/components/ui/logo";
import { useToast } from "@/hooks/use-toast";
import { ExternalLink } from "lucide-react";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [authType, setAuthType] = useState("local");
  const [isLoading, setIsLoading] = useState(false);
  const { login } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      await login(username, password, authType);
      toast({
        title: "Login successful",
        description: "Welcome to ThreatIntel Platform",
      });
    } catch (error) {
      toast({
        title: "Login failed",
        description: "Invalid credentials or authentication error",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
      <div className="max-w-md w-full space-y-8 p-8">
        <div className="text-center">
          <div className="mx-auto mb-4 flex justify-center">
            <Logo size="lg" />
          </div>
          <h2 className="mt-6 text-3xl font-bold text-white">The Blacklist</h2>
          <p className="mt-2 text-sm text-gray-300">Sign in to your account</p>
        </div>

        <Card className="bg-white shadow-xl">
          <CardContent className="p-8">
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="Enter your username"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    required
                  />
                </div>
                <div>
                  <Label htmlFor="auth-type">Authentication Type</Label>
                  <Select value={authType} onValueChange={setAuthType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="local">Local Authentication</SelectItem>
                      <SelectItem value="ldap">LDAP (Active Directory)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                type="submit"
                className="w-full"
                disabled={isLoading}
              >
                {isLoading ? "Signing in..." : "Sign in"}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Public Access Section */}
        <div className="mt-6 text-center">
          <div className="bg-gray-800 bg-opacity-50 rounded-lg p-4 border border-gray-600">
            <p className="text-gray-300 text-sm mb-3">🔗 View Public Blacklist Data</p>
            <Link href="/public/blacklist">
              <Button 
                variant="outline" 
                className="bg-transparent border-gray-400 text-gray-300 hover:bg-gray-700 hover:text-white hover:border-gray-300"
              >
                <ExternalLink className="h-4 w-4 mr-2" />
                Go to Public Blacklist
              </Button>
            </Link>
            <p className="text-gray-400 text-xs mt-2">Access blacklist data without login</p>
          </div>
        </div>
      </div>
    </div>
  );
}
