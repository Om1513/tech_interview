import { getDatabase } from './config';
import { insertInspectionsBatch, transformInspectionForDb } from './sqlite';
import { streamFromS3 } from '../s3-stream';
import { SewerInspection } from '../types';

export interface ImportProgress {
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

export interface ImportOptions {
  batchSize?: number;
  maxRetries?: number;
  onProgress?: (progress: ImportProgress) => void;
  onError?: (error: Error, record?: SewerInspection) => void;
  skipDuplicates?: boolean;
  validateData?: boolean;
}

const DEFAULT_OPTIONS: Required<ImportOptions> = {
  batchSize: 100,
  maxRetries: 3,
  onProgress: () => {},
  onError: () => {},
  skipDuplicates: true,
  validateData: true,
};

export class DataImporter {
  private db = getDatabase();
  private isRunning = false;
  private shouldStop = false;
  
  constructor(private options: ImportOptions = {}) {
    this.options = { ...DEFAULT_OPTIONS, ...options };
  }

  async importFromS3(fileName: string, resume: boolean = false): Promise<ImportProgress> {
    console.log(`Starting import from S3 file: ${fileName}${resume ? ' (resuming)' : ''}`);
    
    // Check if we can/should resume
    let offset = 0;
    let existingProgress = null;
    
    if (resume || canResumeImport(fileName)) {
      offset = calculateResumeOffset(fileName);
      if (offset > 0) {
        console.log(`🔄 Resuming import from record ${offset}`);
        // Get existing progress data
        const resumableImports = getResumableImports();
        existingProgress = resumableImports.find(imp => imp.source_file === fileName);
      }
    }
    
    const logId = existingProgress ? existingProgress.id : this.startImportLog(fileName);
    const progress: ImportProgress = {
      fileName,
      totalFiles: 1,
      currentFile: 1,
      recordsProcessed: existingProgress ? existingProgress.records_processed : offset,
      recordsImported: existingProgress ? existingProgress.records_imported : 0,
      errors: existingProgress ? existingProgress.errors : 0,
      status: 'running',
      startTime: existingProgress ? new Date(existingProgress.started_at) : new Date(),
    };
    
    this.isRunning = true;
    this.shouldStop = false;
    
    try {
      const chunkSize = 200; // Records per streaming chunk
      
      while (!this.shouldStop) {
        // Stream data in chunks
        const chunk = await streamFromS3(fileName, chunkSize, offset);
        
        if (chunk.length === 0) {
          // End of file reached
          break;
        }
        
        // Process chunk in batches
        const batches = this.createBatches(chunk, this.options.batchSize!);
        
        for (const batch of batches) {
          if (this.shouldStop) break;
          
          try {
            // Validate data if enabled
            const validBatch = this.options.validateData 
              ? batch.filter(record => this.validateRecord(record))
              : batch;
            
            // Filter duplicates if enabled
            const filteredBatch = this.options.skipDuplicates
              ? await this.filterDuplicates(validBatch)
              : validBatch;
            
            // Insert batch
            const insertedCount = insertInspectionsBatch(filteredBatch);
            
            progress.recordsProcessed += batch.length;
            progress.recordsImported += insertedCount;
            progress.errors += (batch.length - insertedCount);
            
            // Update progress
            this.options.onProgress!(progress);
            
            // Update import log
            this.updateImportLog(logId, progress);
            
          } catch (error) {
            console.error('Error processing batch:', error);
            progress.errors += batch.length;
            this.options.onError!(error as Error);
          }
        }
        
        offset += chunk.length;
        
        // If chunk was smaller than requested, we've reached the end
        if (chunk.length < chunkSize) {
          break;
        }
      }
      
      // Finalize import
      progress.status = this.shouldStop ? 'paused' : 'completed';
      progress.estimatedCompletion = new Date();
      
      this.completeImportLog(logId, progress);
      this.options.onProgress!(progress);
      
      console.log(`Import completed: ${progress.recordsImported} records imported, ${progress.errors} errors`);
      
    } catch (error) {
      console.error('Import failed:', error);
      progress.status = 'failed';
      progress.errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      this.completeImportLog(logId, progress, error as Error);
      this.options.onError!(error as Error);
    } finally {
      this.isRunning = false;
    }
    
    return progress;
  }

