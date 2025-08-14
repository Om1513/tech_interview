'use client';

import { useState, useEffect } from 'react';

interface ImportProgress {
  fileName: string;
  totalFiles: number;
  currentFile: number;
  recordsProcessed: number;
  recordsImported: number;
  errors: number;
  status: 'running' | 'completed' | 'failed' | 'paused';
  startTime: Date;
  estimatedCompletion?: Date;
  errorMessage?: string;
}

interface ImportStatus {
  isRunning: boolean;
  progress: ImportProgress | null;
  message: string;
}

interface DatabaseStats {
  inspections: number;
  defects: number;
  importLogs: number;
  lastImport: any;
}

export default function ImportManager() {
  const [importStatus, setImportStatus] = useState<ImportStatus | null>(null);
  const [dbStats, setDbStats] = useState<DatabaseStats | null>(null);
  const [importHistory, setImportHistory] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Polling interval for status updates
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    const pollStatus = async () => {
      try {
        const response = await fetch('/api/import?action=status');
        if (response.ok) {
          const status = await response.json();
          setImportStatus(status);
        }
      } catch (err) {
        console.error('Failed to poll import status:', err);
      }
    };
    
    // Poll every 2 seconds when import is running
    if (importStatus?.isRunning) {
      interval = setInterval(pollStatus, 2000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [importStatus?.isRunning]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      // Load import status
      const statusRes = await fetch('/api/import?action=status');
      if (statusRes.ok) {
        const status = await statusRes.json();
        setImportStatus(status);
      }

      // Load database stats
      const statsRes = await fetch('/api/import?action=stats');
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setDbStats(statsData.stats);
      }

      // Load import history
      const historyRes = await fetch('/api/import?action=history&limit=5');
      if (historyRes.ok) {
        const historyData = await historyRes.json();
        setImportHistory(historyData.history);
      }

    } catch (err) {
      setError('Failed to load import data');
      console.error('Failed to load data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const startImport = async (fileName?: string) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch('/api/import?action=start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fileName: fileName || undefined,
          batchSize: 100,
          validateData: true,
          skipDuplicates: true,
        }),
      });

      if (response.ok) {
        const result = await response.json();
        setImportStatus(result);
        // Reload data after starting
        setTimeout(() => loadData(), 1000);
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to start import');
      }
    } catch (err) {
      setError('Failed to start import');
      console.error('Failed to start import:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const stopImport = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/import?action=stop', {
        method: 'POST',
      });

      if (response.ok) {
        loadData();
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to stop import');
      }
    } catch (err) {
      setError('Failed to stop import');
      console.error('Failed to stop import:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const validateData = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/import?action=validate', {
        method: 'POST',
      });

      if (response.ok) {
        const result = await response.json();
        if (result.validation.isValid) {
          alert('✅ Data validation passed - no issues found');
        } else {
          alert(`❌ Data validation found issues:\n${result.validation.errors.join('\n')}`);
        }
      }
    } catch (err) {
      setError('Failed to validate data');
      console.error('Failed to validate data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed': return '✅';
      case 'failed': return '❌';
      case 'running': return '🔄';
      default: return '⏸️';
    }
  };

  const calculateProgress = (progress: ImportProgress | null) => {
    if (!progress || progress.recordsProcessed === 0) return 0;
    return Math.round((progress.recordsImported / progress.recordsProcessed) * 100);
  };

  return (
    <div className="bg-white dark:bg-gray-900 rounded-lg shadow-md p-6">
      <h2 className="text-2xl font-semibold mb-6 text-foreground">Database Import Manager</h2>

      {error && (
        <div className="bg-red-50 dark:bg-red-900/20 p-4 rounded-lg border border-red-200 dark:border-red-800 mb-6">
          <p className="text-red-600 dark:text-red-300">{error}</p>
          <button
            onClick={() => setError(null)}
            className="mt-2 text-red-500 hover:text-red-700 text-sm"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Import Status */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-foreground">Import Status</h3>
        <div className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
          {importStatus?.isRunning ? (
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-green-600 dark:text-green-400 font-medium">🔄 Import Running</span>
                <button
                  onClick={stopImport}
                  disabled={isLoading}
                  className="px-3 py-1 bg-red-600 text-white rounded hover:bg-red-700 disabled:opacity-50"
                >
                  Stop Import
                </button>
              </div>
              
              {importStatus.progress && (
                <div>
                  <div className="flex justify-between text-sm mb-2">
                    <span>File: {importStatus.progress.fileName}</span>
                    <span>{importStatus.progress.currentFile}/{importStatus.progress.totalFiles}</span>
                  </div>
                  
                  <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2 mb-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${calculateProgress(importStatus.progress)}%` }}
                    ></div>
                  </div>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Processed:</span>
                      <span className="ml-1 font-medium">{importStatus.progress.recordsProcessed.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Imported:</span>
                      <span className="ml-1 font-medium text-green-600">{importStatus.progress.recordsImported.toLocaleString()}</span>
                    </div>
                    <div>
                      <span className="text-gray-600 dark:text-gray-400">Errors:</span>
                      <span className="ml-1 font-medium text-red-600">{importStatus.progress.errors.toLocaleString()}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div>
              <span className="text-gray-600 dark:text-gray-400">No import currently running</span>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => startImport()}
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                >
                  Import All Files
                </button>
                <button
                  onClick={() => startImport('sewer-inspections-part1.jsonl')}
                  disabled={isLoading}
                  className="px-4 py-2 bg-green-600 text-white rounded hover:bg-green-700 disabled:opacity-50"
                >
                  Import Single File
                </button>
                <button
                  onClick={validateData}
                  disabled={isLoading}
                  className="px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700 disabled:opacity-50"
                >
                  Validate Data
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Database Statistics */}
      <div className="mb-8">
        <h3 className="text-lg font-medium mb-4 text-foreground">Database Statistics</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-blue-600 dark:text-blue-400">
              {dbStats?.inspections.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-blue-600 dark:text-blue-400">Inspections</div>
          </div>
          <div className="bg-green-50 dark:bg-green-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-green-600 dark:text-green-400">
              {dbStats?.defects.toLocaleString() || '0'}
            </div>
            <div className="text-sm text-green-600 dark:text-green-400">Defects</div>
          </div>
          <div className="bg-purple-50 dark:bg-purple-900/20 p-4 rounded-lg">
            <div className="text-2xl font-bold text-purple-600 dark:text-purple-400">
              {dbStats?.importLogs || '0'}
            </div>
            <div className="text-sm text-purple-600 dark:text-purple-400">Import Logs</div>
          </div>
        </div>
      </div>

      {/* Import History */}
      <div>
        <h3 className="text-lg font-medium mb-4 text-foreground">Recent Import History</h3>
        <div className="space-y-3">
          {importHistory.length > 0 ? (
            importHistory.map((entry, index) => (
              <div key={entry.id} className="bg-gray-50 dark:bg-gray-800 p-4 rounded-lg">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <span className="text-lg">{getStatusIcon(entry.status)}</span>
                    <div>
                      <div className="font-medium text-foreground">{entry.source_file}</div>
                      <div className="text-sm text-gray-600 dark:text-gray-400">
                        Started: {formatDate(entry.started_at)}
                      </div>
                    </div>
                  </div>
                  <div className="text-right text-sm">
                    <div className="text-foreground">
                      {entry.records_imported.toLocaleString()}/{entry.records_processed.toLocaleString()} records
                    </div>
                    {entry.errors > 0 && (
                      <div className="text-red-600">{entry.errors} errors</div>
                    )}
                  </div>
                </div>
                {entry.error_message && (
                  <div className="mt-2 text-sm text-red-600 dark:text-red-400">
                    Error: {entry.error_message}
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-gray-600 dark:text-gray-400 text-center py-4">
              No import history available
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
