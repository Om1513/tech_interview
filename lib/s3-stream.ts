import { SewerInspection } from './types';

export async function streamFromS3(fileName: string, limit = 10, offset = 0): Promise<SewerInspection[]> {
  // Use direct HTTPS URL for public S3 bucket access
  const url = `https://sewerai-public.s3.us-west-2.amazonaws.com/${fileName}`;
  
  console.log(`Fetching from URL: ${url}, offset: ${offset}, limit: ${limit}`);
  
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch from S3: ${response.status} ${response.statusText}`);
  }
  
  if (!response.body) {
    throw new Error('No response body received from S3');
  }
  
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  
  let buffer = '';
  const results: SewerInspection[] = [];
  let recordsProcessed = 0;
  let recordsSkipped = 0;
  let resultsCollected = 0;
  
  console.log(`Starting S3 stream for file: ${fileName}, offset: ${offset}, limit: ${limit}`);
  
  try {
    let chunkCount = 0;
    const maxBufferSize = 64 * 1024; // 64KB buffer limit to prevent memory bloat
    
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      chunkCount++;
      buffer += decoder.decode(value, { stream: true });
      
      // Process buffer when it gets large or we have complete lines
      if (buffer.length > maxBufferSize || buffer.includes('\n')) {
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep the incomplete line in buffer
        
        for (const line of lines) {
          if (line.trim()) {
            recordsProcessed++;
            
            // Skip records until we reach the offset
            if (recordsSkipped < offset) {
              recordsSkipped++;
              continue;
            }
            
            // Collect results up to the limit
            if (resultsCollected < limit) {
              try {
                const parsed = JSON.parse(line) as SewerInspection;
                results.push(parsed);
                resultsCollected++;
                
                // Less frequent progress logging to reduce overhead
                if (resultsCollected % 50 === 0) {
                  console.log(`Collected ${resultsCollected} results so far...`);
                }
              } catch (err) {
                console.error('Parse error for line:', line.substring(0, 50), 'Error:', err);
              }
            } else {
              // We have enough results, stop processing immediately
              console.log(`Reached limit of ${limit} results, stopping stream at record ${recordsProcessed}`);
              return results; // Early exit to save memory and processing
            }
          }
        }
        
        // Memory pressure relief - hint for garbage collection
        if (chunkCount % 100 === 0 && global.gc) {
          global.gc();
        }
      }
      
      // Stop if we have enough results
      if (resultsCollected >= limit) {
        break;
      }
    }
    
    // Process any remaining complete line in buffer
    if (buffer.trim() && resultsCollected < limit && recordsSkipped >= offset) {
      try {
        const parsed = JSON.parse(buffer) as SewerInspection;
        results.push(parsed);
        resultsCollected++;
        recordsProcessed++;
      } catch (err) {
        console.error('Parse error for final buffer:', buffer.substring(0, 100), 'Error:', err);
      }
    }
    
    console.log(`Stream completed: processed ${recordsProcessed} records, skipped ${recordsSkipped}, collected ${results.length} results`);
    return results;
    
  } catch (error) {
    console.error('S3 streaming error:', error);
    throw new Error(`Failed to stream from S3: ${error instanceof Error ? error.message : 'Unknown error'}`);
  } finally {
    reader.releaseLock();
  }
}

export interface StreamResult {
  success: boolean;
  data?: SewerInspection[];
  error?: string;
  recordsProcessed: number;
}

export async function testStreamFromS3(fileName: string, limit = 10): Promise<StreamResult> {
  try {
    const data = await streamFromS3(fileName, limit);
    return {
      success: true,
      data,
      recordsProcessed: data.length
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown streaming error',
      recordsProcessed: 0
    };
  }
}