  /**
   * Resume a previously interrupted import
   */
  async resumeImport(fileName: string): Promise<ImportProgress> {
    if (!canResumeImport(fileName)) {
      throw new Error(`Cannot resume import for ${fileName} - no incomplete import found`);
    }
    
    console.log(`🔄 Resuming interrupted import for ${fileName}`);
    return this.importFromS3(fileName, true);
  }

  /**
   * Get list of imports that can be resumed
   */
  getResumableImports() {
    return getResumableImports();
  }

  async importAllFiles(progressCallback?: (progress: ImportProgress) => void): Promise<ImportProgress[]> {
    const files = [
      'sewer-inspections-part1.jsonl',
      'sewer-inspections-part2.jsonl',
      'sewer-inspections-part3.jsonl',
      'sewer-inspections-part4.jsonl',
      'sewer-inspections-part5.jsonl'
    ];
    
    const results: ImportProgress[] = [];
    
    for (let i = 0; i < files.length; i++) {
      if (this.shouldStop) break;
      
      const fileName = files[i];
      console.log(`Importing file ${i + 1}/${files.length}: ${fileName}`);
      
      // Create progress callback that includes file context
      const fileProgressCallback = (progress: ImportProgress) => {
        progress.totalFiles = files.length;
        progress.currentFile = i + 1;
        progressCallback?.(progress);
      };
      
      const importer = new DataImporter({
        ...this.options,
        onProgress: fileProgressCallback,
      });
      
      const result = await importer.importFromS3(fileName);
      results.push(result);
      
      if (result.status === 'failed') {
        console.error(`Failed to import ${fileName}, stopping import process`);
        break;
      }
    }
    
    return results;
  }

  async syncWithS3(lastSyncTime?: Date): Promise<ImportProgress[]> {
    console.log('Starting incremental sync with S3...');
    
    // For this implementation, we'll do a full sync
    // In a real system, you'd check file modification times or use a change log
    return this.importAllFiles();
  }

  stop(): void {
    console.log('Stopping import process...');
    this.shouldStop = true;
  }

  isImportRunning(): boolean {
    return this.isRunning;
  }

  // Private helper methods
  private createBatches<T>(array: T[], batchSize: number): T[][] {
    const batches: T[][] = [];
    for (let i = 0; i < array.length; i += batchSize) {
      batches.push(array.slice(i, i + batchSize));
    }
    return batches;
  }

