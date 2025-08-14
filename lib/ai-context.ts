import { SewerInspection, SearchFilters } from './types';
import { searchInspections } from './search';

// AI context configuration - optimized for token efficiency
const MAX_CONTEXT_RECORDS = 30; // Reduced to optimize token usage
const FALLBACK_SAMPLE_SIZE = 10; // Smaller sample for general queries
const MAX_PROMPT_TOKENS = 8000; // Conservative limit for GPT-3.5/4
const TOKENS_PER_RECORD = 150; // Estimated tokens per inspection record

export interface AIContextData {
  inspections: SewerInspection[];
  summary: {
    totalRecords: number;
    scoreRange: { min: number; max: number; average: number };
    commonMaterials: string[];
    repairNeeded: number;
    cities: string[];
  };
}

export async function getDataContext(query: string): Promise<AIContextData> {
  console.log('Analyzing query for context:', query);
  
  const filters = analyzeQuery(query);
  console.log('Extracted filters:', filters);
  
  try {
    // Get relevant inspections based on query analysis
    const { results: inspections } = await searchInspections({
      ...filters,
      limit: MAX_CONTEXT_RECORDS
    });
    
    // If no specific results, get a general sample
    if (inspections.length === 0) {
      console.log('No specific matches, getting general sample');
      const { results: fallbackInspections } = await searchInspections({
        limit: FALLBACK_SAMPLE_SIZE
      });
      return buildContextData(fallbackInspections);
    }
    
    return buildContextData(inspections);
    
  } catch (error) {
    console.error('Error getting data context:', error);
    // Return empty context on error
    return {
      inspections: [],
      summary: {
        totalRecords: 0,
        scoreRange: { min: 0, max: 0, average: 0 },
        commonMaterials: [],
        repairNeeded: 0,
        cities: []
      }
    };
  }
}

function analyzeQuery(query: string): SearchFilters {
  const lowerQuery = query.toLowerCase();
  const filters: SearchFilters = {};
  
  // Extract city names (common cities) - match exact words
  const cities = ['houston', 'dallas', 'phoenix', 'los angeles', 'chicago', 'san antonio', 'san diego', 'san jose', 'columbus', 'jacksonville'];
  for (const city of cities) {
    if (lowerQuery.includes(city)) {
      // Capitalize first letter of each word
      filters.city = city.split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
      break;
    }
  }
  
  // Extract state codes/names
  const states = ['tx', 'texas', 'ca', 'california', 'fl', 'florida', 'il', 'illinois', 'az', 'arizona'];
  for (const state of states) {
    if (lowerQuery.includes(state)) {
      filters.state = state.length === 2 ? state.toUpperCase() : state;
      break;
    }
  }
  
  // Extract pipe materials - be more flexible
  const materials = [
    { keywords: ['pvc', 'polyvinyl'], code: 'PVC' },
    { keywords: ['vcp', 'vitrified', 'clay'], code: 'VCP' },
    { keywords: ['dip', 'ductile', 'iron'], code: 'DIP' },
    { keywords: ['pe', 'polyethylene'], code: 'PE' },
    { keywords: ['rcp', 'reinforced', 'concrete'], code: 'RCP' },
    { keywords: ['grp', 'glass', 'reinforced', 'plastic'], code: 'GRP' },
    { keywords: ['pp', 'polypropylene'], code: 'PP' },
    { keywords: ['cmp', 'corrugated', 'metal'], code: 'CMP' }
  ];
  
  for (const material of materials) {
    if (material.keywords.some(keyword => lowerQuery.includes(keyword))) {
      filters.material = material.code;
      break;
    }
  }
  
  // Extract score ranges
  if (lowerQuery.includes('low score') || lowerQuery.includes('poor') || lowerQuery.includes('bad')) {
    filters.scoreMin = 0;
    filters.scoreMax = 50;
  } else if (lowerQuery.includes('high score') || lowerQuery.includes('good') || lowerQuery.includes('excellent')) {
    filters.scoreMin = 80;
    filters.scoreMax = 100;
  } else if (lowerQuery.includes('average') || lowerQuery.includes('median')) {
    // For average queries, get a broader range to calculate from
    filters.scoreMin = 0;
    filters.scoreMax = 100;
  }
  
  // Extract repair status
  if (lowerQuery.includes('repair') || lowerQuery.includes('fix') || lowerQuery.includes('urgent') || lowerQuery.includes('immediate')) {
    filters.requiresRepair = true;
  }
  
  // Extract defect-related queries - get more data for analysis
  if (lowerQuery.includes('defect') || lowerQuery.includes('problem') || lowerQuery.includes('issue') || 
      lowerQuery.includes('material') && (lowerQuery.includes('most') || lowerQuery.includes('compare'))) {
    // For material comparison queries, we need a broader dataset
    filters.scoreMin = 0;
    filters.scoreMax = 100;
    // Don't set specific material filter for comparison queries
    if (lowerQuery.includes('material') && lowerQuery.includes('most')) {
      delete filters.material;
    }
  }
  
  // Extract severity-related queries
  if (lowerQuery.includes('severity 5') || lowerQuery.includes('severity five')) {
    // For severity queries, we need pipes with defects
    filters.scoreMin = 0;
    filters.scoreMax = 80; // Lower scores more likely to have high severity defects
  }
  
  // Extract age-related queries
  if (lowerQuery.includes('old') || lowerQuery.includes('aging') || lowerQuery.includes('vintage')) {
    // For old pipe analysis, get a range that includes older infrastructure
    filters.scoreMin = 0;
    filters.scoreMax = 100;
  }
  
  return filters;
}

