import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Database, ToggleRight, Clock, Network } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface DashboardStats {
  totalIndicators: number;
  activeIndicators: number;
  dataSources: number;
  lastUpdate: string;
  indicatorsByType: {
    ip: number;
    domain: number;
    hash: number;
    url: number;
    "soar-url": number;
  };
  indicatorsByDataSource: Record<string, number>;
  indicatorsByDataSourceAndType: Record<string, Record<string, number>>;
  recentActivity: Array<{
    id: number;
    level: string;
    action: string;
    details: string;
    createdAt: string;
  }>;
  dataSourcesStatus: Array<{
    id: number;
    name: string;
    type: string;
    status: string;
    lastFetch: string;
    nextFetch: string;
  }>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data: stats, isLoading } = useQuery<DashboardStats>({
    queryKey: ["/api/dashboard/stats"],
  });

  const { data: settings } = useQuery<any[]>({
    queryKey: ["/api/settings"],
  });

  // Check if SOAR-URL is enabled
  const isSoarUrlEnabled = settings?.find(s => s.key === "system.enableSoarUrl")?.value === "true";

  const canViewRecentActivity = user?.role !== "reporter";
  const isUserRole = user?.role === "user";

  if (isLoading) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="h-24 bg-gray-200 rounded-lg"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="flex-1 p-6">
        <div className="max-w-7xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-gray-900">No data available</h2>
            <p className="mt-2 text-gray-600">Unable to load dashboard statistics.</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <main className="flex-1 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Database className="h-8 w-8 text-gray-400" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Total Indicators</p>
                  <p className="text-lg font-medium text-gray-900">{stats.totalIndicators.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <ToggleRight className="h-8 w-8 text-green-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Active Indicators</p>
                  <p className="text-lg font-medium text-gray-900">{stats.activeIndicators.toLocaleString()}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Network className="h-8 w-8 text-blue-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Data Sources</p>
                  <p className="text-lg font-medium text-gray-900">{stats.dataSources}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <Clock className="h-8 w-8 text-yellow-500" />
                </div>
                <div className="ml-5 w-0 flex-1">
                  <p className="text-sm font-medium text-gray-500 truncate">Last Update</p>
                  <p className="text-lg font-medium text-gray-900">{stats.lastUpdate}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Charts Grid */}
        <div className={`grid gap-6 mb-8 ${canViewRecentActivity ? 'grid-cols-1 lg:grid-cols-3' : 'grid-cols-1 lg:grid-cols-2'}`}>
          {/* Indicator Types Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Indicator Types Distribution</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-3 w-3 bg-blue-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">IP Addresses</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.indicatorsByType.ip.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-3 w-3 bg-green-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Domains</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.indicatorsByType.domain.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-3 w-3 bg-yellow-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">Hashes</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.indicatorsByType.hash.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <div className="h-3 w-3 bg-red-500 rounded-full mr-2"></div>
                    <span className="text-sm text-gray-600">URLs</span>
                  </div>
                  <span className="text-sm font-medium text-gray-900">
                    {stats.indicatorsByType.url.toLocaleString()}
                  </span>
                </div>
                {isSoarUrlEnabled && (
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-3 w-3 bg-purple-500 rounded-full mr-2"></div>
                      <span className="text-sm text-gray-600">SOAR-URLs</span>
                    </div>
                    <span className="text-sm font-medium text-gray-900">
                      {stats.indicatorsByType["soar-url"].toLocaleString()}
                    </span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Indicators per Data Source Chart */}
          <Card>
            <CardHeader>
              <CardTitle>Indicators per Data Source</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(stats.indicatorsByDataSource).length === 0 ? (
                <p className="text-gray-500 text-sm">No indicators from data sources</p>
              ) : (
                <div className="max-h-96 overflow-y-auto">
                  <div className="space-y-4 pr-2">
                    {Object.entries(stats.indicatorsByDataSource)
                      .sort(([,a], [,b]) => b - a)
                      .map(([source, count], index) => {
                        const colors = [
                          'bg-blue-500', 'bg-green-500', 'bg-yellow-500', 
                          'bg-red-500', 'bg-purple-500', 'bg-indigo-500',
                          'bg-pink-500', 'bg-orange-500', 'bg-teal-500', 'bg-cyan-500'
                        ];
                        const color = colors[index % colors.length];
                        const typeBreakdown = stats.indicatorsByDataSourceAndType[source] || {};
                        
                        return (
                          <div key={source} className="border-b border-gray-100 pb-3 last:border-b-0">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center">
                                <div className={`h-3 w-3 ${color} rounded-full mr-2`}></div>
                                <span className="text-sm font-medium text-gray-900 truncate max-w-32">{source}</span>
                              </div>
                              <span className="text-sm font-bold text-gray-900">
                                {count.toLocaleString()}
                              </span>
                            </div>
                            <div className="ml-5 space-y-1">
                              {typeBreakdown.ip && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">IP Addresses</span>
                                  <span className="text-gray-700">{typeBreakdown.ip.toLocaleString()}</span>
                                </div>
                              )}
                              {typeBreakdown.domain && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Domains</span>
                                  <span className="text-gray-700">{typeBreakdown.domain.toLocaleString()}</span>
                                </div>
                              )}
                              {typeBreakdown.hash && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">Hashes</span>
                                  <span className="text-gray-700">{typeBreakdown.hash.toLocaleString()}</span>
                                </div>
                              )}
                              {typeBreakdown.url && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">URLs</span>
                                  <span className="text-gray-700">{typeBreakdown.url.toLocaleString()}</span>
                                </div>
                              )}
                              {isSoarUrlEnabled && typeBreakdown["soar-url"] && (
                                <div className="flex items-center justify-between text-xs">
                                  <span className="text-gray-500">SOAR-URLs</span>
                                  <span className="text-gray-700">{typeBreakdown["soar-url"].toLocaleString()}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Recent Activity - Only show for non-reporter roles */}
          {canViewRecentActivity && (
            <Card>
              <CardHeader>
                <CardTitle>Recent Activity</CardTitle>
              </CardHeader>
              <CardContent>
                {stats.recentActivity.length === 0 ? (
                  <p className="text-gray-500 text-sm">No recent activity</p>
                ) : (
                  <div className="flow-root max-h-96 overflow-y-auto">
                    <ul role="list" className="space-y-4">
                      {(() => {
                        const filteredActivities = stats.recentActivity.filter((activity) => {
                          // For users, only show fetch and blocked activities
                          if (isUserRole) {
                            return activity.action === 'fetch' || activity.action === 'block' || 
                                   activity.details.toLowerCase().includes('fetch') || 
                                   activity.details.toLowerCase().includes('block');
                          }
                          // For admins, show all activities
                          return true;
                        });
                        
                        return filteredActivities.map((activity, index) => (
                          <li key={activity.id}>
                            <div className="relative pb-4">
                              {index !== filteredActivities.length - 1 && (
                                <span className="absolute top-4 left-4 -ml-px h-6 w-0.5 bg-gray-200"></span>
                              )}
                              <div className="relative flex space-x-3">
                                <div>
                                  <span className={`h-8 w-8 rounded-full flex items-center justify-center ring-8 ring-white ${
                                    activity.level === 'error' ? 'bg-red-500' :
                                    activity.level === 'warning' ? 'bg-yellow-500' : 'bg-green-500'
                                  }`}>
                                    <span className="h-2 w-2 bg-white rounded-full"></span>
                                  </span>
                                </div>
                                <div className="min-w-0 flex-1 pt-1.5">
                                  <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-2">
                                    <div className="min-w-0 flex-1 pr-2">
                                      <p className="text-sm text-gray-500 break-words leading-relaxed">{activity.details}</p>
                                    </div>
                                    <div className="text-left sm:text-right text-sm text-gray-500 flex-shrink-0">
                                      <time>{new Date(activity.createdAt).toLocaleTimeString()}</time>
                                    </div>
                                </div>
                              </div>
                            </div>
                          </li>
                        ));
                      })()}
                    </ul>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Data Sources Status */}
        <Card>
          <CardHeader>
            <CardTitle>Data Sources Status</CardTitle>
          </CardHeader>
          <CardContent>
            {stats.dataSourcesStatus.length === 0 ? (
              <p className="text-gray-500">No data sources configured</p>
            ) : (
              <div className="overflow-hidden">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Source</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Last Fetch</th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Next Fetch</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {stats.dataSourcesStatus.map((source) => (
                      <tr key={source.id}>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{source.name}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 capitalize">{source.type}</td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                            source.status === 'success' ? 'bg-green-100 text-green-800' :
                            source.status === 'error' ? 'bg-red-100 text-red-800' : 'bg-yellow-100 text-yellow-800'
                          }`}>
                            <span className={`h-1.5 w-1.5 rounded-full mr-1 ${
                              source.status === 'success' ? 'bg-green-400' :
                              source.status === 'error' ? 'bg-red-400' : 'bg-yellow-400'
                            }`}></span>
                            {source.status === 'success' ? 'Active' : source.status === 'error' ? 'Error' : 'Pending'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{source.lastFetch}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{source.nextFetch}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