  private validateRecord(record: SewerInspection): boolean {
    try {
      // Basic validation
      if (!record.id || !record.location?.city || !record.location?.state) {
        console.warn(`Invalid record: missing required fields`, record.id);
        return false;
      }
      
      if (!record.pipe?.material || record.pipe?.diameter_in === undefined) {
        console.warn(`Invalid record: missing pipe data`, record.id);
        return false;
      }
      
      if (record.inspection_score === undefined || record.requires_repair === undefined) {
        console.warn(`Invalid record: missing inspection data`, record.id);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Error validating record:', error);
      return false;
    }
  }

  private async filterDuplicates(records: SewerInspection[]): Promise<SewerInspection[]> {
    if (records.length === 0) return records;
    
    try {
      // Get existing IDs from database
      const ids = records.map(r => r.id);
      const placeholders = ids.map(() => '?').join(',');
      const existingIds = this.db
        .prepare(`SELECT id FROM inspections WHERE id IN (${placeholders})`)
        .all(ids)
        .map((row: any) => row.id);
      
      const existingIdSet = new Set(existingIds);
      
      // Filter out duplicates
      const newRecords = records.filter(record => !existingIdSet.has(record.id));
      
      if (newRecords.length < records.length) {
        const duplicateCount = records.length - newRecords.length;
        console.log(`Filtered out ${duplicateCount} duplicate records`);
      }
      
      return newRecords;
    } catch (error) {
      console.error('Error filtering duplicates:', error);
      return records; // Return all records if filtering fails
    }
  }

  private startImportLog(fileName: string): number {
    const stmt = this.db.prepare(`
      INSERT INTO import_log (source_file, started_at, status)
      VALUES (?, ?, 'running')
    `);
    
    const result = stmt.run(fileName, new Date().toISOString());
    return result.lastInsertRowid as number;
  }

  private updateImportLog(logId: number, progress: ImportProgress): void {
    const stmt = this.db.prepare(`
      UPDATE import_log 
      SET records_processed = ?, records_imported = ?, errors = ?, status = ?
      WHERE id = ?
    `);
    
    stmt.run(
      progress.recordsProcessed,
      progress.recordsImported,
      progress.errors,
      progress.status,
      logId
    );
  }

  private completeImportLog(logId: number, progress: ImportProgress, error?: Error): void {
    const stmt = this.db.prepare(`
      UPDATE import_log 
      SET completed_at = ?, records_processed = ?, records_imported = ?, 
          errors = ?, status = ?, error_message = ?
      WHERE id = ?
    `);
    
    stmt.run(
      new Date().toISOString(),
      progress.recordsProcessed,
      progress.recordsImported,
      progress.errors,
      progress.status,
      error ? error.message : null,
      logId
    );
  }
}

// Utility functions for validation
export function validateImportedData(): Promise<{ isValid: boolean; errors: string[] }> {
  return new Promise((resolve) => {
    const db = getDatabase();
    const errors: string[] = [];
    
    try {
      // Check for required fields
      const missingCity = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE city IS NULL OR city = ''").get() as { count: number };
      if (missingCity.count > 0) {
        errors.push(`${missingCity.count} records missing city`);
      }
      
      const missingState = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE state IS NULL OR state = ''").get() as { count: number };
      if (missingState.count > 0) {
        errors.push(`${missingState.count} records missing state`);
      }
      
      const missingMaterial = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE material IS NULL OR material = ''").get() as { count: number };
      if (missingMaterial.count > 0) {
        errors.push(`${missingMaterial.count} records missing material`);
      }
      
      // Check for invalid scores
      const invalidScores = db.prepare("SELECT COUNT(*) as count FROM inspections WHERE inspection_score < 0 OR inspection_score > 100").get() as { count: number };
      if (invalidScores.count > 0) {
        errors.push(`${invalidScores.count} records with invalid inspection scores`);
      }
      
      // Check for orphaned defects
      const orphanedDefects = db.prepare(`
        SELECT COUNT(*) as count FROM defects d 
        LEFT JOIN inspections i ON d.inspection_id = i.id 
        WHERE i.id IS NULL
      `).get() as { count: number };
      if (orphanedDefects.count > 0) {
        errors.push(`${orphanedDefects.count} orphaned defects`);
      }
      
      resolve({
        isValid: errors.length === 0,
        errors
      });
      
    } catch (error) {
      console.error('Error validating imported data:', error);
      resolve({
        isValid: false,
        errors: ['Validation failed due to database error']
      });
    }
  });
}

// Progress estimation utilities
export function estimateImportTime(recordsRemaining: number, recordsPerSecond: number): Date {
  const secondsRemaining = recordsRemaining / recordsPerSecond;
  return new Date(Date.now() + secondsRemaining * 1000);
}

export function getImportHistory(limit: number = 10) {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM import_log 
    ORDER BY started_at DESC 
    LIMIT ?
  `);
  
  return stmt.all(limit);
}

/**
 * Get incomplete imports that can be resumed
 */
export function getResumableImports() {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT * FROM import_log 
    WHERE status IN ('running', 'paused', 'failed') 
    AND completed_at IS NULL
    ORDER BY started_at DESC
  `);
  
  return stmt.all();
}

/**
 * Calculate the offset to resume from based on import log
 */
export function calculateResumeOffset(fileName: string): number {
  const db = getDatabase();
  
  const stmt = db.prepare(`
    SELECT records_processed FROM import_log 
    WHERE source_file = ? AND status IN ('running', 'paused', 'failed')
    ORDER BY started_at DESC 
    LIMIT 1
  `);
  
  const result = stmt.get(fileName) as { records_processed: number } | undefined;
  return result ? result.records_processed : 0;
}

/**
 * Check if a file import can be resumed
 */
export function canResumeImport(fileName: string): boolean {
  const offset = calculateResumeOffset(fileName);
  return offset > 0;
}

export function clearImportHistory(olderThanDays: number = 30): number {
  const db = getDatabase();
  const cutoffDate = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
  
  const stmt = db.prepare(`
    DELETE FROM import_log 
    WHERE started_at < ? AND status IN ('completed', 'failed')
  `);
  
  const result = stmt.run(cutoffDate.toISOString());
  return result.changes;
}
