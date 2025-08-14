import { ContextStrategy, QueryResult, AIContextData } from './types';

// Token budget configuration
const MAX_CONTEXT_TOKENS = 6000; // Conservative limit for GPT context
const TOKENS_PER_RECORD = 120; // Estimated tokens per inspection record
const BASE_CONTEXT_TOKENS = 500; // System prompt and metadata

/**
 * Build intelligent context for AI based on query results and user intent
 */
export function buildIntelligentContext(
  queryResults: QueryResult[],
  userPrompt: string,
  strategy: ContextStrategy
): AIContextData {
  
  console.log(`Building intelligent context with strategy: ${strategy}`);
  console.log(`Query results: ${queryResults.length} result sets`);
  
  // Calculate available tokens for data
  const availableTokens = MAX_CONTEXT_TOKENS - BASE_CONTEXT_TOKENS;
  const maxRecords = Math.floor(availableTokens / TOKENS_PER_RECORD);
  
  switch (strategy) {
    case 'statistical':
      return buildStatisticalContext(queryResults, userPrompt, maxRecords);
      
    case 'comparative':
      return buildComparativeContext(queryResults, userPrompt, maxRecords);
      
    case 'temporal':
      return buildTemporalContext(queryResults, userPrompt, maxRecords);
      
    case 'detailed':
    default:
      return buildDetailedContext(queryResults, userPrompt, maxRecords);
  }
}

/**
 * Determine the optimal context strategy based on the user prompt
 */
export function determineContextStrategy(prompt: string): ContextStrategy {
  const lowerPrompt = prompt.toLowerCase();
  
  // Statistical keywords
  if (lowerPrompt.includes('average') || lowerPrompt.includes('mean') || 
      lowerPrompt.includes('total') || lowerPrompt.includes('count') ||
      lowerPrompt.includes('sum') || lowerPrompt.includes('percentage') ||
      lowerPrompt.includes('rate') || lowerPrompt.includes('how many')) {
    return 'statistical';
  }
  
  // Comparative keywords
  if (lowerPrompt.includes('compare') || lowerPrompt.includes('vs') || 
      lowerPrompt.includes('difference') || lowerPrompt.includes('between') ||
      lowerPrompt.includes('which') || lowerPrompt.includes('best') ||
      lowerPrompt.includes('worst') || lowerPrompt.includes('most') ||
      lowerPrompt.includes('least')) {
    return 'comparative';
  }
  
  // Temporal keywords
  if (lowerPrompt.includes('trend') || lowerPrompt.includes('over time') || 
      lowerPrompt.includes('year') || lowerPrompt.includes('month') ||
      lowerPrompt.includes('recent') || lowerPrompt.includes('latest') ||
      lowerPrompt.includes('historical') || lowerPrompt.includes('since')) {
    return 'temporal';
  }
  
  // Default to detailed for specific investigative queries
  return 'detailed';
}

/**
 * Aggregate data for AI consumption based on aggregation type
 */
export function aggregateDataForAI(
  results: any[], 
  aggregationType: string
): any {
  
  if (results.length === 0) return {};
  
  switch (aggregationType) {
    case 'material_analysis':
      return aggregateMaterialData(results);
      
    case 'geographic_analysis':
      return aggregateGeographicData(results);
      
    case 'score_analysis':
      return aggregateScoreData(results);
      
    case 'defect_analysis':
      return aggregateDefectData(results);
      
    default:
      return results;
  }
}

/**
 * Build context optimized for statistical queries
 */
function buildStatisticalContext(
  queryResults: QueryResult[],
  userPrompt: string,
  maxRecords: number
): AIContextData {
  
  console.log('Building statistical context');
  
  // For statistical queries, focus on aggregated data and summary metrics
  const aggregatedData: any = {};
  const summaryMetrics: any = {};
  
  queryResults.forEach((result, index) => {
    // Extract aggregations from metadata
    if (result.metadata.aggregations) {
      aggregatedData[`query_${index}`] = result.metadata.aggregations;
    }
    
    // Summarize the data
    if (result.data.length > 0) {
      summaryMetrics[`query_${index}`] = {
        rowCount: result.metadata.rowCount,
        columns: result.metadata.columns,
        sampleData: result.data.slice(0, 3), // Just a few samples
        executionTime: result.executionTime
      };
    }
  });
  
  return {
    inspections: [], // No raw inspections for statistical queries
    summary: {
      totalRecords: queryResults.reduce((sum, r) => sum + r.metadata.rowCount, 0),
      scoreRange: { min: 0, max: 100, average: 0 }, // Will be populated from aggregations
      commonMaterials: [],
      repairNeeded: 0,
      cities: [],
      aggregatedResults: aggregatedData,
      summaryMetrics,
      queryCount: queryResults.length,
      contextStrategy: 'statistical'
    }
  };
}

