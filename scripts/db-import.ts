#!/usr/bin/env ts-node

import { Command } from 'commander';
import { DataImporter, validateImportedData, getImportHistory, clearImportHistory, getResumableImports, canResumeImport } from '../lib/database/importer';
import { initializeDatabase, getDatabaseStats, getUniqueValues } from '../lib/database/sqlite';
import { createDatabase, getDatabaseInfo, runVacuum, runAnalyze, createBackup } from '../lib/database/config';
import path from 'path';

const program = new Command();

program
  .name('db-import')
  .description('Database management CLI for sewer inspection data')
  .version('1.0.0');

// Import commands
program
  .command('import')
  .description('Import data from S3')
  .option('-f, --file <fileName>', 'Import specific file')
  .option('-b, --batch-size <size>', 'Batch size for processing', '100')
  .option('--no-validate', 'Skip data validation')
  .option('--no-skip-duplicates', 'Don\'t skip duplicate records')
  .action(async (options) => {
    console.log('🚀 Starting data import...');
    
    try {
      // Initialize database
      initializeDatabase();
      
      const importer = new DataImporter({
        batchSize: parseInt(options.batchSize),
        validateData: options.validate,
        skipDuplicates: options.skipDuplicates,
        onProgress: (progress) => {
          const percent = progress.recordsProcessed > 0 
            ? ((progress.recordsImported / progress.recordsProcessed) * 100).toFixed(1)
            : '0.0';
          console.log(`📊 Progress: ${progress.recordsImported}/${progress.recordsProcessed} (${percent}%) - ${progress.errors} errors`);
        },
        onError: (error, record) => {
          console.error(`❌ Error processing record ${record?.id || 'unknown'}:`, error.message);
        }
      });
      
      let results;
      
      if (options.file) {
        console.log(`📁 Importing file: ${options.file}`);
        results = await importer.importFromS3(options.file);
        console.log(`✅ Import completed: ${results.recordsImported} records imported, ${results.errors} errors`);
      } else {
        console.log('📁 Importing all files...');
        results = await importer.importAllFiles((progress) => {
          console.log(`📁 File ${progress.currentFile}/${progress.totalFiles}: ${progress.fileName}`);
        });
        
        const totalImported = results.reduce((sum, r) => sum + r.recordsImported, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
        console.log(`✅ All imports completed: ${totalImported} records imported, ${totalErrors} errors`);
      }
      
    } catch (error) {
      console.error('❌ Import failed:', error);
      process.exit(1);
    }
  });

// Resume command
program
  .command('resume')
  .description('Resume interrupted imports')
  .option('-f, --file <fileName>', 'Resume specific file import')
  .option('-l, --list', 'List resumable imports')
  .action(async (options) => {
    try {
      // Initialize database
      initializeDatabase();
      
      if (options.list) {
        console.log('📋 Resumable Imports\n');
        const resumableImports = getResumableImports();
        
        if (resumableImports.length === 0) {
          console.log('✅ No interrupted imports found');
          return;
        }
        
        resumableImports.forEach((imp: any, index: number) => {
          console.log(`${index + 1}. ${imp.source_file}`);
          console.log(`   Status: ${imp.status}`);
          console.log(`   Started: ${new Date(imp.started_at).toLocaleString()}`);
          console.log(`   Progress: ${imp.records_imported}/${imp.records_processed} records`);
          console.log(`   Errors: ${imp.errors}`);
          console.log('');
        });
        return;
      }
      
      if (options.file) {
        if (!canResumeImport(options.file)) {
          console.log(`❌ Cannot resume ${options.file} - no incomplete import found`);
          return;
        }
        
        console.log(`🔄 Resuming import for ${options.file}...`);
        
        const importer = new DataImporter({
          onProgress: (progress) => {
            const percent = progress.recordsProcessed > 0 
              ? ((progress.recordsImported / progress.recordsProcessed) * 100).toFixed(1)
              : '0.0';
            console.log(`📊 Progress: ${progress.recordsImported}/${progress.recordsProcessed} (${percent}%) - ${progress.errors} errors`);
          },
          onError: (error, record) => {
            console.error(`❌ Error processing record ${record?.id || 'unknown'}:`, error.message);
          }
        });
        
        const result = await importer.resumeImport(options.file);
        console.log(`✅ Resume completed: ${result.recordsImported} total records imported, ${result.errors} errors`);
        
      } else {
        // Resume all incomplete imports
        const resumableImports = getResumableImports();
        
        if (resumableImports.length === 0) {
          console.log('✅ No interrupted imports found');
          return;
        }
        
        console.log(`🔄 Resuming ${resumableImports.length} interrupted imports...`);
        
        const importer = new DataImporter({
          onProgress: (progress) => {
            const percent = progress.recordsProcessed > 0 
              ? ((progress.recordsImported / progress.recordsProcessed) * 100).toFixed(1)
              : '0.0';
            console.log(`📊 ${progress.fileName}: ${progress.recordsImported}/${progress.recordsProcessed} (${percent}%) - ${progress.errors} errors`);
          }
        });
        
        for (const imp of resumableImports) {
          try {
            console.log(`\n🔄 Resuming ${imp.source_file}...`);
            const result = await importer.resumeImport(imp.source_file);
            console.log(`✅ ${imp.source_file} completed: ${result.recordsImported} records, ${result.errors} errors`);
          } catch (error) {
            console.error(`❌ Failed to resume ${imp.source_file}:`, error);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ Resume failed:', error);
      process.exit(1);
    }
  });

// Status command
program
  .command('status')
  .description('Show database status and statistics')
  .action(async () => {
    try {
      console.log('📊 Database Status\n');
      
      // Initialize database
      initializeDatabase();
      const db = createDatabase();
      
      // Get basic stats
      const stats = getDatabaseStats();
      if (stats) {
        console.log('📈 Record Counts:');
        console.log(`  Inspections: ${stats.inspections.toLocaleString()}`);
        console.log(`  Defects: ${stats.defects.toLocaleString()}`);
        console.log(`  Import Logs: ${stats.importLogs}`);
        console.log();
        
        if (stats.lastImport) {
          console.log('🕐 Last Import:');
          console.log(`  File: ${(stats.lastImport as any).source_file}`);
          console.log(`  Status: ${(stats.lastImport as any).status}`);
          console.log(`  Records: ${(stats.lastImport as any).records_imported}/${(stats.lastImport as any).records_processed}`);
          console.log(`  Started: ${new Date((stats.lastImport as any).started_at).toLocaleString()}`);
          console.log();
        }
      }
      
      // Get database file info
      const dbInfo = getDatabaseInfo(db);
      if (dbInfo) {
        console.log('💾 Database File:');
        console.log(`  Total Size: ${(dbInfo.totalSize / 1024 / 1024).toFixed(2)} MB`);
        console.log(`  Pages: ${dbInfo.totalPages.toLocaleString()} (${dbInfo.pageSize} bytes each)`);
        console.log(`  Used Pages: ${dbInfo.usedPages.toLocaleString()}`);
        console.log(`  Free Pages: ${dbInfo.freePages.toLocaleString()}`);
        console.log(`  Fragmentation: ${dbInfo.fragmentation.toFixed(2)}%`);
        console.log(`  Journal Mode: ${dbInfo.journalMode}`);
        console.log();
      }
      
      // Show unique values
      console.log('🏙️ Data Distribution:');
      const cities = getUniqueValues('city');
      const states = getUniqueValues('state');
      const materials = getUniqueValues('material');
      
      console.log(`  Cities: ${cities.length}`);
      console.log(`  States: ${states.length}`);
      console.log(`  Materials: ${materials.length}`);
      
    } catch (error) {
      console.error('❌ Failed to get status:', error);
      process.exit(1);
    }
  });

// Validate command
program
  .command('validate')
  .description('Validate imported data integrity')
  .action(async () => {
    console.log('🔍 Validating imported data...\n');
    
    try {
      const validation = await validateImportedData();
      
      if (validation.isValid) {
        console.log('✅ Data validation passed - no issues found');
      } else {
        console.log('❌ Data validation found issues:');
        validation.errors.forEach(error => {
          console.log(`  • ${error}`);
        });
      }
      
    } catch (error) {
      console.error('❌ Validation failed:', error);
      process.exit(1);
    }
  });

// History command
program
  .command('history')
  .description('Show import history')
  .option('-l, --limit <number>', 'Number of entries to show', '10')
  .action(async (options) => {
    try {
      console.log('📜 Import History\n');
      
      const history = getImportHistory(parseInt(options.limit));
      
      if (history.length === 0) {
        console.log('No import history found');
        return;
      }
      
      history.forEach((entry: any, index: number) => {
        const status = entry.status === 'completed' ? '✅' : 
                     entry.status === 'failed' ? '❌' : 
                     entry.status === 'running' ? '🔄' : '⏸️';
        
        console.log(`${index + 1}. ${status} ${entry.source_file}`);
        console.log(`   Started: ${new Date(entry.started_at).toLocaleString()}`);
        if (entry.completed_at) {
          const duration = new Date(entry.completed_at).getTime() - new Date(entry.started_at).getTime();
          console.log(`   Duration: ${(duration / 1000).toFixed(1)}s`);
        }
        console.log(`   Records: ${entry.records_imported}/${entry.records_processed} (${entry.errors} errors)`);
        if (entry.error_message) {
          console.log(`   Error: ${entry.error_message}`);
        }
        console.log();
      });
      
    } catch (error) {
      console.error('❌ Failed to get history:', error);
      process.exit(1);
    }
  });

// Reset command
program
  .command('reset')
  .description('Reset database (delete all data)')
  .option('--confirm', 'Confirm the reset operation')
  .action(async (options) => {
    if (!options.confirm) {
      console.log('⚠️  This will delete ALL data from the database!');
      console.log('Use --confirm flag to proceed: npm run db:reset -- --confirm');
      return;
    }
    
    try {
      console.log('🗑️  Resetting database...');
      
      const db = createDatabase();
      
      // Delete all data
      db.exec('DELETE FROM defects');
      db.exec('DELETE FROM inspections');
      db.exec('DELETE FROM import_log');
      
      // Reset auto-increment counters
      db.exec('DELETE FROM sqlite_sequence');
      
      // Vacuum to reclaim space
      runVacuum(db);
      
      console.log('✅ Database reset completed');
      
    } catch (error) {
      console.error('❌ Reset failed:', error);
      process.exit(1);
    }
  });

// Maintenance commands
program
  .command('vacuum')
  .description('Run VACUUM to optimize database')
  .action(async () => {
    try {
      console.log('🧹 Running database vacuum...');
      
      const db = createDatabase();
      runVacuum(db);
      
      console.log('✅ Vacuum completed');
      
    } catch (error) {
      console.error('❌ Vacuum failed:', error);
      process.exit(1);
    }
  });

program
  .command('analyze')
  .description('Run ANALYZE to update query statistics')
  .action(async () => {
    try {
      console.log('📊 Running database analysis...');
      
      const db = createDatabase();
      runAnalyze(db);
      
      console.log('✅ Analysis completed');
      
    } catch (error) {
      console.error('❌ Analysis failed:', error);
      process.exit(1);
    }
  });

// Backup command
program
  .command('backup')
  .description('Create database backup')
  .option('-p, --path <path>', 'Backup file path')
  .action(async (options) => {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backupPath = options.path || path.join(process.cwd(), 'backups', `inspections-${timestamp}.db`);
      
      console.log(`💾 Creating backup: ${backupPath}`);
      
      const db = createDatabase();
      createBackup(db, backupPath);
      
      console.log('✅ Backup completed');
      
    } catch (error) {
      console.error('❌ Backup failed:', error);
      process.exit(1);
    }
  });

// Cleanup command
program
  .command('cleanup')
  .description('Clean up old import logs')
  .option('-d, --days <days>', 'Delete logs older than N days', '30')
  .action(async (options) => {
    try {
      const days = parseInt(options.days);
      console.log(`🧹 Cleaning up import logs older than ${days} days...`);
      
      const deletedCount = clearImportHistory(days);
      
      console.log(`✅ Cleanup completed: ${deletedCount} old entries removed`);
      
    } catch (error) {
      console.error('❌ Cleanup failed:', error);
      process.exit(1);
    }
  });

// Parse command line arguments
program.parse();

// Handle case where no command is provided
if (!process.argv.slice(2).length) {
  program.outputHelp();
}
