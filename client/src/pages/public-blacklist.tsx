import { useState, useEffect } from "react";
import {
  Download,
  FileText,
  Shield,
  Globe,
  Hash,
  Link as LinkIcon,
  ExternalLink,
} from "lucide-react";
import { FeedLogo } from "@/components/ui/feed-logo";

interface BlacklistFiles {
  IP: string[];
  Domain: string[];
  Hash: string[];
  URL: string[];
}

interface BlacklistStats {
  ip: { count: number; totalCount: string; lastUpdated: string };
  domain: { count: number; totalCount: string; lastUpdated: string };
  hash: { count: number; totalCount: string; lastUpdated: string };
  url: { count: number; totalCount: string; lastUpdated: string };
}

export default function PublicBlacklist() {
  const [files, setFiles] = useState<BlacklistFiles | null>(null);
  const [stats, setStats] = useState<BlacklistStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const [filesResponse, statsResponse] = await Promise.all([
          fetch("/api/public/blacklist/files"),
          fetch("/api/public/blacklist/stats"),
        ]);

        if (filesResponse.ok && statsResponse.ok) {
          const filesData = await filesResponse.json();
          const statsData = await statsResponse.json();

          setFiles(filesData);
          setStats(statsData);
        } else {
          console.error(
            "Failed to fetch data:",
            filesResponse.status,
            statsResponse.status,
          );
        }
      } catch (error) {
        console.error("Failed to fetch blacklist data:", error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);

  const getIconForType = (type: string) => {
    switch (type.toLowerCase()) {
      case "ip":
        return <Globe className="h-5 w-5" />;
      case "domain":
        return <FileText className="h-5 w-5" />;
      case "hash":
        return <Hash className="h-5 w-5" />;
      case "url":
        return <LinkIcon className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type.toLowerCase()) {
      case "ip":
        return "Malicious IP addresses and network ranges";
      case "domain":
        return "Suspicious domains and hostnames";
      case "hash":
        return "File hashes of known malware";
      case "url":
        return "Malicious URLs and web resources";
      default:
        return "Threat intelligence indicators";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading blacklist data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center">
            <FeedLogo size="sm" className="mr-3 bg-gray-200 rounded p-1" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                Public Blacklist Feeds
              </h1>
              <p className="text-gray-600">
                Download the latest blacklist indicators for your security
                systems
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Stats Overview */}
        {stats && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {Object.entries(stats).map(([type, data]) => (
              <div key={type} className="bg-white rounded-lg shadow p-6">
                <div className="flex items-center">
                  <div className="flex-shrink-0">
                    <div className="p-2 bg-blue-100 rounded-lg">
                      {getIconForType(type)}
                    </div>
                  </div>
                  <div className="ml-4">
                    <h3 className="text-lg font-medium text-gray-900 capitalize">
                      {type}
                    </h3>
                    <p className="text-2xl font-bold text-blue-600">
                      {data.totalCount}
                    </p>
                    <p className="text-sm text-gray-500">indicators</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Download Sections */}
        <div className="space-y-8">
          {files &&
            Object.entries(files).map(([type, fileList]) => {
              // Ensure fileList is an array
              const safeFileList = Array.isArray(fileList) ? fileList : [];
              return (
                <div key={type} className="bg-white rounded-lg shadow">
                  <div className="px-6 py-4 border-b border-gray-200">
                    <div className="flex items-center">
                      <div className="flex-shrink-0 p-2 bg-blue-100 rounded-lg mr-4">
                        {getIconForType(type)}
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-gray-900 capitalize">
                          {type} Blacklist
                        </h2>
                        <p className="text-gray-600">
                          {getTypeDescription(type)}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-6">
                    {safeFileList.length > 0 ? (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {safeFileList.map((filename: string) => (
                          <div
                            key={filename}
                            className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:bg-blue-50 transition-colors"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">
                                  {filename}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {stats?.[
                                    type.toLowerCase() as keyof BlacklistStats
                                  ]?.lastUpdated
                                    ? `Updated: ${new Date(stats[type.toLowerCase() as keyof BlacklistStats].lastUpdated).toLocaleDateString()}`
                                    : "Available for download"}
                                </p>
                              </div>
                              <div className="flex items-center space-x-2 ml-4">
                                <a
                                  href={`/public/blacklist/${type}/${filename}`}
                                  download
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Download file"
                                >
                                  <Download className="h-4 w-4" />
                                </a>
                                <a
                                  href={`/public/blacklist/${type}/${filename}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-2 text-blue-600 hover:text-blue-800 hover:bg-blue-100 rounded-lg transition-colors"
                                  title="Open in new tab"
                                >
                                  <ExternalLink className="h-4 w-4" />
                                </a>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-gray-500 text-center py-8">
                        No {type.toLowerCase()} blacklist files available
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
        </div>

        {/* Footer Info */}
        <div className="mt-12 bg-blue-50 rounded-lg p-6">
          <h3 className="text-lg font-medium text-blue-900 mb-2">
            Usage Information
          </h3>
          <div className="text-blue-800 space-y-2">
            <p>
              • Files are updated automatically from various threat intelligence
              sources
            </p>
            <p>
              • Download and integrate these lists into your security tools and
              firewalls
            </p>
            <p>
              • Files are provided in plain text format, one indicator per line
            </p>
            <p>
              • Check back regularly for the latest threat intelligence updates
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
