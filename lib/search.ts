import { SewerInspection, SearchFilters } from './types';
import { streamFromS3 } from './s3-stream';

export async function searchInspections(
  filters: SearchFilters, 
  page: number = 1, 
  pageSize: number = 10
): Promise<{ results: SewerInspection[], totalCount: number }> {
  console.log('Starting optimized search with filters:', filters, 'page:', page, 'pageSize:', pageSize);
  
  // Determine which files to search based on filters
  const filesToSearch = [
    'sewer-inspections-part1.jsonl',
    'sewer-inspections-part2.jsonl',
    'sewer-inspections-part3.jsonl',
    'sewer-inspections-part4.jsonl',
    'sewer-inspections-part5.jsonl'
  ];
  
  const offset = (page - 1) * pageSize;
  const results: SewerInspection[] = [];
  let totalMatchesFound = 0;
  let recordsSkipped = 0;
  let estimatedTotalCount = 0;
  
  try {
    // Stream through files efficiently - stop when we have enough results
    for (const fileName of filesToSearch) {
      if (results.length >= pageSize) break; // Early termination when page is full
      
      console.log(`Searching ${fileName} for page ${page}...`);
      
      // Use streaming with efficient filtering and offset handling
      const { matches, totalProcessed } = await streamWithOffsetAndLimit(
        fileName, 
        filters, 
        Math.max(0, offset - recordsSkipped), // Remaining offset to skip
        pageSize - results.length, // Remaining results needed
        recordsSkipped
      );
      
      results.push(...matches);
      recordsSkipped += totalProcessed;
      totalMatchesFound += matches.length;
      
      console.log(`${fileName}: found ${matches.length} matches, processed ${totalProcessed} records`);
    }
    
    // Estimate total count based on sampling
    estimatedTotalCount = await estimateTotalCount(filters, filesToSearch);
    
    console.log(`Optimized search completed: ${results.length} results for page ${page}, estimated total: ${estimatedTotalCount}`);
    
    return {
      results: results,
      totalCount: estimatedTotalCount
    };
    
  } catch (error) {
    console.error('Search error:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Optimized streaming function with fast filtering and early termination
async function streamWithOffsetAndLimit(
  fileName: string,
  filters: SearchFilters,
  skipCount: number,
  limitCount: number,
  globalOffset: number
): Promise<{ matches: SewerInspection[], totalProcessed: number }> {
  const chunkSize = 500; // Larger chunks for better throughput
  const matches: SewerInspection[] = [];
  let processed = 0;
  let localSkipped = 0;
  
  // Pre-compile filter predicates for faster execution
  const filterPredicates = compileFilterPredicates(filters);
  
  // Stream in chunks until we have enough results or reach end
  while (matches.length < limitCount) {
    const chunk = await streamFromS3(fileName, chunkSize, processed);
    if (chunk.length === 0) break; // End of file
    
    // Fast batch filtering - process multiple records at once
    const filteredChunk = chunk.filter(inspection => {
      processed++;
      
      // Apply fast filters first (exact matches, numeric ranges)
      if (!fastFilter(inspection, filterPredicates)) {
        return false;
      }
      
      // Apply detailed filters only if fast filters pass
      return matchesFilters(inspection, filters);
    });
    
    // Process filtered results
    for (const inspection of filteredChunk) {
      // Skip records if we haven't reached our offset yet
      if (localSkipped < skipCount) {
        localSkipped++;
        continue;
      }
      
      // Add to results if we have room
      if (matches.length < limitCount) {
        matches.push(inspection);
      } else {
        // We have enough results, stop processing immediately
        return { matches, totalProcessed: processed };
      }
    }
    
    // If chunk was smaller than requested, we've reached end of file
    if (chunk.length < chunkSize) break;
    
    // Performance monitoring - log progress every 10k records
    if (processed % 10000 === 0) {
      console.log(`Processed ${processed} records, found ${matches.length} matches`);
    }
  }
  
  return { matches, totalProcessed: processed };
}

// Pre-compile filter predicates for maximum performance
function compileFilterPredicates(filters: SearchFilters) {
  return {
    hasCity: !!filters.city,
    city: filters.city?.toLowerCase(),
    hasState: !!filters.state,
    state: filters.state?.toLowerCase(),
    hasMaterial: !!filters.material,
    material: filters.material?.toLowerCase(),
    hasScoreMin: typeof filters.scoreMin === 'number',
    scoreMin: filters.scoreMin || 0,
    hasScoreMax: typeof filters.scoreMax === 'number',
    scoreMax: filters.scoreMax || 100,
    hasRequiresRepair: typeof filters.requiresRepair === 'boolean',
    requiresRepair: filters.requiresRepair
  };
}

// Fast filter for common cases - exits early on mismatch
function fastFilter(inspection: SewerInspection, predicates: any): boolean {
  // City filter (most common) - check first
  if (predicates.hasCity && 
      !inspection.location?.city?.toLowerCase().includes(predicates.city)) {
    return false;
  }
  
  // State filter - exact match
  if (predicates.hasState && 
      inspection.location?.state?.toLowerCase() !== predicates.state) {
    return false;
  }
  
  // Material filter
  if (predicates.hasMaterial && 
      !inspection.pipe?.material?.toLowerCase().includes(predicates.material)) {
    return false;
  }
  
  // Score range filters - numeric comparison is fast
  if (predicates.hasScoreMin && inspection.inspection_score < predicates.scoreMin) {
    return false;
  }
  
  if (predicates.hasScoreMax && inspection.inspection_score > predicates.scoreMax) {
    return false;
  }
  
  // Repair requirement filter
  if (predicates.hasRequiresRepair && 
      inspection.requires_repair !== predicates.requiresRepair) {
    return false;
  }
  
  return true;
}

// Efficient total count estimation
async function estimateTotalCount(filters: SearchFilters, filesToSearch: string[]): Promise<number> {
  const sampleSize = 500; // Sample from each file for estimation
  let totalSampled = 0;
  let totalMatches = 0;
  
  try {
    for (const fileName of filesToSearch) {
      const sample = await streamFromS3(fileName, sampleSize);
      const sampleMatches = sample.filter(inspection => matchesFilters(inspection, filters));
      
      totalSampled += sample.length;
      totalMatches += sampleMatches.length;
      
      // If sample is smaller than requested, this file has fewer records
      if (sample.length < sampleSize) {
        // For smaller files, we have exact count
        continue;
      }
    }
    
    // Estimate based on match ratio in samples
    if (totalSampled === 0) return 0;
    
    const matchRatio = totalMatches / totalSampled;
    const estimatedFileSize = 5000; // Rough estimate of records per file
    const estimatedTotal = Math.round(matchRatio * estimatedFileSize * filesToSearch.length);
    
    console.log(`Count estimation: ${totalMatches}/${totalSampled} sample matches (${(matchRatio * 100).toFixed(2)}%), estimated total: ${estimatedTotal}`);
    
    return Math.max(totalMatches, estimatedTotal); // Return at least the matches we found
    
  } catch (error) {
    console.error('Error estimating total count:', error);
    return totalMatches; // Fallback to actual matches found in samples
  }
}

// Optimized filter matching function
function matchesFilters(inspection: SewerInspection, filters: SearchFilters): boolean {
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
