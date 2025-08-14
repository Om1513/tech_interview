import { NextResponse } from "next/server";
import { DataImporter, ImportProgress } from "@/lib/database/importer";
import { initializeDatabase, getDatabaseStats } from "@/lib/database/sqlite";
import { validateImportedData, getImportHistory } from "@/lib/database/importer";

// Global import instance to track progress
let currentImporter: DataImporter | null = null;
let currentProgress: ImportProgress | null = null;

export async function POST(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'start';
  
  try {
    switch (action) {
      case 'start':
        return await startImport(request);
      case 'stop':
        return await stopImport();
      case 'status':
        return await getImportStatus();
      case 'validate':
        return await validateData();
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: start, stop, status, or validate' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { 
        error: 'Import operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const action = searchParams.get('action') || 'status';
  
  try {
    switch (action) {
      case 'status':
        return await getImportStatus();
      case 'history':
        return await getImportHistoryData(request);
      case 'stats':
        return await getDatabaseStatsData();
      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: status, history, or stats' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Import API error:', error);
    return NextResponse.json(
      { 
        error: 'Import operation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}

async function startImport(request: Request): Promise<NextResponse> {
  if (currentImporter && currentImporter.isImportRunning()) {
    return NextResponse.json(
      { error: 'Import is already running' },
      { status: 409 }
    );
  }
  
  const body = await request.json().catch(() => ({}));
  const { 
    fileName, 
    batchSize = 100, 
    validateData = true, 
    skipDuplicates = true 
  } = body;
  
  console.log('Starting data import...', { fileName, batchSize, validateData, skipDuplicates });
  
  // Initialize database
  initializeDatabase();
  
  // Create new importer
  currentImporter = new DataImporter({
    batchSize,
    validateData,
    skipDuplicates,
    onProgress: (progress) => {
      currentProgress = progress;
      console.log(`Import progress: ${progress.recordsImported}/${progress.recordsProcessed} (${progress.errors} errors)`);
    },
    onError: (error, record) => {
      console.error('Import error:', error.message, record?.id);
    }
  });
  
  // Start import (async)
  if (fileName) {
    // Import single file
    currentImporter.importFromS3(fileName).then(
      (finalProgress) => {
        currentProgress = finalProgress;
        console.log('Import completed:', finalProgress);
      }
    ).catch(
      (error) => {
        console.error('Import failed:', error);
        if (currentProgress) {
          currentProgress.status = 'failed';
          currentProgress.errorMessage = error.message;
        }
      }
    );
  } else {
    // Import all files
    currentImporter.importAllFiles((progress) => {
      currentProgress = progress;
    }).then(
      (results) => {
        const totalImported = results.reduce((sum, r) => sum + r.recordsImported, 0);
        const totalErrors = results.reduce((sum, r) => sum + r.errors, 0);
        console.log(`All imports completed: ${totalImported} records imported, ${totalErrors} errors`);
      }
    ).catch(
      (error) => {
        console.error('Import failed:', error);
        if (currentProgress) {
          currentProgress.status = 'failed';
          currentProgress.errorMessage = error.message;
        }
      }
    );
  }
  
  return NextResponse.json({
    message: 'Import started successfully',
    importId: Date.now(), // Simple ID for tracking
    progress: currentProgress
  });
}

async function stopImport(): Promise<NextResponse> {
  if (!currentImporter || !currentImporter.isImportRunning()) {
    return NextResponse.json(
      { error: 'No import is currently running' },
      { status: 404 }
    );
  }
  
  currentImporter.stop();
  
  return NextResponse.json({
    message: 'Import stop requested',
    progress: currentProgress
  });
}

async function getImportStatus(): Promise<NextResponse> {
  const isRunning = currentImporter?.isImportRunning() || false;
  
  return NextResponse.json({
    isRunning,
    progress: currentProgress,
    message: isRunning ? 'Import in progress' : 'No import running'
  });
}

async function validateData(): Promise<NextResponse> {
  console.log('Validating imported data...');
  
  const validation = await validateImportedData();
  
  return NextResponse.json({
    validation,
    message: validation.isValid ? 'Data validation passed' : 'Data validation found issues'
  });
}

async function getImportHistoryData(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get('limit') || '10');
  
  const history = getImportHistory(limit);
  
  return NextResponse.json({
    history,
    count: history.length
  });
}

async function getDatabaseStatsData(): Promise<NextResponse> {
  const stats = getDatabaseStats();
  
  return NextResponse.json({
    stats,
    message: stats ? 'Database statistics retrieved' : 'Unable to retrieve statistics'
  });
}
