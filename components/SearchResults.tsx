'use client';

import { SewerInspection } from '@/lib/types';

interface SearchResultsProps {
  results: SewerInspection[];
  loading: boolean;
  error?: string;
  count?: number;
}

export default function SearchResults({ results, loading, error, count }: SearchResultsProps) {
  if (loading) {
    return (
      <div className="bg-white dark:bg-gray-900 p-8 rounded-lg shadow-md">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-foreground">Searching inspections...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-red-50 dark:bg-red-900/20 p-6 rounded-lg border border-red-200 dark:border-red-800">
        <h3 className="text-lg font-medium text-red-800 dark:text-red-200 mb-2">Search Error</h3>
        <p className="text-red-600 dark:text-red-300">{error}</p>
      </div>
    );
  }

  if (results.length === 0) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 p-8 rounded-lg text-center">
        <h3 className="text-lg font-medium text-foreground mb-2">No Results Found</h3>
        <p className="text-gray-600 dark:text-gray-400">
          Try adjusting your search filters to find more inspections.
        </p>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md">
      {/* Results Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h3 className="text-lg font-semibold text-foreground">
          Search Results {count && `(${count} found)`}
        </h3>
      </div>

      {/* Mobile Card Layout */}
      <div className="md:hidden">
        {results.map((inspection) => (
          <InspectionCard key={inspection.id} inspection={inspection} />
        ))}
      </div>

      {/* Desktop Table Layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-gray-800">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Inspection
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Location
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Pipe Details
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Score
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {results.map((inspection) => (
              <InspectionRow key={inspection.id} inspection={inspection} />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function InspectionCard({ inspection }: { inspection: SewerInspection }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <div className="p-6 border-b border-gray-200 dark:border-gray-700 last:border-b-0">
      <div className="flex justify-between items-start mb-3">
        <h4 className="font-medium text-foreground">{inspection.id}</h4>
        <StatusBadge 
          score={inspection.inspection_score} 
          needsRepair={inspection.requires_repair} 
        />
      </div>
      
      <div className="space-y-2 text-sm">
        <div>
          <span className="text-gray-600 dark:text-gray-400">Date:</span>{' '}
          <span className="text-foreground">{formatDate(inspection.timestamp_utc)}</span>
        </div>
        
        <div>
          <span className="text-gray-600 dark:text-gray-400">Location:</span>{' '}
          <span className="text-foreground">
            {inspection.location?.city}, {inspection.location?.state}
          </span>
        </div>
        
        <div>
          <span className="text-gray-600 dark:text-gray-400">Pipe:</span>{' '}
          <span className="text-foreground">
            {inspection.pipe?.material} - {inspection.pipe?.diameter_in}"
          </span>
        </div>
        
        <div>
          <span className="text-gray-600 dark:text-gray-400">Defects:</span>{' '}
          <span className="text-foreground">{inspection.defects?.length || 0}</span>
        </div>
        
        <div>
          <span className="text-gray-600 dark:text-gray-400">Score:</span>{' '}
          <span className="font-medium text-foreground">{inspection.inspection_score}/100</span>
        </div>
      </div>
    </div>
  );
}

function InspectionRow({ inspection }: { inspection: SewerInspection }) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors">
      <td className="px-6 py-4 whitespace-nowrap">
        <div>
          <div className="text-sm font-medium text-foreground">{inspection.id}</div>
          <div className="text-sm text-gray-500 dark:text-gray-400">
            {formatDate(inspection.timestamp_utc)}
          </div>
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-foreground">
          {inspection.location?.city}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {inspection.location?.state}
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm text-foreground">
          {inspection.pipe?.material}
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {inspection.pipe?.diameter_in}" • {inspection.pipe?.age_years}y
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <div className="text-sm font-medium text-foreground">
          {inspection.inspection_score}/100
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {inspection.defects?.length || 0} defects
        </div>
      </td>
      
      <td className="px-6 py-4 whitespace-nowrap">
        <StatusBadge 
          score={inspection.inspection_score} 
          needsRepair={inspection.requires_repair} 
        />
      </td>
    </tr>
  );
}

function StatusBadge({ score, needsRepair }: { score: number; needsRepair: boolean }) {
  const getStatusColor = () => {
    if (needsRepair) return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
    if (score >= 90) return 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-300';
    if (score >= 70) return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-300';
    return 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-300';
  };

  const getStatusText = () => {
    if (needsRepair) return 'Needs Repair';
    if (score >= 90) return 'Excellent';
    if (score >= 70) return 'Good';
    return 'Poor';
  };

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor()}`}>
      {getStatusText()}
    </span>
  );
}
