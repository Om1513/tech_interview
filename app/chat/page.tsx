'use client';

import ChatInterface from '@/components/ChatInterface';

export default function ChatPage() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 flex flex-col">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">GPT-5 Data Analyst</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Ask questions about sewer inspection data and get GPT-5 powered insights
              </p>
            </div>
            
            <nav className="flex gap-4">
              <a
                href="/search"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                         font-medium transition-colors duration-200"
              >
                Search Data
              </a>
              <a
                href="/"
                className="text-blue-600 hover:text-blue-800 dark:text-blue-400 dark:hover:text-blue-300 
                         font-medium transition-colors duration-200"
              >
                ← Back to Home
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Chat Area */}
      <main className="flex-1 p-4 sm:p-6 lg:p-8">
        <div className="h-full max-w-6xl mx-auto">
          <div className="bg-white dark:bg-gray-900 rounded-lg shadow-lg h-full flex flex-col">
            {/* Chat Interface */}
            <div className="flex-1 p-6">
              <ChatInterface />
            </div>
          </div>
        </div>
      </main>

      {/* Footer with tips */}
      <footer className="bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="max-w-6xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="text-center">
              <h4 className="font-medium text-foreground mb-1">💡 Statistical Queries</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Ask for averages, totals, or comparisons across the data
              </p>
            </div>
            <div className="text-center">
              <h4 className="font-medium text-foreground mb-1">🔍 Specific Searches</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Filter by location, material, score, or repair status
              </p>
            </div>
            <div className="text-center">
              <h4 className="font-medium text-foreground mb-1">📊 Data Analysis</h4>
              <p className="text-gray-600 dark:text-gray-400">
                Get insights about patterns, trends, and problem areas
              </p>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
