import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Code, Copy, Lock, Key, Globe, FileText, Plus, MessageSquare } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";

export default function ApiDocsPage() {
  const [bearerToken, setBearerToken] = useState("");
  const { toast } = useToast();

  // Get user's IP address
  const { data: ipInfo } = useQuery({
    queryKey: ["/api/my-ip"],
    retry: false,
  });

  // Check IP access control
  const { data: ipAccessCheck, isLoading: checkingAccess, error: accessError } = useQuery({
    queryKey: ["/api-docs-access-check"],
    queryFn: async () => {
      const response = await apiRequest("GET", "/api-docs");
      return await response.json();
    },
    retry: false,
  });

  if (checkingAccess) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Checking access permissions...</p>
          </div>
        </div>
      </div>
    );
  }

  if (accessError) {
    const errorMessage = accessError.message || "Access denied";
    const ipAddress = ipInfo?.ip || "Unknown";
    
    return (
      <div className="space-y-6 p-6">
        <div className="flex items-center justify-center min-h-[400px]">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle className="flex items-center text-destructive">
                <Lock className="w-5 h-5 mr-2" />
                Access Denied
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-muted-foreground">
                {errorMessage.includes("Insufficient permissions") 
                  ? "You don't have permission to access the API documentation. Only Admin and User roles can access this page."
                  : "Your IP address is not authorized to access the API documentation."
                }
              </p>
              {!errorMessage.includes("Insufficient permissions") && (
                <>
                  <div className="bg-muted p-3 rounded-lg">
                    <p className="text-sm font-medium">Your IP Address:</p>
                    <code className="text-sm font-mono">{ipAddress}</code>
                  </div>
                  <div className="bg-yellow-50 dark:bg-yellow-900/20 p-3 rounded-lg">
                    <p className="text-sm text-yellow-800 dark:text-yellow-200">
                      <strong>To fix this:</strong> Go to Settings → API Documentation Access Control and add your IP address ({ipAddress}) to the allowed list.
                    </p>
                  </div>
                </>
              )}
              {errorMessage.includes("Insufficient permissions") && (
                <div className="bg-red-50 dark:bg-red-900/20 p-3 rounded-lg">
                  <p className="text-sm text-red-800 dark:text-red-200">
                    <strong>Permission denied:</strong> API documentation is restricted to Admin and User roles. Reporter users cannot access this section.
                  </p>
                </div>
              )}
              <p className="text-sm text-muted-foreground">
                Error details: {errorMessage}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Code example copied to clipboard.",
    });
  };

  const endpoints = [
    {
      method: "GET",
      path: "/api/indicators",
      description: "Retrieve threat indicators with pagination and filtering",
      params: [
        { name: "page", type: "number", description: "Page number (default: 1)" },
        { name: "limit", type: "number", description: "Items per page (default: 50)" },
        { name: "type", type: "string", description: "Filter by type: ip, domain, hash, url" },
        { name: "status", type: "string", description: "Filter by status: active, inactive" },
        { name: "source", type: "string", description: "Filter by source" },
        { name: "search", type: "string", description: "Search indicators by value" },
      ],
      roles: ["admin", "user", "reporter"],
      example: `curl -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/indicators?page=1&limit=10&type=ip"`
    },
    {
      method: "POST",
      path: "/api/indicators",
      description: "Create a new threat indicator (type is automatically detected from value)",
      body: {
        value: "192.168.1.100",
        notes: "Suspicious IP address detected",
        durationHours: 24
      },
      roles: ["admin", "user"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "value": "192.168.1.100",
    "notes": "Suspicious IP address detected",
    "durationHours": 24
  }' \\
  "${window.location.origin}/api/indicators"`
    },
    {
      method: "PUT",
      path: "/api/indicators/:id",
      description: "Update an existing indicator",
      body: {
        isActive: false,
        notes: "Updated notes"
      },
      roles: ["admin", "user"],
      example: `curl -X PUT \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "isActive": false,
    "notes": "Updated notes"
  }' \\
  "${window.location.origin}/api/indicators/123"`
    },
    {
      method: "POST",
      path: "/api/indicators/:id/temp-activate",
      description: "Temporarily activate an indicator for specified duration",
      body: {
        durationHours: 24
      },
      roles: ["admin", "user"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "durationHours": 24
  }' \\
  "${window.location.origin}/api/indicators/123/temp-activate"`
    },
    {
      method: "POST",
      path: "/api/indicators/:id/notes",
      description: "Add a note to an indicator",
      body: {
        content: "This indicator was confirmed as malicious by threat research team"
      },
      roles: ["admin", "user"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "content": "This indicator was confirmed as malicious"
  }' \\
  "${window.location.origin}/api/indicators/123/notes"`
    },
    {
      method: "GET",
      path: "/api/indicators/:id/notes",
      description: "Get all notes for an indicator",
      roles: ["admin", "user", "reporter"],
      example: `curl -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/indicators/123/notes"`
    },
    {
      method: "GET",
      path: "/api/indicator/check",
      description: "Check if an indicator exists and return the record if found",
      params: [
        { name: "value", type: "string", description: "The indicator value to check (required)" }
      ],
      roles: ["admin", "user", "reporter"],
      example: `curl -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/indicator/check?value=192.168.1.100"`
    },
    {
      method: "GET",
      path: "/api/whitelist",
      description: "Get all whitelist entries",
      roles: ["admin", "user", "reporter"],
      example: `curl -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/whitelist"`
    },
    {
      method: "POST",
      path: "/api/whitelist",
      description: "Add a new whitelist entry (type is automatically detected from value)",
      body: {
        value: "192.168.1.0/24",
        reason: "Internal network range - safe to whitelist"
      },
      roles: ["admin", "user"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "value": "192.168.1.0/24",
    "reason": "Internal network range - safe to whitelist"
  }' \\
  "${window.location.origin}/api/whitelist"`
    },
    {
      method: "DELETE",
      path: "/api/whitelist/:id",
      description: "Delete a whitelist entry",
      roles: ["admin"],
      example: `curl -X DELETE \\
  -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/whitelist/123"`
    },
    {
      method: "POST",
      path: "/api/whitelist/bulk-delete",
      description: "Delete multiple whitelist entries",
      body: {
        ids: [1, 2, 3]
      },
      roles: ["admin"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "ids": [1, 2, 3]
  }' \\
  "${window.location.origin}/api/whitelist/bulk-delete"`
    },
    {
      method: "POST",
      path: "/api/whitelist/check",
      description: "Check if a value is whitelisted (type is automatically detected)",
      body: {
        value: "192.168.1.100"
      },
      roles: ["admin", "user", "reporter"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "value": "192.168.1.100"
  }' \\
  "${window.location.origin}/api/whitelist/check"`
    },
    {
      method: "GET",
      path: "/api/whitelist/blocks",
      description: "Get whitelist block events (when indicators were blocked by whitelist)",
      params: [
        { name: "page", type: "number", description: "Page number (default: 1)" },
        { name: "limit", type: "number", description: "Items per page (default: 25)" }
      ],
      roles: ["admin", "user", "reporter"],
      example: `curl -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/whitelist/blocks?page=1&limit=10"`
    },
    {
      method: "GET",
      path: "/api/data-sources",
      description: "Get all data sources",
      roles: ["admin", "user", "reporter"],
      example: `curl -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/data-sources"`
    },
    {
      method: "POST",
      path: "/api/data-sources",
      description: "Create a new data source. The indicatorTypes field accepts an array of one or more indicator types (ip, domain, hash, url).",
      body: {
        name: "AlienVault OTX",
        url: "https://otx.alienvault.com/api/v1/indicators/export",
        fetchInterval: 3600,
        indicatorTypes: ["ip", "domain"],
        isActive: true
      },
      roles: ["admin"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "AlienVault OTX",
    "url": "https://otx.alienvault.com/api/v1/indicators/export",
    "fetchInterval": 3600,
    "indicatorTypes": ["ip", "domain"],
    "isActive": true
  }' \\
  "${window.location.origin}/api/data-sources"`
    },
    {
      method: "PUT",
      path: "/api/data-sources/:id",
      description: "Update an existing data source",
      body: {
        name: "Updated Data Source",
        fetchInterval: 7200,
        isActive: false
      },
      roles: ["admin"],
      example: `curl -X PUT \\
  -H "Authorization: Bearer ${bearerToken}" \\
  -H "Content-Type: application/json" \\
  -d '{
    "name": "Updated Data Source",
    "fetchInterval": 7200,
    "isActive": false
  }' \\
  "${window.location.origin}/api/data-sources/123"`
    },
    {
      method: "DELETE",
      path: "/api/data-sources/:id",
      description: "Delete a data source",
      roles: ["admin"],
      example: `curl -X DELETE \\
  -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/data-sources/123"`
    },
    {
      method: "POST",
      path: "/api/data-sources/:id/pause",
      description: "Pause a data source (stop automatic fetching)",
      roles: ["admin"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/data-sources/123/pause"`
    },
    {
      method: "POST",
      path: "/api/data-sources/:id/resume",
      description: "Resume a paused data source",
      roles: ["admin"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/data-sources/123/resume"`
    },
    {
      method: "POST",
      path: "/api/data-sources/:id/fetch",
      description: "Manually trigger data fetch for a data source",
      roles: ["admin"],
      example: `curl -X POST \\
  -H "Authorization: Bearer ${bearerToken}" \\
  "${window.location.origin}/api/data-sources/123/fetch"`
    }
  ];

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-3xl font-bold">API Documentation</h1>
        <p className="text-muted-foreground">
          Comprehensive API documentation for programmatic access to the threat intelligence platform
        </p>
      </div>

      <Tabs defaultValue="authentication" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="authentication">Authentication</TabsTrigger>
          <TabsTrigger value="endpoints">Endpoints</TabsTrigger>
          <TabsTrigger value="examples">Examples</TabsTrigger>
          <TabsTrigger value="response-codes">Response Codes</TabsTrigger>
        </TabsList>

        <TabsContent value="authentication" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Key className="w-5 h-5 mr-2" />
                API Authentication
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h3 className="text-lg font-semibold mb-2">Bearer Token Authentication</h3>
                <p className="text-muted-foreground mb-4">
                  All API requests require authentication using a Bearer token in the Authorization header.
                </p>
                
                <div className="space-y-2">
                  <Label htmlFor="token-input">Test with your API token:</Label>
                  <div className="flex space-x-2">
                    <Input
                      id="token-input"
                      type="password"
                      placeholder="Enter your API token here..."
                      value={bearerToken}
                      onChange={(e) => setBearerToken(e.target.value)}
                    />
                    <Button
                      variant="outline"
                      onClick={() => setBearerToken("")}
                    >
                      Clear
                    </Button>
                  </div>
                </div>

                <div className="bg-muted p-4 rounded-lg">
                  <h4 className="font-medium mb-2">Authorization Header Format:</h4>
                  <code className="text-sm">Authorization: Bearer your-api-token-here</code>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Getting Started</h3>
                <ol className="list-decimal list-inside space-y-2 text-sm">
                  <li>Navigate to the API Tokens page to generate a new token</li>
                  <li>Copy your token and store it securely</li>
                  <li>Include the token in the Authorization header of all API requests</li>
                  <li>Ensure your user role has permission for the endpoints you want to access</li>
                </ol>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">Rate Limiting</h3>
                <p className="text-muted-foreground text-sm">
                  API requests are subject to rate limiting. Respect the rate limits to ensure continued access.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="endpoints" className="space-y-4">
          {endpoints.map((endpoint, index) => (
            <Card key={index}>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <div className="flex items-center">
                    <Badge variant={endpoint.method === "GET" ? "default" : endpoint.method === "POST" ? "secondary" : "outline"} className="mr-2">
                      {endpoint.method}
                    </Badge>
                    <code className="text-sm">{endpoint.path}</code>
                  </div>
                  <div className="flex space-x-1">
                    {endpoint.roles.map((role) => (
                      <Badge key={role} variant="outline" className="text-xs">
                        {role}
                      </Badge>
                    ))}
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-muted-foreground">{endpoint.description}</p>

                {endpoint.params && (
                  <div>
                    <h4 className="font-medium mb-2">Query Parameters:</h4>
                    <div className="space-y-1">
                      {endpoint.params.map((param, paramIndex) => (
                        <div key={paramIndex} className="flex justify-between items-center text-sm">
                          <code className="font-mono">{param.name}</code>
                          <span className="text-muted-foreground">{param.type}</span>
                          <span className="text-muted-foreground flex-1 ml-4">{param.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {endpoint.body && (
                  <div>
                    <h4 className="font-medium mb-2">Request Body:</h4>
                    <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                      <code>{JSON.stringify(endpoint.body, null, 2)}</code>
                    </pre>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">cURL Example:</h4>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => copyToClipboard(endpoint.example)}
                    >
                      <Copy className="w-4 h-4 mr-2" />
                      Copy
                    </Button>
                  </div>
                  <pre className="bg-muted p-3 rounded-lg text-sm overflow-x-auto">
                    <code>{endpoint.example}</code>
                  </pre>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="examples" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Common Usage Examples</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-2">Python Example</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`import requests

# Configuration
API_BASE_URL = "${window.location.origin}"
API_TOKEN = "${bearerToken || 'your-api-token-here'}"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Get indicators
response = requests.get(f"{API_BASE_URL}/api/indicators", headers=headers)
indicators = response.json()

# Create a new indicator (type is automatically detected)
new_indicator = {
    "value": "malicious-domain.com",
    "notes": "Reported by security team",
    "durationHours": 24
}

response = requests.post(
    f"{API_BASE_URL}/api/indicators",
    headers=headers,
    json=new_indicator
)

print(f"Created indicator: {response.json()}")

# Check if an indicator exists
check_value = "192.168.1.100"
response = requests.get(
    f"{API_BASE_URL}/api/indicator/check",
    headers=headers,
    params={"value": check_value}
)

result = response.json()
if result["exists"]:
    print(f"Indicator found: {result['indicator']['value']} (ID: {result['indicator']['id']})")
else:
    print(f"Indicator not found: {result['message']}")`}</code>
                </pre>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(`import requests

# Configuration
API_BASE_URL = "https://your-domain.replit.app"
API_TOKEN = "${bearerToken || 'your-api-token-here'}"

headers = {
    "Authorization": f"Bearer {API_TOKEN}",
    "Content-Type": "application/json"
}

# Get indicators
response = requests.get(f"{API_BASE_URL}/api/indicators", headers=headers)
indicators = response.json()

# Create a new indicator (type is automatically detected)
new_indicator = {
    "value": "malicious-domain.com",
    "notes": "Reported by security team"
}

response = requests.post(
    f"{API_BASE_URL}/api/indicators",
    headers=headers,
    json=new_indicator
)

print(f"Created indicator: {response.json()}")`)}
                  className="mt-2"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy Python Example
                </Button>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-2">JavaScript/Node.js Example</h3>
                <pre className="bg-muted p-4 rounded-lg text-sm overflow-x-auto">
                  <code>{`const API_BASE_URL = "https://your-domain.replit.app";
const API_TOKEN = "${bearerToken || 'your-api-token-here'}";

const headers = {
    'Authorization': \`Bearer \${API_TOKEN}\`,
    'Content-Type': 'application/json'
};

// Get indicators
async function getIndicators() {
    const response = await fetch(\`\${API_BASE_URL}/api/indicators\`, {
        headers: headers
    });
    const data = await response.json();
    return data;
}

// Create indicator
async function createIndicator(indicator) {
    const response = await fetch(\`\${API_BASE_URL}/api/indicators\`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(indicator)
    });
    return await response.json();
}

// Usage (type is automatically detected)
const newIndicator = {
    value: "192.168.1.100",
    notes: "Detected in network scan"
};

createIndicator(newIndicator).then(result => {
    console.log('Created:', result);
});`}</code>
                </pre>
                <Button
                  variant="outline"
                  onClick={() => copyToClipboard(`const API_BASE_URL = "https://your-domain.replit.app";
const API_TOKEN = "${bearerToken || 'your-api-token-here'}";

const headers = {
    'Authorization': \`Bearer \${API_TOKEN}\`,
    'Content-Type': 'application/json'
};

// Get indicators
async function getIndicators() {
    const response = await fetch(\`\${API_BASE_URL}/api/indicators\`, {
        headers: headers
    });
    const data = await response.json();
    return data;
}

// Create indicator
async function createIndicator(indicator) {
    const response = await fetch(\`\${API_BASE_URL}/api/indicators\`, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify(indicator)
    });
    return await response.json();
}

// Usage (type is automatically detected)
const newIndicator = {
    value: "192.168.1.100",
    notes: "Detected in network scan"
};

createIndicator(newIndicator).then(result => {
    console.log('Created:', result);
});`)}
                  className="mt-2"
                >
                  <Copy className="w-4 h-4 mr-2" />
                  Copy JavaScript Example
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="response-codes" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>HTTP Response Codes</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <Badge variant="default" className="mb-2">200 OK</Badge>
                  <p className="text-sm text-muted-foreground">Request successful</p>
                </div>
                <div>
                  <Badge variant="secondary" className="mb-2">201 Created</Badge>
                  <p className="text-sm text-muted-foreground">Resource created successfully</p>
                </div>
                <div>
                  <Badge variant="destructive" className="mb-2">400 Bad Request</Badge>
                  <p className="text-sm text-muted-foreground">Invalid request parameters or body</p>
                </div>
                <div>
                  <Badge variant="destructive" className="mb-2">401 Unauthorized</Badge>
                  <p className="text-sm text-muted-foreground">Missing or invalid authentication token</p>
                </div>
                <div>
                  <Badge variant="destructive" className="mb-2">403 Forbidden</Badge>
                  <p className="text-sm text-muted-foreground">Insufficient permissions for this resource</p>
                </div>
                <div>
                  <Badge variant="destructive" className="mb-2">404 Not Found</Badge>
                  <p className="text-sm text-muted-foreground">Resource not found</p>
                </div>
                <div>
                  <Badge variant="destructive" className="mb-2">500 Internal Server Error</Badge>
                  <p className="text-sm text-muted-foreground">Server error occurred</p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-lg font-semibold mb-2">Error Response Format</h3>
                <pre className="bg-muted p-3 rounded-lg text-sm">
                  <code>{`{
  "error": "Detailed error message",
  "code": "ERROR_CODE" // Optional
}`}</code>
                </pre>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <Lock className="w-5 h-5 mr-2" />
            Security & Best Practices
          </CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="space-y-2 text-sm">
            <li>• Keep your API tokens secure and never share them publicly</li>
            <li>• Use HTTPS for all API requests in production</li>
            <li>• Implement proper error handling in your applications</li>
            <li>• Set expiration dates on API tokens when possible</li>
            <li>• Regularly rotate your API tokens</li>
            <li>• Monitor API usage and revoke tokens if compromised</li>
            <li>• Follow the principle of least privilege for user roles</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}