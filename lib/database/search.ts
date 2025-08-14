import { getDatabase } from './config';
import { transformDbToInspection, getInspectionCount, getInspections } from './sqlite';
import { SewerInspection, SearchFilters } from '../types';

// Main search function that replaces the S3 streaming version
export async function searchInspections(
  filters: SearchFilters, 
  page: number = 1, 
  pageSize: number = 10
): Promise<{ results: SewerInspection[], totalCount: number }> {
  console.log('Starting SQLite search with filters:', filters, 'page:', page, 'pageSize:', pageSize);
  
  try {
    // Get total count for pagination
    const totalCount = getInspectionCount(filters);
    
    // Get paginated results
    const results = getInspections(filters, page, pageSize);
    
    console.log(`SQLite search completed: ${results.length} results for page ${page}, total: ${totalCount}`);
    
    return {
      results,
      totalCount
    };
    
  } catch (error) {
    console.error('SQLite search error:', error);
    throw new Error(`Search failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

// Advanced search with complex filters
export function searchInspectionsAdvanced(
  filters: {
    city?: string;
    state?: string;
    material?: string;
    scoreMin?: number;
    scoreMax?: number;
    requiresRepair?: boolean;
    ageMin?: number;
    ageMax?: number;
    diameterMin?: number;
    diameterMax?: number;
    dateFrom?: Date;
    dateTo?: Date;
    defectSeverityMin?: number;
    fullTextSearch?: string;
  },
  page: number = 1,
  pageSize: number = 10,
  sortBy: string = 'timestamp_utc',
  sortOrder: 'ASC' | 'DESC' = 'DESC'
): { results: SewerInspection[], totalCount: number } {
  const db = getDatabase();
  
  const whereConditions: string[] = [];
  const params: any[] = [];
  
  // Build WHERE clause
  if (filters.city) {
    whereConditions.push('i.city LIKE ?');
    params.push(`%${filters.city}%`);
  }
  
  if (filters.state) {
    whereConditions.push('i.state = ?');
    params.push(filters.state);
  }
  
  if (filters.material) {
    whereConditions.push('i.material LIKE ?');
    params.push(`%${filters.material}%`);
  }
  
  if (filters.scoreMin !== undefined) {
    whereConditions.push('i.inspection_score >= ?');
    params.push(filters.scoreMin);
  }
  
  if (filters.scoreMax !== undefined) {
    whereConditions.push('i.inspection_score <= ?');
    params.push(filters.scoreMax);
  }
  
  if (filters.requiresRepair !== undefined) {
    whereConditions.push('i.requires_repair = ?');
    params.push(filters.requiresRepair ? 1 : 0);
  }
  
  if (filters.ageMin !== undefined) {
    whereConditions.push('i.age_years >= ?');
    params.push(filters.ageMin);
  }
  
  if (filters.ageMax !== undefined) {
    whereConditions.push('i.age_years <= ?');
    params.push(filters.ageMax);
  }
  
  if (filters.diameterMin !== undefined) {
    whereConditions.push('i.diameter_in >= ?');
    params.push(filters.diameterMin);
  }
  
  if (filters.diameterMax !== undefined) {
    whereConditions.push('i.diameter_in <= ?');
    params.push(filters.diameterMax);
  }
  
  if (filters.dateFrom) {
    whereConditions.push('i.timestamp_utc >= ?');
    params.push(filters.dateFrom.toISOString());
  }
  
  if (filters.dateTo) {
    whereConditions.push('i.timestamp_utc <= ?');
    params.push(filters.dateTo.toISOString());
  }
  
  if (filters.defectSeverityMin !== undefined) {
    whereConditions.push('EXISTS (SELECT 1 FROM defects d WHERE d.inspection_id = i.id AND d.severity >= ?)');
    params.push(filters.defectSeverityMin);
  }
  
  if (filters.fullTextSearch) {
    whereConditions.push(`(
      i.city LIKE ? OR 
      i.state LIKE ? OR 
      i.material LIKE ? OR 
      i.notes LIKE ?
    )`);
    const searchTerm = `%${filters.fullTextSearch}%`;
    params.push(searchTerm, searchTerm, searchTerm, searchTerm);
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Validate sort field
  const allowedSortFields = [
    'timestamp_utc', 'inspection_score', 'city', 'state', 'material', 
    'diameter_in', 'age_years', 'requires_repair'
  ];
  if (!allowedSortFields.includes(sortBy)) {
    sortBy = 'timestamp_utc';
  }
  
  // Get total count
  const countSql = `SELECT COUNT(*) as count FROM inspections i ${whereClause}`;
  const countResult = db.prepare(countSql).get(params) as { count: number };
  const totalCount = countResult.count;
  
  // Get paginated results
  const offset = (page - 1) * pageSize;
  const resultsSql = `
    SELECT i.* FROM inspections i 
    ${whereClause} 
    ORDER BY i.${sortBy} ${sortOrder} 
    LIMIT ? OFFSET ?
  `;
  
  const resultsParams = [...params, pageSize, offset];
  const rows = db.prepare(resultsSql).all(resultsParams);
  const results = rows.map(transformDbToInspection);
  
  return { results, totalCount };
}

// Search statistics and aggregations
export function getSearchStats(filters?: SearchFilters) {
  const db = getDatabase();
  
  let whereClause = '';
  const params: any[] = [];
  
  if (filters) {
    const conditions: string[] = [];
    
    if (filters.city) {
      conditions.push('city LIKE ?');
      params.push(`%${filters.city}%`);
    }
    
    if (filters.state) {
      conditions.push('state = ?');
      params.push(filters.state);
    }
    
    if (filters.material) {
      conditions.push('material LIKE ?');
      params.push(`%${filters.material}%`);
    }
    
    if (filters.scoreMin !== undefined) {
      conditions.push('inspection_score >= ?');
      params.push(filters.scoreMin);
    }
    
    if (filters.scoreMax !== undefined) {
      conditions.push('inspection_score <= ?');
      params.push(filters.scoreMax);
    }
    
    if (filters.requiresRepair !== undefined) {
      conditions.push('requires_repair = ?');
      params.push(filters.requiresRepair ? 1 : 0);
    }
    
    if (conditions.length > 0) {
      whereClause = 'WHERE ' + conditions.join(' AND ');
    }
  }
  
  try {
    // Basic statistics
    const statsQuery = `
      SELECT 
        COUNT(*) as total_inspections,
        AVG(inspection_score) as avg_score,
        MIN(inspection_score) as min_score,
        MAX(inspection_score) as max_score,
        SUM(CASE WHEN requires_repair = 1 THEN 1 ELSE 0 END) as repairs_needed,
        COUNT(DISTINCT city) as unique_cities,
        COUNT(DISTINCT state) as unique_states,
        COUNT(DISTINCT material) as unique_materials
      FROM inspections ${whereClause}
    `;
    
    const stats = db.prepare(statsQuery).get(params);
    
    // Material distribution
    const materialQuery = `
      SELECT material, COUNT(*) as count, AVG(inspection_score) as avg_score
      FROM inspections ${whereClause}
      GROUP BY material
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const materialStats = db.prepare(materialQuery).all(params);
    
    // City distribution
    const cityQuery = `
      SELECT city, COUNT(*) as count, AVG(inspection_score) as avg_score
      FROM inspections ${whereClause}
      GROUP BY city
      ORDER BY count DESC
      LIMIT 10
    `;
    
    const cityStats = db.prepare(cityQuery).all(params);
    
    // Score distribution
    const scoreQuery = `
      SELECT 
        CASE 
          WHEN inspection_score >= 90 THEN 'Excellent (90-100)'
          WHEN inspection_score >= 70 THEN 'Good (70-89)'
          WHEN inspection_score >= 50 THEN 'Fair (50-69)'
          ELSE 'Poor (0-49)'
        END as score_range,
        COUNT(*) as count
      FROM inspections ${whereClause}
      GROUP BY score_range
      ORDER BY MIN(inspection_score) DESC
    `;
    
    const scoreDistribution = db.prepare(scoreQuery).all(params);
    
    return {
      overview: stats,
      materialDistribution: materialStats,
      cityDistribution: cityStats,
      scoreDistribution: scoreDistribution,
    };
    
  } catch (error) {
    console.error('Error getting search stats:', error);
    return null;
  }
}

// Get unique values for dropdowns and filters
export function getUniqueValues(field: 'city' | 'state' | 'material' | 'district'): string[] {
  const db = getDatabase();
  
  const allowedFields = ['city', 'state', 'material', 'district'];
  if (!allowedFields.includes(field)) {
    throw new Error(`Invalid field: ${field}`);
  }
  
  try {
    const sql = `
      SELECT DISTINCT ${field} 
      FROM inspections 
      WHERE ${field} IS NOT NULL AND ${field} != '' 
      ORDER BY ${field}
    `;
    
    const rows = db.prepare(sql).all() as Array<{ [key: string]: string }>;
    return rows.map(row => row[field]);
    
  } catch (error) {
    console.error(`Error getting unique values for ${field}:`, error);
    return [];
  }
}

// Search with defect information
export function searchWithDefects(
  filters: SearchFilters,
  page: number = 1,
  pageSize: number = 10
): { results: SewerInspection[], totalCount: number } {
  const db = getDatabase();
  
  // Build where clause for inspections
  const whereConditions: string[] = [];
  const params: any[] = [];
  
  if (filters.city) {
    whereConditions.push('i.city LIKE ?');
    params.push(`%${filters.city}%`);
  }
  
  if (filters.state) {
    whereConditions.push('i.state = ?');
    params.push(filters.state);
  }
  
  if (filters.material) {
    whereConditions.push('i.material LIKE ?');
    params.push(`%${filters.material}%`);
  }
  
  if (filters.scoreMin !== undefined) {
    whereConditions.push('i.inspection_score >= ?');
    params.push(filters.scoreMin);
  }
  
  if (filters.scoreMax !== undefined) {
    whereConditions.push('i.inspection_score <= ?');
    params.push(filters.scoreMax);
  }
  
  if (filters.requiresRepair !== undefined) {
    whereConditions.push('i.requires_repair = ?');
    params.push(filters.requiresRepair ? 1 : 0);
  }
  
  const whereClause = whereConditions.length > 0 ? 'WHERE ' + whereConditions.join(' AND ') : '';
  
  // Get total count
  const countSql = `SELECT COUNT(*) as count FROM inspections i ${whereClause}`;
  const countResult = db.prepare(countSql).get(params) as { count: number };
  const totalCount = countResult.count;
  
  // Get inspections with defects
  const offset = (page - 1) * pageSize;
  const inspectionsSql = `
    SELECT i.* FROM inspections i 
    ${whereClause} 
    ORDER BY i.timestamp_utc DESC 
    LIMIT ? OFFSET ?
  `;
  
  const inspectionsParams = [...params, pageSize, offset];
  const inspectionRows = db.prepare(inspectionsSql).all(inspectionsParams);
  
  // Get defects for these inspections
  const inspectionIds = inspectionRows.map((row: any) => row.id);
  
  let defectsMap: Map<string, any[]> = new Map();
  
  if (inspectionIds.length > 0) {
    const defectsPlaceholders = inspectionIds.map(() => '?').join(',');
    const defectsSql = `
      SELECT * FROM defects 
      WHERE inspection_id IN (${defectsPlaceholders})
      ORDER BY inspection_id, severity DESC
    `;
    
    const defectRows = db.prepare(defectsSql).all(inspectionIds);
    
    // Group defects by inspection_id
    defectRows.forEach((defect: any) => {
      if (!defectsMap.has(defect.inspection_id)) {
        defectsMap.set(defect.inspection_id, []);
      }
      defectsMap.get(defect.inspection_id)!.push({
        code: defect.code,
        description: defect.description,
        severity: defect.severity,
        distance_ft: defect.distance_ft,
        category: defect.category,
        clock_start: defect.clock_start,
        clock_end: defect.clock_end,
        dimensions: defect.dimensions ? JSON.parse(defect.dimensions) : null,
        photo_ref: defect.photo_ref,
        video_timestamp_sec: defect.video_timestamp_sec,
      });
    });
  }
  
  // Transform to SewerInspection objects with defects
  const results = inspectionRows.map((row: any) => {
    const inspection = transformDbToInspection(row);
    inspection.defects = defectsMap.get(row.id) || [];
    return inspection;
  });
  
  return { results, totalCount };
}

// Full-text search across multiple fields
export function fullTextSearch(
  searchTerm: string,
  page: number = 1,
  pageSize: number = 10
): { results: SewerInspection[], totalCount: number } {
  const db = getDatabase();
  
  const searchPattern = `%${searchTerm}%`;
  
  const whereClause = `
    WHERE (
      city LIKE ? OR 
      state LIKE ? OR 
      material LIKE ? OR 
      notes LIKE ? OR 
      district LIKE ? OR
      street LIKE ?
    )
  `;
  
  const params = Array(6).fill(searchPattern);
  
  // Get total count
  const countSql = `SELECT COUNT(*) as count FROM inspections ${whereClause}`;
  const countResult = db.prepare(countSql).get(params) as { count: number };
  const totalCount = countResult.count;
  
  // Get results
  const offset = (page - 1) * pageSize;
  const resultsSql = `
    SELECT * FROM inspections 
    ${whereClause} 
    ORDER BY inspection_score DESC, timestamp_utc DESC 
    LIMIT ? OFFSET ?
  `;
  
  const resultsParams = [...params, pageSize, offset];
  const rows = db.prepare(resultsSql).all(resultsParams);
  const results = rows.map(transformDbToInspection);
  
  return { results, totalCount };
}

// Export function for backward compatibility with existing search
export { getUniqueValues as getSearchOptions };
