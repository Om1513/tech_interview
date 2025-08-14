'use client';

import { useState } from 'react';
import SearchForm from '@/components/SearchForm';
import SearchResults from '@/components/SearchResults';
import { SewerInspection, SearchFilters } from '@/lib/types';

interface SearchResponse {
  results: SewerInspection[];
  count: number;
  filters: SearchFilters;
  error?: string;
}

export default function SearchPage() {
  const [searchResults, setSearchResults] = useState<SewerInspection[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hasSearched, setHasSearched] = useState(false);
  const [resultCount, setResultCount] = useState<number>(0);

  const handleSearch = async (filters: SearchFilters) => {
    setLoading(true);
    setError(undefined);
    setHasSearched(true);

    try {
      // Build query string from filters
      const params = new URLSearchParams();
      
      if (filters.city) params.set('city', filters.city);
      if (filters.state) params.set('state', filters.state);
      if (filters.material) params.set('material', filters.material);
      if (filters.scoreMin !== undefined) params.set('minScore', filters.scoreMin.toString());
      if (filters.scoreMax !== undefined) params.set('maxScore', filters.scoreMax.toString());
      if (filters.requiresRepair !== undefined) params.set('needsRepair', filters.requiresRepair.toString());
      if (filters.limit) params.set('limit', filters.limit.toString());

      console.log('Searching with params:', params.toString());

      const response = await fetch(`/api/search?${params.toString()}`);
      
      if (!response.ok) {
        throw new Error(`Search failed: ${response.status} ${response.statusText}`);
      }

      const data: SearchResponse = await response.json();
      
      if (data.error) {
        throw new Error(data.error);
      }

      setSearchResults(data.results);
      setResultCount(data.count);
      console.log(`Search completed: ${data.count} results found`);

    } catch (err) {
      console.error('Search error:', err);
      setError(err instanceof Error ? err.message : 'Search failed');
      setSearchResults([]);
      setResultCount(0);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold text-foreground">Sewer Inspection Search</h1>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Search and filter sewer inspection records
              </p>
            </div>
            
            <nav>
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

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-8">
          {/* Search Form */}
          <SearchForm onSearch={handleSearch} loading={loading} />

          {/* Search Results */}
          {hasSearched && (
            <SearchResults 
              results={searchResults}
              loading={loading}
              error={error}
              count={resultCount}
            />
          )}

          {/* Initial State - Show before first search */}
          {!hasSearched && !loading && (
            <div className="bg-white dark:bg-gray-900 p-12 rounded-lg shadow-md text-center">
              <h3 className="text-xl font-medium text-foreground mb-4">
                Welcome to Sewer Inspection Search
              </h3>
              <p className="text-gray-600 dark:text-gray-400 mb-6 max-w-2xl mx-auto">
                Use the search form above to find sewer inspection records. You can filter by city, 
                state, inspection score range, and repair status. Results are limited to 100 records 
                for optimal performance.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-8 max-w-3xl mx-auto">
                <div className="text-center">
                  <div className="bg-blue-100 dark:bg-blue-900/20 w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-6 h-6 text-blue-600 dark:text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-foreground">Filter by Location</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Search by city or state</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-green-100 dark:bg-green-900/20 w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-foreground">Score Range</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Filter by inspection scores</p>
                </div>
                
                <div className="text-center">
                  <div className="bg-red-100 dark:bg-red-900/20 w-12 h-12 rounded-lg mx-auto mb-3 flex items-center justify-center">
                    <svg className="w-6 h-6 text-red-600 dark:text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                    </svg>
                  </div>
                  <h4 className="font-medium text-foreground">Repair Status</h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">Find pipes needing repair</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
