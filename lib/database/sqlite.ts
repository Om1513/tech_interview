import Database from 'better-sqlite3';
import { getDatabase } from './config';
import { SewerInspection, SearchFilters, Defect } from '../types';

// Database initialization
export function initializeDatabase(): Database.Database {
  const db = getDatabase();
  
  console.log('Initializing database tables...');
  
  // Create tables if they don't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS inspections (
      id TEXT PRIMARY KEY,
      timestamp_utc DATETIME NOT NULL,
      inspection_type TEXT,
      
      -- Location fields (flattened for performance)
      city TEXT NOT NULL,
      state TEXT NOT NULL,
      district TEXT,
      street TEXT,
      gps_lat REAL,
      gps_lon REAL,
      upstream_manhole TEXT,
      downstream_manhole TEXT,
      
      -- Pipe fields (flattened for performance)
      material TEXT NOT NULL,
      material_desc TEXT,
      diameter_in INTEGER NOT NULL,
      length_ft REAL NOT NULL,
      age_years INTEGER,
      shape TEXT,
      install_year INTEGER,
      slope_percent REAL,
      
      -- Core inspection data
      inspection_score INTEGER NOT NULL,
      severity_max INTEGER DEFAULT 0,
      requires_repair BOOLEAN NOT NULL,
      requires_cleaning BOOLEAN,
      
      -- JSON fields for complex data
      conditions TEXT, -- JSON
      equipment TEXT, -- JSON
      observations TEXT, -- JSON
      sensor_data TEXT, -- JSON
      crew TEXT, -- JSON
      
      -- Additional fields
      duration_minutes INTEGER,
      video_file TEXT,
      report_generated BOOLEAN,
      notes TEXT,
      qc_reviewed BOOLEAN,
      tags TEXT, -- JSON array
      
      -- Metadata
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      imported_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS defects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      inspection_id TEXT NOT NULL,
      code TEXT NOT NULL,
      description TEXT NOT NULL,
      severity INTEGER NOT NULL,
      distance_ft REAL NOT NULL,
      category TEXT,
      clock_start INTEGER,
      clock_end INTEGER,
      dimensions TEXT, -- JSON
      photo_ref TEXT,
      video_timestamp_sec INTEGER,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY (inspection_id) REFERENCES inspections(id) ON DELETE CASCADE
    );
  `);
  
  db.exec(`
    CREATE TABLE IF NOT EXISTS import_log (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      source_file TEXT NOT NULL,
      started_at DATETIME NOT NULL,
      completed_at DATETIME,
      records_processed INTEGER DEFAULT 0,
      records_imported INTEGER DEFAULT 0,
      errors INTEGER DEFAULT 0,
      status TEXT DEFAULT 'running', -- running, completed, failed
      error_message TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Create performance indexes
  createIndexes(db);
  
  console.log('Database tables initialized successfully');
  return db;
}

export function createIndexes(db: Database.Database): void {
  console.log('Creating performance indexes...');
  
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_inspections_city ON inspections(city)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_state ON inspections(state)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_material ON inspections(material)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_score ON inspections(inspection_score)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_repair ON inspections(requires_repair)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_timestamp ON inspections(timestamp_utc)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_location ON inspections(city, state)',
    'CREATE INDEX IF NOT EXISTS idx_inspections_pipe ON inspections(material, diameter_in)',
    'CREATE INDEX IF NOT EXISTS idx_defects_inspection ON defects(inspection_id)',
    'CREATE INDEX IF NOT EXISTS idx_defects_severity ON defects(severity)',
    'CREATE INDEX IF NOT EXISTS idx_import_log_file ON import_log(source_file)',
    'CREATE INDEX IF NOT EXISTS idx_import_log_status ON import_log(status)',
  ];
  
  for (const indexSql of indexes) {
    try {
      db.exec(indexSql);
    } catch (error) {
      console.error(`Error creating index: ${indexSql}`, error);
    }
  }
  
  console.log('Performance indexes created successfully');
}

// Data transformation functions
// Helper function to safely convert values for SQLite
function safeValue(value: any, defaultValue: any = null): any {
  if (value === undefined || value === '') {
    return defaultValue;
  }
  if (typeof value === 'boolean') {
    return value ? 1 : 0;
  }
  if (typeof value === 'number') {
    return isNaN(value) ? defaultValue : value;
  }
  if (typeof value === 'string') {
    return value;
  }
  if (value === null) {
    return null;
  }
  // For objects/arrays, stringify them
  try {
    return JSON.stringify(value);
  } catch {
    return defaultValue;
  }
}