/**
 * Build context optimized for comparative analysis
 */
function buildComparativeContext(
  queryResults: QueryResult[],
  userPrompt: string,
  maxRecords: number
): AIContextData {
  
  console.log('Building comparative context');
  
  const comparativeData: any[] = [];
  const categoryBreakdowns: any = {};
  
  queryResults.forEach((result, index) => {
    if (result.data.length > 0) {
      // For comparative queries, organize data by categories
      const categorized = categorizeResults(result.data);
      categoryBreakdowns[`comparison_${index}`] = categorized;
      
      // Include top N results for each category
      comparativeData.push(...result.data.slice(0, Math.min(10, maxRecords / queryResults.length)));
    }
  });
  
  return {
    inspections: comparativeData.slice(0, maxRecords),
    summary: {
      totalRecords: queryResults.reduce((sum, r) => sum + r.metadata.rowCount, 0),
      scoreRange: calculateScoreRange(comparativeData),
      commonMaterials: extractUniqueValues(comparativeData, 'material'),
      repairNeeded: countRepairsNeeded(comparativeData),
      cities: extractUniqueValues(comparativeData, 'city'),
      categoryBreakdowns,
      contextStrategy: 'comparative'
    }
  };
}

/**
 * Build context optimized for temporal analysis
 */
function buildTemporalContext(
  queryResults: QueryResult[],
  userPrompt: string,
  maxRecords: number
): AIContextData {
  
  console.log('Building temporal context');
  
  const timeSeriesData: any[] = [];
  const timePatterns: any = {};
  
  queryResults.forEach((result, index) => {
    if (result.data.length > 0) {
      // Sort by timestamp for temporal analysis
      const sortedData = result.data.sort((a, b) => {
        const dateA = new Date(a.timestamp_utc || a.date || '');
        const dateB = new Date(b.timestamp_utc || b.date || '');
        return dateA.getTime() - dateB.getTime();
      });
      
      timeSeriesData.push(...sortedData.slice(0, maxRecords / queryResults.length));
      
      // Extract time patterns
      timePatterns[`series_${index}`] = analyzeTimePatterns(sortedData);
    }
  });
  
  return {
    inspections: timeSeriesData.slice(0, maxRecords),
    summary: {
      totalRecords: queryResults.reduce((sum, r) => sum + r.metadata.rowCount, 0),
      scoreRange: calculateScoreRange(timeSeriesData),
      commonMaterials: extractUniqueValues(timeSeriesData, 'material'),
      repairNeeded: countRepairsNeeded(timeSeriesData),
      cities: extractUniqueValues(timeSeriesData, 'city'),
      timePatterns,
      contextStrategy: 'temporal'
    }
  };
}

/**
 * Build context optimized for detailed analysis
 */
function buildDetailedContext(
  queryResults: QueryResult[],
  userPrompt: string,
  maxRecords: number
): AIContextData {
  
  console.log('Building detailed context');
  
  const detailedData: any[] = [];
  const detailMetrics: any = {};
  
  queryResults.forEach((result, index) => {
    if (result.data.length > 0) {
      // Include more detailed records for investigation
      const recordsPerQuery = Math.floor(maxRecords / queryResults.length);
      detailedData.push(...result.data.slice(0, recordsPerQuery));
      
      // Capture detailed metrics
      detailMetrics[`detail_${index}`] = {
        totalRecords: result.metadata.rowCount,
        includedRecords: Math.min(recordsPerQuery, result.data.length),
        columns: result.metadata.columns,
        executionTime: result.executionTime
      };
    }
  });
  
  return {
    inspections: detailedData.slice(0, maxRecords),
    summary: {
      totalRecords: queryResults.reduce((sum, r) => sum + r.metadata.rowCount, 0),
      scoreRange: calculateScoreRange(detailedData),
      commonMaterials: extractUniqueValues(detailedData, 'material'),
      repairNeeded: countRepairsNeeded(detailedData),
      cities: extractUniqueValues(detailedData, 'city'),
      detailMetrics,
      contextStrategy: 'detailed'
    }
  };
}

/**
 * Categorize results for comparative analysis
 */
function categorizeResults(data: any[]): any {
  const categories: any = {};
  
  data.forEach(record => {
    // Categorize by material
    const material = record.material || 'Unknown';
    if (!categories[material]) {
      categories[material] = {
        count: 0,
        totalScore: 0,
        repairNeeded: 0,
        records: []
      };
    }
    
    categories[material].count++;
    categories[material].totalScore += record.inspection_score || 0;
    categories[material].repairNeeded += record.requires_repair || 0;
    categories[material].records.push(record);
  });
  
  // Calculate averages
  Object.values(categories).forEach((cat: any) => {
    cat.averageScore = Math.round(cat.totalScore / cat.count);
    cat.repairRate = Math.round((cat.repairNeeded / cat.count) * 100);
  });
  
  return categories;
}

