import { SewerInspection, SearchFilters } from './types';
import { searchInspections } from './search';

// AI context configuration
const MAX_CONTEXT_RECORDS = 50; // Limit to stay within token limits
const FALLBACK_SAMPLE_SIZE = 20; // Sample size when no specific filters match

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
    const inspections = await searchInspections({
      ...filters,
      limit: MAX_CONTEXT_RECORDS
    });
    
    // If no specific results, get a general sample
    if (inspections.length === 0) {
      console.log('No specific matches, getting general sample');
      const fallbackInspections = await searchInspections({
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

// Helper function to create focused context for specific question types
export function createFocusedPrompt(query: string, contextData: AIContextData): string {
  const { inspections, summary } = contextData;
  
  // For statistical queries, provide summary data
  if (query.toLowerCase().includes('average') || query.toLowerCase().includes('mean')) {
    return `Query: ${query}

Summary Data:
- Total inspections analyzed: ${summary.totalRecords}
- Score range: ${summary.scoreRange.min} to ${summary.scoreRange.max}
- Average score: ${summary.scoreRange.average}
- Inspections needing repair: ${summary.repairNeeded}
- Cities covered: ${summary.cities.join(', ')}
- Materials found: ${summary.commonMaterials.join(', ')}

Sample inspections: ${JSON.stringify(inspections.slice(0, 5))}`;
  }
  
  // For repair queries, focus on problematic inspections
  if (query.toLowerCase().includes('repair') || query.toLowerCase().includes('problem')) {
    const repairNeeded = inspections.filter(i => i.requires_repair);
    const withDefects = inspections.filter(i => i.defects && i.defects.length > 0);
    
    return `Query: ${query}

Repair Analysis:
- Total inspections: ${summary.totalRecords}
- Requiring repair: ${summary.repairNeeded}
- With defects: ${withDefects.length}

Inspections needing repair: ${JSON.stringify(repairNeeded)}
Inspections with defects: ${JSON.stringify(withDefects.slice(0, 10))}`;
  }
  
  // For material queries, group by material and analyze defects
  if (query.toLowerCase().includes('material') || query.toLowerCase().includes('pipe')) {
    const materialGroups = inspections.reduce((acc, inspection) => {
      const material = inspection.pipe?.material || 'Unknown';
      if (!acc[material]) acc[material] = [];
      acc[material].push(inspection);
      return acc;
    }, {} as Record<string, SewerInspection[]>);
    
    const materialStats = Object.entries(materialGroups).map(([material, pipes]) => {
      const totalDefects = pipes.reduce((sum, p) => sum + (p.defects?.length || 0), 0);
      const avgScore = Math.round(pipes.reduce((sum, p) => sum + p.inspection_score, 0) / pipes.length);
      const repairNeeded = pipes.filter(p => p.requires_repair).length;
      
      return {
        material,
        pipeCount: pipes.length,
        totalDefects,
        avgDefects: Math.round((totalDefects / pipes.length) * 10) / 10,
        avgScore,
        repairRate: Math.round((repairNeeded / pipes.length) * 100)
      };
    }).sort((a, b) => b.totalDefects - a.totalDefects);
    
    return `Query: ${query}

Material Analysis:
${materialStats.map(stat => 
  `${stat.material}: ${stat.pipeCount} pipes, ${stat.totalDefects} total defects (${stat.avgDefects} avg per pipe), score: ${stat.avgScore}/100, repair rate: ${stat.repairRate}%`
).join('\n')}

Detailed data: ${JSON.stringify(inspections.slice(0, 15))}`;
  }
  
  // Default: provide general context
  return `Query: ${query}

Data Context:
${JSON.stringify({ summary, inspections: inspections.slice(0, 15) })}`;
}
