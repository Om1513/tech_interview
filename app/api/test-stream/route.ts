import { NextResponse } from "next/server";
import { streamFromS3, testStreamFromS3 } from "@/lib/s3-stream";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const fileName = searchParams.get('file') || 'sewer_inspections.jsonl';
  const limit = parseInt(searchParams.get('limit') || '10');

  console.log(`Testing S3 stream for file: ${fileName}, limit: ${limit}`);

  try {
    // Use the test wrapper for better error handling
    const result = await testStreamFromS3(fileName, limit);
    
    if (!result.success) {
      console.error('S3 streaming failed:', result.error);
      return NextResponse.json({
        error: result.error,
        recordsProcessed: result.recordsProcessed
      }, { status: 500 });
    }

    console.log(`Successfully streamed ${result.recordsProcessed} records`);
    
    return NextResponse.json({
      success: true,
      fileName,
      recordsProcessed: result.recordsProcessed,
      data: result.data,
      memoryUsage: process.memoryUsage()
    });

  } catch (error) {
    console.error('Unexpected error in test-stream:', error);
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

// Optional: Add POST method to test with different parameters
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { fileName = 'sewer_inspections.jsonl', limit = 10 } = body;

    console.log(`POST test stream for file: ${fileName}, limit: ${limit}`);
    
    const data = await streamFromS3(fileName, limit);
    
    return NextResponse.json({
      success: true,
      fileName,
      recordsProcessed: data.length,
      data,
      memoryUsage: process.memoryUsage()
    });

  } catch (error) {
    console.error('POST test-stream error:', error);
    return NextResponse.json({
      error: 'Failed to stream from S3',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