/**
 * Analyze temporal patterns in data
 */
function analyzeTimePatterns(data: any[]): any {
  if (data.length === 0) return {};
  
  const patterns: any = {
    totalDataPoints: data.length,
    dateRange: {
      earliest: data[0]?.timestamp_utc || '',
      latest: data[data.length - 1]?.timestamp_utc || ''
    },
    trends: {}
  };
  
  // Simple trend analysis
  if (data.length > 1) {
    const firstScore = data[0]?.inspection_score || 0;
    const lastScore = data[data.length - 1]?.inspection_score || 0;
    patterns.trends.scoreDirection = lastScore > firstScore ? 'improving' : 'declining';
  }
  
  return patterns;
}

/**
 * Calculate score range from data
 */
function calculateScoreRange(data: any[]): { min: number; max: number; average: number } {
  if (data.length === 0) return { min: 0, max: 0, average: 0 };
  
  const scores = data.map(d => d.inspection_score || 0).filter(s => s > 0);
  if (scores.length === 0) return { min: 0, max: 0, average: 0 };
  
  return {
    min: Math.min(...scores),
    max: Math.max(...scores),
    average: Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
  };
}

/**
 * Extract unique values for a field
 */
function extractUniqueValues(data: any[], field: string): string[] {
  return [...new Set(data.map(d => d[field]).filter(Boolean))].slice(0, 10);
}

/**
 * Count records needing repair
 */
function countRepairsNeeded(data: any[]): number {
  return data.filter(d => d.requires_repair === 1 || d.requires_repair === true).length;
}

/**
 * Aggregate material analysis data
 */
function aggregateMaterialData(results: any[]): any {
  const materialStats: any = {};
  
  results.forEach(record => {
    const material = record.material || 'Unknown';
    if (!materialStats[material]) {
      materialStats[material] = {
        count: 0,
        totalScore: 0,
        defectCount: 0,
        repairCount: 0
      };
    }
    
    materialStats[material].count++;
    materialStats[material].totalScore += record.inspection_score || 0;
    materialStats[material].defectCount += record.defect_count || 0;
    materialStats[material].repairCount += record.requires_repair ? 1 : 0;
  });
  
  // Calculate derived metrics
  Object.entries(materialStats).forEach(([material, stats]: [string, any]) => {
    stats.averageScore = Math.round(stats.totalScore / stats.count);
    stats.defectRate = Math.round((stats.defectCount / stats.count) * 100) / 100;
    stats.repairRate = Math.round((stats.repairCount / stats.count) * 100);
  });
  
  return materialStats;
}

/**
 * Aggregate geographic analysis data
 */
function aggregateGeographicData(results: any[]): any {
  const geoStats: any = {};
  
  results.forEach(record => {
    const city = record.city || 'Unknown';
    if (!geoStats[city]) {
      geoStats[city] = {
        count: 0,
        totalScore: 0,
        repairCount: 0,
        materials: new Set()
      };
    }
    
    geoStats[city].count++;
    geoStats[city].totalScore += record.inspection_score || 0;
    geoStats[city].repairCount += record.requires_repair ? 1 : 0;
    if (record.material) geoStats[city].materials.add(record.material);
  });
  
  // Convert sets to arrays and calculate averages
  Object.entries(geoStats).forEach(([city, stats]: [string, any]) => {
    stats.averageScore = Math.round(stats.totalScore / stats.count);
    stats.repairRate = Math.round((stats.repairCount / stats.count) * 100);
    stats.materials = Array.from(stats.materials);
  });
  
  return geoStats;
}

/**
 * Aggregate score analysis data
 */
function aggregateScoreData(results: any[]): any {
  const scoreRanges = {
    'Poor (0-30)': 0,
    'Fair (31-60)': 0,
    'Good (61-80)': 0,
    'Excellent (81-100)': 0
  };
  
  results.forEach(record => {
    const score = record.inspection_score || 0;
    if (score <= 30) scoreRanges['Poor (0-30)']++;
    else if (score <= 60) scoreRanges['Fair (31-60)']++;
    else if (score <= 80) scoreRanges['Good (61-80)']++;
    else scoreRanges['Excellent (81-100)']++;
  });
  
  return scoreRanges;
}

/**
 * Aggregate defect analysis data
 */
function aggregateDefectData(results: any[]): any {
  const defectStats = {
    totalDefects: 0,
    severityDistribution: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
    commonCodes: {} as any
  };
  
  results.forEach(record => {
    if (record.defects) {
      defectStats.totalDefects += record.defects.length || 0;
    }
    if (record.severity) {
      defectStats.severityDistribution[record.severity]++;
    }
    if (record.code) {
      defectStats.commonCodes[record.code] = (defectStats.commonCodes[record.code] || 0) + 1;
    }
  });
  
  return defectStats;
}
