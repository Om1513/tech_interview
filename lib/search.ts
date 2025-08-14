import { SewerInspection, SearchFilters } from './types';
import { streamFromS3 } from './s3-stream';

export async function searchInspections(filters: SearchFilters): Promise<SewerInspection[]> {
  console.log('Starting search with filters:', filters);
  
  // Determine which files to search based on filters
  const filesToSearch = [
    'sewer-inspections-part1.jsonl',
    'sewer-inspections-part2.jsonl',
    'sewer-inspections-part3.jsonl',
    'sewer-inspections-part4.jsonl',
    'sewer-inspections-part5.jsonl'
  ];
  
  const allResults: SewerInspection[] = [];
  const maxResults = filters.limit || 100;
  
  try {
    // Search through files until we have enough results
    for (const fileName of filesToSearch) {
      if (allResults.length >= maxResults) break;
      
      console.log(`Searching ${fileName}...`);
      
      // Stream a larger chunk from each file to find matches
      const remainingNeeded = maxResults - allResults.length;
      const chunkSize = Math.min(1000, remainingNeeded * 5); // Search more than needed to find matches
      
      const chunk = await streamFromS3(fileName, chunkSize);
      const filteredChunk = filterInspections(chunk, filters);
      
      // Add filtered results up to our limit
      const toAdd = filteredChunk.slice(0, remainingNeeded);
      allResults.push(...toAdd);
      
      console.log(`Found ${filteredChunk.length} matches in ${fileName}, total: ${allResults.length}`);
    }
    
    console.log(`Search completed. Found ${allResults.length} total matches.`);
    return allResults.slice(0, maxResults);
    
  } catch (error) {
    console.error('Search error:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

function filterInspections(inspections: SewerInspection[], filters: SearchFilters): SewerInspection[] {
  return inspections.filter(inspection => {
    // City filter (case-insensitive partial match)
    if (filters.city && inspection.location?.city) {
      const cityMatch = inspection.location.city.toLowerCase().includes(filters.city.toLowerCase());
      if (!cityMatch) return false;
    }
    
    // State filter (case-insensitive exact match)
    if (filters.state && inspection.location?.state) {
      const stateMatch = inspection.location.state.toLowerCase() === filters.state.toLowerCase();
      if (!stateMatch) return false;
    }
    
    // Material filter (case-insensitive partial match)
    if (filters.material && inspection.pipe?.material) {
      const materialMatch = inspection.pipe.material.toLowerCase().includes(filters.material.toLowerCase());
      if (!materialMatch) return false;
    }
    
    // Score range filter
    const score = inspection.inspection_score;
    if (filters.scoreMin !== undefined && score < filters.scoreMin) return false;
    if (filters.scoreMax !== undefined && score > filters.scoreMax) return false;
    
    // Needs repair filter
    if (filters.requiresRepair !== undefined) {
      if (inspection.requires_repair !== filters.requiresRepair) return false;
    }
    
    return true;
  });
}

// Helper function to get unique cities and states for dropdowns
export async function getSearchOptions(): Promise<{ cities: string[], states: string[] }> {
  console.log('Fetching search options...');
  
  try {
    // Sample from first file to get options
    const sample = await streamFromS3('sewer-inspections-part1.jsonl', 100);
    
    const cities = new Set<string>();
    const states = new Set<string>();
    
    sample.forEach(inspection => {
      if (inspection.location?.city) cities.add(inspection.location.city);
      if (inspection.location?.state) states.add(inspection.location.state);
    });
    
    return {
      cities: Array.from(cities).sort(),
      states: Array.from(states).sort()
    };
    
  } catch (error) {
    console.error('Error fetching search options:', error);
    return { cities: [], states: [] };
  }
}
