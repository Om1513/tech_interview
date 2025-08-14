'use client';

import Link from 'next/link';
import ImportManager from '@/components/ImportManager';

export default function AdminPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Database Administration</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Manage database imports and monitor system health
              </p>
            </div>
            
            <nav className="flex space-x-4">
              <Link
                href="/search"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                         font-medium transition-colors duration-200"
              >
                Search Data
              </Link>
              <Link
                href="/chat"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                         font-medium transition-colors duration-200"
              >
                AI Chat
              </Link>
              <Link
                href="/"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                         font-medium transition-colors duration-200"
              >
                ← Back to Home
              </Link>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Admin Instructions */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Getting Started</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-foreground mb-2">📥 Data Import</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  Import sewer inspection data from S3 into the local SQLite database for faster searches.
                </p>
                <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
                  <li>• Click "Import All Files" to import from all 5 S3 files</li>
                  <li>• Use "Import Single File" to test with one file first</li>
                  <li>• Monitor progress in real-time</li>
                  <li>• Validate data integrity after import</li>
                </ul>
              </div>
              
              <div>
                <h3 className="font-medium text-foreground mb-2">⚙️ CLI Commands</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm mb-3">
                  Use command-line tools for advanced database management:
                </p>
                <div className="bg-gray-100 dark:bg-gray-800 p-3 rounded text-xs font-mono space-y-1">
                  <div>npm run db:status</div>
                  <div>npm run db:import</div>
                  <div>npm run db:validate</div>
                  <div>npm run db:vacuum</div>
                  <div>npm run db:backup</div>
                </div>
              </div>
            </div>
          </div>

          {/* Import Manager */}
          <ImportManager />

          {/* System Information */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-foreground">System Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="font-medium text-foreground mb-2">🗄️ Database Mode</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  Currently using: <strong>SQLite Database</strong>
                  <br />
                  Location: <code className="bg-gray-100 dark:bg-gray-800 px-1 rounded">./data/inspections.db</code>
                </p>
              </div>
              
              <div>
                <h3 className="font-medium text-foreground mb-2">🚀 Performance</h3>
                <p className="text-gray-600 dark:text-gray-400 text-sm">
                  SQLite searches are <strong>10x faster</strong> than S3 streaming
                  <br />
                  Supports concurrent users and offline access
                </p>
              </div>
            </div>
          </div>

          {/* Environment Variables */}
          <div className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
            <h2 className="text-xl font-semibold mb-4 text-foreground">Configuration</h2>
            <div className="bg-gray-100 dark:bg-gray-800 p-4 rounded text-sm">
              <p className="mb-2 text-foreground font-medium">Environment Variables:</p>
              <div className="space-y-1 font-mono text-xs">
                <div>DATABASE_URL=file:./data/inspections.db</div>
                <div>DATABASE_MODE=sqlite</div>
                <div>NODE_ENV={process.env.NODE_ENV || 'development'}</div>
              </div>
              <p className="mt-3 text-gray-600 dark:text-gray-400 text-xs">
                To switch back to S3-only mode, set DATABASE_MODE=false
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
