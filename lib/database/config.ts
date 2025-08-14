import Database from 'better-sqlite3';
import path from 'path';

export interface DatabaseConfig {
  filePath: string;
  options: Database.Options;
  performanceSettings: {
    walMode: boolean;
    cacheSize: number;
    tempStore: string;
    syncMode: string;
    journalMode: string;
  };
  maintenance: {
    vacuumEnabled: boolean;
    vacuumInterval: number; // hours
    analyzeEnabled: boolean;
    analyzeInterval: number; // hours
  };
}

const isDevelopment = process.env.NODE_ENV === 'development';
const isProduction = process.env.NODE_ENV === 'production';

export const defaultConfig: DatabaseConfig = {
  filePath: process.env.DATABASE_URL?.replace('file:', '') || 
           path.join(process.cwd(), 'data', 'inspections.db'),
  
  options: {
    verbose: isDevelopment ? console.log : undefined,
    fileMustExist: false,
    timeout: 30000, // 30 seconds
  },
  
  performanceSettings: {
    walMode: true, // Write-Ahead Logging for better concurrency
    cacheSize: 10000, // 10MB cache (10000 pages * 1KB)
    tempStore: 'MEMORY', // Use memory for temporary tables
    syncMode: isProduction ? 'NORMAL' : 'OFF', // Faster in dev, safe in prod
    journalMode: 'WAL', // Write-Ahead Logging
  },
  
  maintenance: {
    vacuumEnabled: true,
    vacuumInterval: 24, // Run VACUUM every 24 hours
    analyzeEnabled: true,
    analyzeInterval: 6, // Run ANALYZE every 6 hours
  }
};

let dbInstance: Database.Database | null = null;

export function createDatabase(config: DatabaseConfig = defaultConfig): Database.Database {
  if (dbInstance) {
    return dbInstance;
  }

  // Ensure data directory exists
  const dataDir = path.dirname(config.filePath);
  if (!require('fs').existsSync(dataDir)) {
    require('fs').mkdirSync(dataDir, { recursive: true });
  }

  console.log(`Initializing SQLite database at: ${config.filePath}`);
  
  const db = new Database(config.filePath, config.options);
  
  // Apply performance settings
  try {
    if (config.performanceSettings.walMode) {
      db.exec(`PRAGMA journal_mode = ${config.performanceSettings.journalMode}`);
    }
    
    db.exec(`PRAGMA cache_size = ${config.performanceSettings.cacheSize}`);
    db.exec(`PRAGMA temp_store = ${config.performanceSettings.tempStore}`);
    db.exec(`PRAGMA synchronous = ${config.performanceSettings.syncMode}`);
    
    // Additional performance optimizations
    db.exec('PRAGMA foreign_keys = ON'); // Enable foreign key constraints
    db.exec('PRAGMA auto_vacuum = INCREMENTAL'); // Enable incremental vacuum
    db.exec('PRAGMA optimize'); // Optimize query planner
    
    console.log('Database performance settings applied successfully');
    
  } catch (error) {
    console.error('Error applying database performance settings:', error);
    throw error;
  }
  
  dbInstance = db;
  return db;
}

export function getDatabase(): Database.Database {
  if (!dbInstance) {
    dbInstance = createDatabase();
  }
  return dbInstance;
}

export function closeDatabase(): void {
  if (dbInstance) {
    dbInstance.close();
    dbInstance = null;
    console.log('Database connection closed');
  }
}

// Graceful shutdown
process.on('exit', closeDatabase);
process.on('SIGINT', () => {
  closeDatabase();
  process.exit(0);
});
process.on('SIGTERM', () => {
  closeDatabase();
  process.exit(0);
});

// Database maintenance functions
export function runVacuum(db: Database.Database): void {
  console.log('Running VACUUM to optimize database...');
  const start = Date.now();
  db.exec('VACUUM');
  const duration = Date.now() - start;
  console.log(`VACUUM completed in ${duration}ms`);
}

export function runAnalyze(db: Database.Database): void {
  console.log('Running ANALYZE to update query statistics...');
  const start = Date.now();
  db.exec('ANALYZE');
  const duration = Date.now() - start;
  console.log(`ANALYZE completed in ${duration}ms`);
}

export function getDatabaseInfo(db: Database.Database) {
  try {
    const pageCountResult = db.prepare('PRAGMA page_count').get() as { page_count: number };
    const pageSizeResult = db.prepare('PRAGMA page_size').get() as { page_size: number };
    const freelistCountResult = db.prepare('PRAGMA freelist_count').get() as { freelist_count: number };
    const walModeResult = db.prepare('PRAGMA journal_mode').get() as { journal_mode: string };
    
    const totalPages = pageCountResult.page_count;
    const pageSize = pageSizeResult.page_size;
    const freePages = freelistCountResult.freelist_count;
    const journalMode = walModeResult.journal_mode;
    
    return {
      totalSize: totalPages * pageSize,
      totalPages,
      pageSize,
      freePages,
      usedPages: totalPages - freePages,
      journalMode,
      fragmentation: freePages / totalPages * 100,
    };
  } catch (error) {
    console.error('Error getting database info:', error);
    return null;
  }
}

// Backup functions
export function createBackup(db: Database.Database, backupPath: string): void {
  console.log(`Creating database backup at: ${backupPath}`);
  const start = Date.now();
  
  try {
    // Ensure backup directory exists
    const backupDir = path.dirname(backupPath);
    if (!require('fs').existsSync(backupDir)) {
      require('fs').mkdirSync(backupDir, { recursive: true });
    }
    
    db.backup(backupPath);
    const duration = Date.now() - start;
    console.log(`Backup completed in ${duration}ms`);
  } catch (error) {
    console.error('Error creating backup:', error);
    throw error;
  }
}

export function restoreFromBackup(backupPath: string, targetPath: string): void {
  console.log(`Restoring database from backup: ${backupPath} to ${targetPath}`);
  
  if (!require('fs').existsSync(backupPath)) {
    throw new Error(`Backup file not found: ${backupPath}`);
  }
  
  require('fs').copyFileSync(backupPath, targetPath);
  console.log('Database restored successfully');
}
