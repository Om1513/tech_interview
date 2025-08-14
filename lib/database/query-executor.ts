import { getDatabase } from './config';
import { QueryPlan, QueryResult, QueryMetadata, ContextStrategy } from '../types';
import { validateQuery, optimizeQuery } from '../query-generator';

// Configuration constants
const MAX_QUERY_TIMEOUT = 5000; // 5 seconds
const MAX_RESULT_SIZE = 10 * 1024 * 1024; // 10MB
const MAX_ROWS_PER_QUERY = 10000;
const MAX_QUERIES_PER_REQUEST = 5;

// Query result cache for repeated patterns
const queryCache = new Map<string, { result: QueryResult; timestamp: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Execute a single SQL query safely with validation and performance controls
 */
export async function executeSafeQuery(
  sql: string, 
  params: any[] = [],
  timeoutMs: number = MAX_QUERY_TIMEOUT
): Promise<QueryResult> {
  
  console.log('Executing query:', sql.substring(0, 100) + '...');
  console.log('Parameters:', params);
  
  // Validate query safety
  if (!validateQuery(sql)) {
    throw new Error('Query validation failed - unsafe or invalid SQL');
  }
  
  // Check cache first
  const cacheKey = `${sql}:${JSON.stringify(params)}`;
  const cached = queryCache.get(cacheKey);
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    console.log('Returning cached result');
    return cached.result;
  }
  
  const db = getDatabase();
  const startTime = Date.now();
  
  try {
    // Optimize query for performance
    const optimizedSQL = optimizeQuery(sql);
    
    // Execute query with timeout
    const result = await executeWithTimeout(db, optimizedSQL, params, timeoutMs);
    const executionTime = Date.now() - startTime;
    
    // Validate result size
    const resultSize = JSON.stringify(result).length;
    if (resultSize > MAX_RESULT_SIZE) {
      throw new Error(`Query result too large: ${resultSize} bytes (max: ${MAX_RESULT_SIZE})`);
    }
    
    if (result.length > MAX_ROWS_PER_QUERY) {
      console.warn(`Query returned ${result.length} rows, truncating to ${MAX_ROWS_PER_QUERY}`);
      result.splice(MAX_ROWS_PER_QUERY);
    }
    
    // Build metadata
    const metadata: QueryMetadata = {
      rowCount: result.length,
      columns: result.length > 0 ? Object.keys(result[0]) : [],
      executionTime
    };
    
    // Detect aggregations in results
    if (metadata.columns.some(col => 
      col.includes('count') || col.includes('avg') || col.includes('sum') || 
      col.includes('min') || col.includes('max'))) {
      metadata.aggregations = extractAggregations(result);
    }
    
    const queryResult: QueryResult = {
      data: result,
      metadata,
      executionTime
    };
    
    // Cache successful results
    queryCache.set(cacheKey, { result: queryResult, timestamp: Date.now() });
    
    console.log(`Query executed successfully: ${result.length} rows in ${executionTime}ms`);
    return queryResult;
    
  } catch (error) {
    const executionTime = Date.now() - startTime;
    console.error('Query execution error:', error);
    
    // Return empty result with error metadata
    throw new Error(`Query execution failed after ${executionTime}ms: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Execute multiple queries with dependency management and parallel execution
 */
export async function executeMultipleQueries(queries: QueryPlan[]): Promise<QueryResult[]> {
  console.log(`Executing ${queries.length} queries`);
  
  if (queries.length > MAX_QUERIES_PER_REQUEST) {
    throw new Error(`Too many queries requested: ${queries.length} (max: ${MAX_QUERIES_PER_REQUEST})`);
  }
  
  const results: QueryResult[] = [];
  
  try {
    // For now, execute queries sequentially to handle dependencies
    // TODO: Implement parallel execution for independent queries
    for (let i = 0; i < queries.length; i++) {
      const query = queries[i];
      console.log(`Executing query ${i + 1}/${queries.length}: ${query.purpose}`);
      
      const result = await executeSafeQuery(query.sql, query.params);
      results.push(result);
      
      // Short delay between queries to prevent overwhelming the database
      if (i < queries.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 50));
      }
    }
    
    console.log(`All ${queries.length} queries executed successfully`);
    return results;
    
  } catch (error) {
    console.error('Multi-query execution error:', error);
    throw new Error(`Multi-query execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Optimize query results for AI context based on strategy
 */
export function optimizeResultsForAI(
  results: any[], 
  strategy: ContextStrategy,
  maxTokens: number = 4000
): any {
  
  const estimatedTokens = JSON.stringify(results).length / 4; // Rough token estimation
  
  switch (strategy) {
    case 'statistical':
      return optimizeStatisticalResults(results, maxTokens);
      
    case 'comparative':
      return optimizeComparativeResults(results, maxTokens);
      
    case 'temporal':
      return optimizeTemporalResults(results, maxTokens);
      
    case 'detailed':
    default:
      return optimizeDetailedResults(results, maxTokens);
  }
}

/**
 * Execute query with timeout protection
 */
async function executeWithTimeout(
  db: any, 
  sql: string, 
  params: any[], 
  timeoutMs: number
): Promise<any[]> {
  
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Query timeout after ${timeoutMs}ms`));
    }, timeoutMs);
    
    try {
      const stmt = db.prepare(sql);
      const result = stmt.all(params);
      clearTimeout(timer);
      resolve(result);
    } catch (error) {
      clearTimeout(timer);
      reject(error);
    }
  });
}

/**
 * Extract aggregation values from query results
 */
function extractAggregations(results: any[]): any {
  if (results.length === 0) return {};
  
  const aggregations: any = {};
  const firstRow = results[0];
  
  for (const [key, value] of Object.entries(firstRow)) {
    if (typeof value === 'number' && (
      key.includes('count') || key.includes('avg') || key.includes('sum') ||
      key.includes('min') || key.includes('max') || key.includes('total')
    )) {
      aggregations[key] = value;
    }
  }
  
  return aggregations;
}

/**
 * Optimize results for statistical analysis
 */
function optimizeStatisticalResults(results: any[], maxTokens: number): any {
  // For statistical queries, usually just aggregated data
  if (results.length <= 10) {
    return { type: 'aggregated', data: results };
  }
  
  // If many rows, summarize the key statistics
  const summary = {
    type: 'statistical_summary',
    totalRows: results.length,
    sample: results.slice(0, 5),
    aggregations: extractAggregations(results)
  };
  
  return summary;
}

/**
 * Optimize results for comparative analysis
 */
function optimizeComparativeResults(results: any[], maxTokens: number): any {
  // Group data for comparison, keep top categories
  if (results.length <= 20) {
    return { type: 'comparative', data: results };
  }
  
  // Take top 10 and summarize the rest
  const topResults = results.slice(0, 10);
  const remaining = results.length - 10;
  
  return {
    type: 'comparative_summary',
    topResults,
    remainingCount: remaining,
    totalCategories: results.length
  };
}

/**
 * Optimize results for temporal analysis
 */
function optimizeTemporalResults(results: any[], maxTokens: number): any {
  // Keep time-series data but limit granularity if needed
  return {
    type: 'temporal',
    data: results.slice(0, 100), // Limit to 100 time points
    totalDataPoints: results.length
  };
}

/**
 * Optimize results for detailed analysis
 */
function optimizeDetailedResults(results: any[], maxTokens: number): any {
  // Estimate tokens and truncate if necessary
  const estimatedTokens = JSON.stringify(results).length / 4;
  
  if (estimatedTokens <= maxTokens) {
    return { type: 'detailed', data: results };
  }
  
  // Calculate how many records we can include
  const avgTokensPerRecord = estimatedTokens / results.length;
  const maxRecords = Math.floor(maxTokens / avgTokensPerRecord);
  
  return {
    type: 'detailed_truncated',
    data: results.slice(0, maxRecords),
    totalRecords: results.length,
    shown: maxRecords
  };
}

/**
 * Clear expired cache entries
 */
export function clearExpiredCache(): void {
  const now = Date.now();
  for (const [key, value] of queryCache.entries()) {
    if (now - value.timestamp > CACHE_TTL) {
      queryCache.delete(key);
    }
  }
}

/**
 * Get cache statistics for monitoring
 */
export function getCacheStats(): { size: number; hitRate: number } {
  return {
    size: queryCache.size,
    hitRate: 0 // TODO: Implement hit rate tracking
  };
}

// Clean up cache periodically
setInterval(clearExpiredCache, 60000); // Every minute
