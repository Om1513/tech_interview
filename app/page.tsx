'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import StatsCard from '@/components/StatsCard';
import LoadingSpinner from '@/components/LoadingSpinner';
import ErrorBoundary from '@/components/ErrorBoundary';
import { getAppStats, getPerformanceInsights, incrementMetric, AppStats } from '@/lib/stats';

const EXAMPLE_QUERIES = [
  {
    type: 'search',
    title: 'Houston Inspections',
    description: 'View all inspections in Houston',
    url: '/search?city=Houston&limit=25',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    )
  },
  {
    type: 'chat',
    title: 'Average Score Analysis',
    description: 'Ask AI about average inspection scores',
    query: 'What is the average inspection score for all pipes in the data?',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    )
  },
  {
    type: 'search',
    title: 'Pipes Needing Repair',
    description: 'Find all pipes requiring immediate repair',
    url: '/search?needsRepair=true&limit=25',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
      </svg>
    )
  },
  {
    type: 'chat',
    title: 'Material Analysis',
    description: 'Compare pipe materials and defects',
    query: 'Analyze the different pipe materials and tell me which material type has the most defects and problems',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    )
  }
];

export default function Dashboard() {
  const [stats, setStats] = useState<AppStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadStats();
  }, []);

  const loadStats = async () => {
    try {
      setLoading(true);
      setError(null);
      const appStats = await getAppStats();
      setStats(appStats);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load statistics');
      console.error('Failed to load stats:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleExampleClick = (example: typeof EXAMPLE_QUERIES[0]) => {
    if (example.type === 'search') {
      incrementMetric('searches');
      window.location.href = example.url!;
    } else {
      incrementMetric('chatQueries');
      window.location.href = `/chat?query=${encodeURIComponent(example.query!)}`;
    }
  };

  const insights = stats ? getPerformanceInsights(stats) : null;

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
        {/* Header */}
        <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="text-center">
              <h1 className="text-4xl font-bold text-foreground mb-2">
                Sewer Inspection Dashboard
              </h1>
              <p className="text-xl text-gray-600 dark:text-gray-400">
                Analyze infrastructure data with AI-powered insights
              </p>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {/* Statistics Cards */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">System Overview</h2>
            
            {loading ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="bg-white dark:bg-gray-900 rounded-lg p-6 border border-gray-200 dark:border-gray-700">
                    <LoadingSpinner size="sm" text="Loading..." />
                  </div>
                ))}
              </div>
            ) : error ? (
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-6">
                <p className="text-red-600 dark:text-red-400">Failed to load statistics: {error}</p>
                <button 
                  onClick={loadStats}
                  className="mt-2 text-red-600 dark:text-red-400 hover:underline"
                >
                  Try again
                </button>
              </div>
            ) : stats ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatsCard
                  title="Total Inspections"
                  value={stats.totalInspections}
                  description="Processed from data files"
                  color="blue"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                  }
                />
                
                <StatsCard
                  title="Average Score"
                  value={`${stats.averageScore}/100`}
                  description="Infrastructure condition"
                  color={stats.averageScore >= 80 ? 'green' : stats.averageScore >= 60 ? 'yellow' : 'red'}
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  }
                />
                
                <StatsCard
                  title="Repair Rate"
                  value={`${stats.repairRate}%`}
                  description="Pipes needing repair"
                  color={stats.repairRate <= 10 ? 'green' : stats.repairRate <= 25 ? 'yellow' : 'red'}
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  }
                />
                
                <StatsCard
                  title="Coverage"
                  value={`${stats.uniqueCities} cities`}
                  description={`${stats.uniqueMaterials} material types`}
                  color="purple"
                  icon={
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  }
                />
              </div>
            ) : null}
          </div>

          {/* Main Navigation */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Main Features</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <Link
                href="/search"
                className="group bg-white dark:bg-gray-900 rounded-lg p-8 border border-gray-200 dark:border-gray-700 
                         hover:shadow-lg hover:border-blue-300 dark:hover:border-blue-600 transition-all duration-200"
                onClick={() => incrementMetric('searches')}
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-blue-100 dark:bg-blue-900/30 p-3 rounded-lg group-hover:bg-blue-200 dark:group-hover:bg-blue-900/50 transition-colors">
                    <svg className="w-8 h-8 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      Search Inspections
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Filter and explore sewer inspection data by location, material, score, and repair status
                    </p>
                  </div>
        </div>
              </Link>

              <Link
                href="/chat"
                className="group bg-white dark:bg-gray-900 rounded-lg p-8 border border-gray-200 dark:border-gray-700 
                         hover:shadow-lg hover:border-green-300 dark:hover:border-green-600 transition-all duration-200"
                onClick={() => incrementMetric('chatQueries')}
              >
                <div className="flex items-center space-x-4">
                  <div className="bg-green-100 dark:bg-green-900/30 p-3 rounded-lg group-hover:bg-green-200 dark:group-hover:bg-green-900/50 transition-colors">
                    <svg className="w-8 h-8 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                    </svg>
                  </div>
                  <div>
                    <h3 className="text-xl font-semibold text-foreground group-hover:text-green-600 dark:group-hover:text-green-400 transition-colors">
                      GPT-5 AI Assistant
                    </h3>
                    <p className="text-gray-600 dark:text-gray-400 mt-1">
                      Ask intelligent questions about the data and get AI-powered insights and analysis
                    </p>
                  </div>
                </div>
              </Link>
            </div>
          </div>

          {/* Example Queries */}
          <div className="mb-8">
            <h2 className="text-2xl font-semibold text-foreground mb-6">Quick Examples</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {EXAMPLE_QUERIES.map((example, index) => (
                <button
                  key={index}
                  onClick={() => handleExampleClick(example)}
                  className="text-left p-4 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 
                           rounded-lg hover:shadow-md hover:border-gray-300 dark:hover:border-gray-600 
                           transition-all duration-200 group"
                >
                  <div className="flex items-center space-x-3 mb-2">
                    <div className={`p-2 rounded-lg ${
                      example.type === 'search' 
                        ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                        : 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400'
                    }`}>
                      {example.icon}
                    </div>
                    <h3 className="font-medium text-foreground group-hover:text-blue-600 dark:group-hover:text-blue-400 transition-colors">
                      {example.title}
                    </h3>
                  </div>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    {example.description}
                  </p>
                </button>
              ))}
            </div>
          </div>

          {/* System Status */}
          {insights && (
            <div className="mb-8">
              <h2 className="text-2xl font-semibold text-foreground mb-6">System Status</h2>
              <div className={`p-6 rounded-lg border ${
                insights.status === 'good' 
                  ? 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800'
                  : insights.status === 'warning'
                  ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
                  : 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800'
              }`}>
                <div className="flex items-center space-x-3 mb-4">
                  <div className={`w-3 h-3 rounded-full ${
                    insights.status === 'good' ? 'bg-green-500' : insights.status === 'warning' ? 'bg-yellow-500' : 'bg-red-500'
                  }`} />
                  <h3 className="font-medium text-foreground">{insights.message}</h3>
                </div>
                
                {insights.details.length > 0 && (
                  <ul className="space-y-1">
                    {insights.details.map((detail, index) => (
                      <li key={index} className="text-sm text-gray-600 dark:text-gray-400">
                        • {detail}
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          )}
        </main>
    </div>
    </ErrorBoundary>
  );
}