function buildContextData(inspections: SewerInspection[]): AIContextData {
  if (inspections.length === 0) {
    return {
      inspections: [],
      summary: {
        totalRecords: 0,
        scoreRange: { min: 0, max: 0, average: 0 },
        commonMaterials: [],
        repairNeeded: 0,
        cities: []
      }
    };
  }
  
  // Calculate summary statistics
  const scores = inspections.map(i => i.inspection_score);
  const minScore = Math.min(...scores);
  const maxScore = Math.max(...scores);
  const avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
  
  // Get unique materials
  const materials = [...new Set(inspections.map(i => i.pipe?.material).filter(Boolean))];
  
  // Count repairs needed
  const repairNeeded = inspections.filter(i => i.requires_repair).length;
  
  // Get unique cities
  const cities = [...new Set(inspections.map(i => i.location?.city).filter(Boolean))];
  
  return {
    inspections,
    summary: {
      totalRecords: inspections.length,
      scoreRange: { min: minScore, max: maxScore, average: avgScore },
      commonMaterials: materials,
      repairNeeded,
      cities
    }
  };
}

// Optimized function to create token-efficient context for AI
export function createFocusedPrompt(query: string, contextData: AIContextData): string {
  const { inspections, summary } = contextData;
  const lowerQuery = query.toLowerCase();
  
  // Calculate dynamic record limit based on token budget
  const baseTokens = 500; // System prompt and summary
  const availableTokens = MAX_PROMPT_TOKENS - baseTokens;
  const maxRecordsForTokens = Math.floor(availableTokens / TOKENS_PER_RECORD);
  const recordLimit = Math.min(maxRecordsForTokens, inspections.length);
  
  // For statistical queries, focus on summary data with minimal records
  if (lowerQuery.includes('average') || lowerQuery.includes('mean') || lowerQuery.includes('total')) {
    return createCompactPrompt(query, summary, inspections.slice(0, Math.min(3, recordLimit)));
  }
  
  // For repair queries, prioritize problematic inspections
  if (lowerQuery.includes('repair') || lowerQuery.includes('problem') || lowerQuery.includes('urgent')) {
    const repairNeeded = inspections.filter(i => i.requires_repair).slice(0, recordLimit);
    const repairSummary = {
      total: summary.totalRecords,
      needingRepair: summary.repairNeeded,
      repairRate: Math.round((summary.repairNeeded / summary.totalRecords) * 100)
    };
    
    return `Query: ${query}
Repair Summary: ${JSON.stringify(repairSummary)}
Priority Cases: ${JSON.stringify(repairNeeded)}`;
  }
  
  // For material comparison queries, provide aggregated stats
  if (lowerQuery.includes('material') && (lowerQuery.includes('most') || lowerQuery.includes('compare'))) {
    const materialStats = aggregateMaterialStats(inspections);
    return `Query: ${query}
Material Comparison: ${JSON.stringify(materialStats)}
Sample Data: ${JSON.stringify(inspections.slice(0, Math.min(5, recordLimit)))}`;
  }
  
  // For location-specific queries
  if (lowerQuery.includes('city') || lowerQuery.includes('houston') || lowerQuery.includes('chicago')) {
    return createCompactPrompt(query, summary, inspections.slice(0, recordLimit));
  }
  
  // Default: balanced context with summary + sample
  return createCompactPrompt(query, summary, inspections.slice(0, Math.min(10, recordLimit)));
}

// Create a token-efficient prompt format
function createCompactPrompt(query: string, summary: any, sampleInspections: SewerInspection[]): string {
  return `Q: ${query}
Summary: ${JSON.stringify(summary)}
Sample: ${JSON.stringify(sampleInspections)}`;
}

// Aggregate material statistics for efficient comparison
function aggregateMaterialStats(inspections: SewerInspection[]) {
  const materialGroups = inspections.reduce((acc, inspection) => {
    const material = inspection.pipe?.material || 'Unknown';
    if (!acc[material]) {
      acc[material] = { count: 0, totalScore: 0, defectCount: 0, repairCount: 0 };
    }
    acc[material].count++;
    acc[material].totalScore += inspection.inspection_score;
    acc[material].defectCount += inspection.defects?.length || 0;
    if (inspection.requires_repair) acc[material].repairCount++;
    return acc;
  }, {} as Record<string, any>);
  
  return Object.entries(materialGroups).map(([material, stats]) => ({
    material,
    count: stats.count,
    avgScore: Math.round(stats.totalScore / stats.count),
    avgDefects: Math.round((stats.defectCount / stats.count) * 10) / 10,
    repairRate: Math.round((stats.repairCount / stats.count) * 100)
  })).sort((a, b) => b.count - a.count);
}