export function transformInspectionForDb(inspection: SewerInspection) {
  return {
    id: safeValue(inspection.id, ''),
    timestamp_utc: safeValue(new Date(inspection.timestamp_utc).toISOString(), new Date().toISOString()),
    inspection_type: safeValue(inspection.inspection_type),
    
    // Location fields
    city: safeValue(inspection.location?.city, ''),
    state: safeValue(inspection.location?.state, ''),
    district: safeValue(inspection.location?.district),
    street: safeValue(inspection.location?.street),
    gps_lat: safeValue(inspection.location?.gps?.lat),
    gps_lon: safeValue(inspection.location?.gps?.lon),
    upstream_manhole: safeValue(inspection.location?.upstream_manhole),
    downstream_manhole: safeValue(inspection.location?.downstream_manhole),
    
    // Pipe fields
    material: safeValue(inspection.pipe?.material, ''),
    material_desc: safeValue(inspection.pipe?.material_desc),
    diameter_in: safeValue(inspection.pipe?.diameter_in, 0),
    length_ft: safeValue(inspection.pipe?.length_ft, 0),
    age_years: safeValue(inspection.pipe?.age_years),
    shape: safeValue(inspection.pipe?.shape),
    install_year: safeValue(inspection.pipe?.install_year),
    slope_percent: safeValue(inspection.pipe?.slope_percent),
    
    // Core inspection data
    inspection_score: safeValue(inspection.inspection_score, 0),
    severity_max: safeValue(inspection.severity_max, 0),
    requires_repair: safeValue(inspection.requires_repair, false),
    requires_cleaning: safeValue(inspection.requires_cleaning),
    
    // JSON fields
    conditions: safeValue(inspection.conditions),
    equipment: safeValue(inspection.equipment),
    observations: safeValue(inspection.observations),
    sensor_data: safeValue(inspection.sensor_data),
    crew: safeValue(inspection.crew),
    
    // Additional fields
    duration_minutes: safeValue(inspection.duration_minutes),
    video_file: safeValue(inspection.video_file),
    report_generated: safeValue(inspection.report_generated),
    notes: safeValue(inspection.notes),
    qc_reviewed: safeValue(inspection.qc_reviewed),
    tags: safeValue(inspection.tags),
  };
}

export function transformDbToInspection(row: any): SewerInspection {
  return {
    id: row.id,
    timestamp_utc: row.timestamp_utc,
    inspection_type: row.inspection_type,
    
    location: {
      city: row.city,
      state: row.state,
      district: row.district,
      street: row.street,
      gps: row.gps_lat && row.gps_lon ? {
        lat: row.gps_lat,
        lon: row.gps_lon
      } : undefined,
      upstream_manhole: row.upstream_manhole,
      downstream_manhole: row.downstream_manhole,
    },
    
    pipe: {
      material: row.material,
      material_desc: row.material_desc,
      diameter_in: row.diameter_in,
      length_ft: row.length_ft,
      age_years: row.age_years,
      shape: row.shape,
      install_year: row.install_year,
      slope_percent: row.slope_percent,
    },
    
    conditions: row.conditions ? JSON.parse(row.conditions) : undefined,
    equipment: row.equipment ? JSON.parse(row.equipment) : undefined,
    observations: row.observations ? JSON.parse(row.observations) : undefined,
    sensor_data: row.sensor_data ? JSON.parse(row.sensor_data) : undefined,
    crew: row.crew ? JSON.parse(row.crew) : undefined,
    
    defects: [], // Will be populated separately if needed
    
    inspection_score: row.inspection_score,
    severity_max: row.severity_max,
    requires_repair: Boolean(row.requires_repair),
    requires_cleaning: row.requires_cleaning ? Boolean(row.requires_cleaning) : undefined,
    
    duration_minutes: row.duration_minutes,
    video_file: row.video_file,
    report_generated: row.report_generated ? Boolean(row.report_generated) : undefined,
    notes: row.notes,
    qc_reviewed: row.qc_reviewed ? Boolean(row.qc_reviewed) : undefined,
    tags: row.tags ? JSON.parse(row.tags) : undefined,
  };
}

