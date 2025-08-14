'use client';

import { useState, useEffect } from 'react';
import { SearchFilters } from '@/lib/types';

interface SearchFormProps {
  onSearch: (filters: SearchFilters) => void;
  loading: boolean;
}

export default function SearchForm({ onSearch, loading }: SearchFormProps) {
  const [filters, setFilters] = useState<SearchFilters>({
    city: '',
    state: '',
    material: '',
    scoreMin: 0,
    scoreMax: 100,
    requiresRepair: undefined,
    limit: 100
  });

  const [searchOptions, setSearchOptions] = useState<{
    cities: string[];
    states: string[];
  }>({ cities: [], states: [] });

  const [hasAutoSearched, setHasAutoSearched] = useState(false);

  // Fetch search options on component mount
  useEffect(() => {
    fetch('/api/search?options=true')
      .then(res => res.json())
      .then(data => setSearchOptions(data))
      .catch(err => console.error('Failed to fetch search options:', err));
  }, []);

  // Check URL parameters and auto-fill form (only once)
  useEffect(() => {
    if (typeof window !== 'undefined' && !hasAutoSearched) {
      const urlParams = new URLSearchParams(window.location.search);
      
      // Only process if there are actual search parameters
      if (urlParams.toString()) {
        const urlFilters: SearchFilters = {
          city: urlParams.get('city') || '',
          state: urlParams.get('state') || '',
          material: urlParams.get('material') || '',
          scoreMin: urlParams.get('minScore') ? Number(urlParams.get('minScore')) : 0,
          scoreMax: urlParams.get('maxScore') ? Number(urlParams.get('maxScore')) : 100,
          requiresRepair: urlParams.get('needsRepair') === 'true' ? true : 
                         urlParams.get('needsRepair') === 'false' ? false : undefined,
          limit: Number(urlParams.get('limit')) || 100
        };
        
        setFilters(urlFilters);
        setHasAutoSearched(true);
        
        // Auto-trigger search after a short delay
        const timeoutId = setTimeout(() => {
          onSearch(urlFilters);
          // Clear URL parameters after search
          window.history.replaceState({}, '', window.location.pathname);
        }, 500);

        return () => clearTimeout(timeoutId);
      }
    }
  }, [hasAutoSearched, onSearch]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Clean up filters - remove empty strings
    const cleanFilters: SearchFilters = {
      ...filters,
      city: filters.city?.trim() || undefined,
      state: filters.state?.trim() || undefined,
      material: filters.material?.trim() || undefined,
    };
    
    onSearch(cleanFilters);
  };

  const handleReset = () => {
    const resetFilters: SearchFilters = {
      city: '',
      state: '',
      material: '',
      scoreMin: 0,
      scoreMax: 100,
      requiresRepair: undefined,
      limit: 100
    };
    setFilters(resetFilters);
  };

  return (
    <form onSubmit={handleSubmit} className="bg-white dark:bg-gray-900 p-6 rounded-lg shadow-md">
      <h2 className="text-2xl font-semibold mb-6 text-foreground">Search Sewer Inspections</h2>
      
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* City Filter */}
        <div>
          <label htmlFor="city" className="block text-sm font-medium text-foreground mb-2">
            City
          </label>
          <input
            type="text"
            id="city"
            value={filters.city || ''}
            onChange={(e) => setFilters({ ...filters, city: e.target.value })}
            placeholder="Enter city name"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-background text-foreground placeholder-gray-500 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* State Filter */}
        <div>
          <label htmlFor="state" className="block text-sm font-medium text-foreground mb-2">
            State
          </label>
          <select
            id="state"
            value={filters.state || ''}
            onChange={(e) => setFilters({ ...filters, state: e.target.value })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-background text-foreground 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All States</option>
            {searchOptions.states.map(state => (
              <option key={state} value={state}>{state}</option>
            ))}
          </select>
        </div>

        {/* Material Filter */}
        <div>
          <label htmlFor="material" className="block text-sm font-medium text-foreground mb-2">
            Pipe Material
          </label>
          <input
            type="text"
            id="material"
            value={filters.material || ''}
            onChange={(e) => setFilters({ ...filters, material: e.target.value })}
            placeholder="e.g. VCP, PVC, DIP"
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-background text-foreground placeholder-gray-500 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
        </div>

        {/* Needs Repair Filter */}
        <div>
          <label htmlFor="needsRepair" className="block text-sm font-medium text-foreground mb-2">
            Repair Status
          </label>
          <select
            id="needsRepair"
            value={filters.requiresRepair === undefined ? '' : filters.requiresRepair.toString()}
            onChange={(e) => setFilters({ 
              ...filters, 
              requiresRepair: e.target.value === '' ? undefined : e.target.value === 'true'
            })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-background text-foreground 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="">All</option>
            <option value="true">Needs Repair</option>
            <option value="false">No Repair Needed</option>
          </select>
        </div>

        {/* Score Range */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-foreground mb-2">
            Inspection Score Range: {filters.scoreMin} - {filters.scoreMax}
          </label>
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <label htmlFor="minScore" className="text-xs text-gray-600 dark:text-gray-400">Min</label>
              <input
                type="range"
                id="minScore"
                min="0"
                max="100"
                value={filters.scoreMin || 0}
                onChange={(e) => setFilters({ ...filters, scoreMin: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
            </div>
            <div className="flex-1">
              <label htmlFor="maxScore" className="text-xs text-gray-600 dark:text-gray-400">Max</label>
              <input
                type="range"
                id="maxScore"
                min="0"
                max="100"
                value={filters.scoreMax || 100}
                onChange={(e) => setFilters({ ...filters, scoreMax: Number(e.target.value) })}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer dark:bg-gray-700"
              />
            </div>
          </div>
        </div>

        {/* Limit */}
        <div>
          <label htmlFor="limit" className="block text-sm font-medium text-foreground mb-2">
            Max Results
          </label>
          <select
            id="limit"
            value={filters.limit || 100}
            onChange={(e) => setFilters({ ...filters, limit: Number(e.target.value) })}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-md 
                     bg-background text-foreground 
                     focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value={10}>10</option>
            <option value={25}>25</option>
            <option value={50}>50</option>
            <option value={100}>100</option>
          </select>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="flex gap-4 mt-6">
        <button
          type="submit"
          disabled={loading}
          className="px-6 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
        
        <button
          type="button"
          onClick={handleReset}
          disabled={loading}
          className="px-6 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 
                   focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
        >
          Reset
        </button>
      </div>
    </form>
  );
}
