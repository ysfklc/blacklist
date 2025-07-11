import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { RefreshCw, ExternalLink, Copy, Info, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface PublicFileStats {
  ip: {
    count: number;
    totalCount: string;
    lastUpdate: string;
  };
  domain: {
    count: number;
    totalCount: string;
    lastUpdate: string;
  };
  hash: {
    count: number;
    totalCount: string;
    lastUpdate: string;
  };
  url: {
    count: number;
    totalCount: string;
    lastUpdate: string;
  };
}

interface BlacklistFiles {
  IP: string[];
  Domain: string[];
  Hash: string[];
  URL: string[];
  Proxy: string[];
}

export default function PublicLinks() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading } = useQuery<PublicFileStats>({
    queryKey: ["/api/public-links/stats"],
  });

  const { data: files, isLoading: filesLoading } = useQuery<BlacklistFiles>({
    queryKey: ["/api/public-links/files"],
  });

  const refreshMutation = useMutation({
    mutationFn: async () => {
      // This would trigger blacklist regeneration
      const response = await fetch("/api/blacklist/refresh", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
      });
      if (!response.ok) throw new Error("Failed to refresh");
      return response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/public-links/stats"] });
      queryClient.invalidateQueries({ queryKey: ["/api/public-links/files"] });
      toast({
        title: "Success",
        description: "Blacklist files are being refreshed",
      });
    },
    onError: () => {
      toast({
        title: "Error",
        description: "Failed to refresh blacklist files",
        variant: "destructive",
      });
    },
  });

  const copyToClipboard = (url: string) => {
    const fullUrl = `${window.location.origin}${url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      toast({
        title: "Copied",
        description: "URL copied to clipboard",
      });
    });
  };

  if (isLoading) {
    return (
      <main className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="h-8 bg-gray-200 rounded w-1/4"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
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
            <h1 className="text-xl font-semibold text-gray-900">Public Blacklist Links</h1>
            <p className="mt-2 text-sm text-gray-700">Access public blacklist files organized by indicator type.</p>
          </div>
          <div className="mt-4 sm:mt-0 sm:ml-16 sm:flex-none">
            <Button
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
              className="bg-blue-600 hover:bg-blue-700 text-white"
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${refreshMutation.isPending ? 'animate-spin' : ''}`} />
              Refresh Lists
            </Button>
          </div>
        </div>

        {/* Public Directory Structure */}
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {/* IP Blacklists */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-blue-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v8a2 2 0 01-2 2h-2.22l.123.489.804.804A1 1 0 0113 18H7a1 1 0 01-.707-1.707l.804-.804L7.22 15H5a2 2 0 01-2-2V5zm5.771 7H9a1 1 0 110-2H8.771l.624-2.494A1 1 0 0110.516 7h1.484v2h-1.484l-.624 2.494A1 1 0 018.771 12z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">IP Blacklists</p>
                  <p className="text-lg font-medium text-gray-900">{stats?.ip.count || 0} files</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Last updated: <span>{stats?.ip.lastUpdate || 'Never'}</span></p>
                  <p>Total IPs: <span>{stats?.ip.totalCount || '0'}</span></p>
                </div>
                <div className="mt-3 space-y-1">
                  {files?.IP && files.IP.length > 0 ? (
                    files.IP.map((file, index) => (
                      <div key={file} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium text-gray-900 truncate flex-1">{file}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <a
                            href={`/public/blacklist/IP/${file}`}
                            download
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          <a
                            href={`/public/blacklist/IP/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No files available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Domain Blacklists */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-green-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM4.332 8.027a6.012 6.012 0 011.912-2.706C6.512 5.73 6.974 6 7.5 6A1.5 1.5 0 019 7.5V8a2 2 0 004 0 2 2 0 011.523-1.943A5.977 5.977 0 0116 10c0 .34-.028.675-.083 1H15a2 2 0 00-2 2v2.197A5.973 5.973 0 0110 16v-2a2 2 0 00-2-2 2 2 0 01-2-2 2 2 0 00-1.668-1.973z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Domain Blacklists</p>
                  <p className="text-lg font-medium text-gray-900">{stats?.domain.count || 0} files</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Last updated: <span>{stats?.domain.lastUpdate || 'Never'}</span></p>
                  <p>Total domains: <span>{stats?.domain.totalCount || '0'}</span></p>
                </div>
                <div className="mt-3 space-y-1">
                  {files?.Domain && files.Domain.length > 0 ? (
                    files.Domain.map((file, index) => (
                      <div key={file} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium text-gray-900 truncate flex-1">{file}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <a
                            href={`/public/blacklist/Domain/${file}`}
                            download
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          <a
                            href={`/public/blacklist/Domain/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No files available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Hash Blacklists */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-yellow-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 5a2 2 0 012-2h10a2 2 0 012 2v10a2 2 0 01-2 2H5a2 2 0 01-2-2V5zm11 1H6v8h8V6z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Hash Blacklists</p>
                  <p className="text-lg font-medium text-gray-900">{stats?.hash.count || 0} files</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Last updated: <span>{stats?.hash.lastUpdate || 'Never'}</span></p>
                  <p>Total hashes: <span>{stats?.hash.totalCount || '0'}</span></p>
                </div>
                <div className="mt-3 space-y-1">
                  {files?.Hash && files.Hash.length > 0 ? (
                    files.Hash.map((file, index) => (
                      <div key={file} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium text-gray-900 truncate flex-1">{file}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <a
                            href={`/public/blacklist/Hash/${file}`}
                            download
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          <a
                            href={`/public/blacklist/Hash/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No files available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* URL Blacklists */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-red-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M12.586 4.586a2 2 0 112.828 2.828l-3 3a2 2 0 01-2.828 0 1 1 0 00-1.414 1.414 4 4 0 005.656 0l3-3a4 4 0 00-5.656-5.656l-1.5 1.5a1 1 0 101.414 1.414l1.5-1.5zm-5 5a2 2 0 012.828 0 1 1 0 101.414-1.414 4 4 0 00-5.656 0l-3 3a4 4 0 105.656 5.656l1.5-1.5a1 1 0 10-1.414-1.414l-1.5 1.5a2 2 0 11-2.828-2.828l3-3z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">URL Blacklists</p>
                  <p className="text-lg font-medium text-gray-900">{stats?.url.count || 0} files</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Last updated: <span>{stats?.url.lastUpdate || 'Never'}</span></p>
                  <p>Total URLs: <span>{stats?.url.totalCount || '0'}</span></p>
                </div>
                <div className="mt-3 space-y-1">
                  {files?.URL && files.URL.length > 0 ? (
                    files.URL.map((file, index) => (
                      <div key={file} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium text-gray-900 truncate flex-1">{file}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <a
                            href={`/public/blacklist/URL/${file}`}
                            download
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          <a
                            href={`/public/blacklist/URL/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No files available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Proxy Format Files */}
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <div className="h-8 w-8 bg-purple-500 rounded-full flex items-center justify-center">
                    <svg className="h-4 w-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zM3 10a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zM14 9a1 1 0 00-1 1v6a1 1 0 001 1h2a1 1 0 001-1v-6a1 1 0 00-1-1h-2z" clipRule="evenodd" />
                    </svg>
                  </div>
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Proxy Format Files</p>
                  <p className="text-lg font-medium text-gray-900">{files?.Proxy?.length || 0} files</p>
                </div>
              </div>
              <div className="mt-4">
                <div className="text-sm text-gray-500 space-y-1">
                  <p>Format: Category-based proxy format</p>
                  <p>Contains: Domains and URLs</p>
                </div>
                <div className="mt-3 space-y-1">
                  {files?.Proxy && files.Proxy.length > 0 ? (
                    files.Proxy.map((file, index) => (
                      <div key={file} className="flex items-center justify-between py-1">
                        <span className="text-sm font-medium text-gray-900 truncate flex-1">{file}</span>
                        <div className="flex items-center space-x-1 ml-2">
                          <a
                            href={`/public/blacklist/Proxy/${file}`}
                            download
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Download file"
                          >
                            <Download className="h-3 w-3" />
                          </a>
                          <a
                            href={`/public/blacklist/Proxy/${file}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="h-7 w-7 p-0 text-blue-600 hover:text-blue-900 hover:bg-blue-50 inline-flex items-center justify-center rounded-md hover:bg-accent hover:text-accent-foreground transition-colors"
                            title="Open in new tab"
                          >
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-sm text-gray-500">No files available</p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Directories */}
        <Card className="mt-8">
          <CardHeader>
            <CardTitle>Directories</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">IP Blacklist Directory</p>
                  <p className="text-sm text-gray-500 font-mono">/public/blacklist/IP/</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("/public/blacklist/IP/")}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Domain Blacklist Directory</p>
                  <p className="text-sm text-gray-500 font-mono">/public/blacklist/Domain/</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("/public/blacklist/Domain/")}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Hash Blacklist Directory</p>
                  <p className="text-sm text-gray-500 font-mono">/public/blacklist/Hash/</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("/public/blacklist/Hash/")}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">URL Blacklist Directory</p>
                  <p className="text-sm text-gray-500 font-mono">/public/blacklist/URL/</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("/public/blacklist/URL/")}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <p className="text-sm font-medium text-gray-900">Proxy Format Directory</p>
                  <p className="text-sm text-gray-500 font-mono">/public/blacklist/Proxy/</p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => copyToClipboard("/public/blacklist/Proxy/")}
                  className="text-blue-600 hover:text-blue-900"
                >
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* File Format Information */}
        <div className="mt-6 bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <Info className="h-5 w-5 text-blue-400" />
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">File Format Information</h3>
              <div className="mt-2 text-sm text-blue-700">
                <ul className="list-disc list-inside space-y-1">
                  <li>Each file contains a maximum of 100,000 lines (default)</li>
                  <li>Domain entries include both domain.com and *.domain.com formats</li>
                  <li>Proxy format files use category-based structure with quoted entries</li>
                  <li>Files are updated automatically based on fetch intervals</li>
                  <li>All files are in plain text format (.txt)</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