// Core database operations
export function insertInspection(inspection: SewerInspection): boolean {
  const db = getDatabase();
  const transformedData = transformInspectionForDb(inspection);
  
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO inspections (
      id, timestamp_utc, inspection_type,
      city, state, district, street, gps_lat, gps_lon, upstream_manhole, downstream_manhole,
      material, material_desc, diameter_in, length_ft, age_years, shape, install_year, slope_percent,
      inspection_score, severity_max, requires_repair, requires_cleaning,
      conditions, equipment, observations, sensor_data, crew,
      duration_minutes, video_file, report_generated, notes, qc_reviewed, tags,
      updated_at
    ) VALUES (
      ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?, ?, ?,
      ?, ?, ?, ?,
      ?, ?, ?, ?, ?,
      ?, ?, ?, ?, ?, ?,
      CURRENT_TIMESTAMP
    )
  `);
  
  try {
    const result = stmt.run(
      transformedData.id, transformedData.timestamp_utc, transformedData.inspection_type,
      transformedData.city, transformedData.state, transformedData.district, transformedData.street,
      transformedData.gps_lat, transformedData.gps_lon, transformedData.upstream_manhole, transformedData.downstream_manhole,
      transformedData.material, transformedData.material_desc, transformedData.diameter_in, transformedData.length_ft,
      transformedData.age_years, transformedData.shape, transformedData.install_year, transformedData.slope_percent,
      transformedData.inspection_score, transformedData.severity_max, transformedData.requires_repair, transformedData.requires_cleaning,
      transformedData.conditions, transformedData.equipment, transformedData.observations, transformedData.sensor_data, transformedData.crew,
      transformedData.duration_minutes, transformedData.video_file, transformedData.report_generated,
      transformedData.notes, transformedData.qc_reviewed, transformedData.tags
    );
    
    // Insert defects if any
    if (inspection.defects && inspection.defects.length > 0) {
      insertDefects(inspection.id, inspection.defects);
    }
    
    return result.changes > 0;
  } catch (error) {
    console.error('Error inserting inspection:', error);
    throw error;
  }
}

export function insertInspectionsBatch(inspections: SewerInspection[]): number {
  const db = getDatabase();
  let insertedCount = 0;
  
  const transaction = db.transaction((inspectionBatch: SewerInspection[]) => {
    for (const inspection of inspectionBatch) {
      try {
        if (insertInspection(inspection)) {
          insertedCount++;
        }
      } catch (error) {
        console.error(`Error inserting inspection ${inspection.id}:`, error);
        // Continue with other inspections
      }
    }
  });
  
  try {
    transaction(inspections);
    return insertedCount;
  } catch (error) {
    console.error('Error in batch insert transaction:', error);
    throw error;
  }
}

export function insertDefects(inspectionId: string, defects: Defect[]): void {
  const db = getDatabase();
  
  // First, delete existing defects for this inspection
  const deleteStmt = db.prepare('DELETE FROM defects WHERE inspection_id = ?');
  deleteStmt.run(inspectionId);
  
  // Insert new defects
  const insertStmt = db.prepare(`
    INSERT INTO defects (
      inspection_id, code, description, severity, distance_ft,
      category, clock_start, clock_end, dimensions, photo_ref, video_timestamp_sec
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  
  for (const defect of defects) {
    insertStmt.run(
      inspectionId,
      defect.code,
      defect.description,
      defect.severity,
      defect.distance_ft,
      defect.category || null,
      defect.clock_start || null,
      defect.clock_end || null,
      defect.dimensions ? JSON.stringify(defect.dimensions) : null,
      defect.photo_ref || null,
      defect.video_timestamp_sec || null
    );
  }
}

// Query functions
export function getInspectionCount(filters?: SearchFilters): number {
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
  
  const sql = `SELECT COUNT(*) as count FROM inspections ${whereClause}`;
  const result = db.prepare(sql).get(params) as { count: number };
  
  return result.count;
}

export function getInspections(filters: SearchFilters, page: number = 1, pageSize: number = 10): SewerInspection[] {
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
  
  const offset = (page - 1) * pageSize;
  const sql = `
    SELECT * FROM inspections 
    ${whereClause} 
    ORDER BY timestamp_utc DESC 
    LIMIT ? OFFSET ?
  `;
  
  params.push(pageSize, offset);
  
  const rows = db.prepare(sql).all(params);
  return rows.map(transformDbToInspection);
}

// Utility functions
export function getUniqueValues(field: string): string[] {
  const db = getDatabase();
  
  const allowedFields = ['city', 'state', 'material', 'district'];
  if (!allowedFields.includes(field)) {
    throw new Error(`Invalid field: ${field}`);
  }
  
  const sql = `SELECT DISTINCT ${field} FROM inspections WHERE ${field} IS NOT NULL AND ${field} != '' ORDER BY ${field}`;
  const rows = db.prepare(sql).all() as Array<{ [key: string]: string }>;
  
  return rows.map(row => row[field]);
}

export function getDatabaseStats() {
  const db = getDatabase();
  
  try {
    const inspectionCount = db.prepare('SELECT COUNT(*) as count FROM inspections').get() as { count: number };
    const defectCount = db.prepare('SELECT COUNT(*) as count FROM defects').get() as { count: number };
    const importLogCount = db.prepare('SELECT COUNT(*) as count FROM import_log').get() as { count: number };
    
    const lastImport = db.prepare(
      'SELECT * FROM import_log ORDER BY started_at DESC LIMIT 1'
    ).get();
    
    return {
      inspections: inspectionCount.count,
      defects: defectCount.count,
      importLogs: importLogCount.count,
      lastImport: lastImport || null,
    };
  } catch (error) {
    console.error('Error getting database stats:', error);
    return null;
  }
}
