import { SewerInspection } from './types';

export async function streamFromS3(fileName: string, limit = 10): Promise<SewerInspection[]> {
  // Use direct HTTPS URL for public S3 bucket access
  const url = `https://sewerai-public.s3.us-west-2.amazonaws.com/${fileName}`;
  
  console.log(`Fetching from URL: ${url}`);
  
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
  let count = 0;
  
  console.log(`Starting S3 stream for file: ${fileName}, limit: ${limit}`);
  
  try {
    while (true) {
      const { done, value } = await reader.read();
      
      if (done) break;
      
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // Keep the incomplete line in buffer
      
      for (const line of lines) {
        if (line.trim() && count < limit) {
          try {
            const parsed = JSON.parse(line) as SewerInspection;
            results.push(parsed);
            count++;
            
            if (count % 5 === 0) {
              console.log(`Processed ${count} records so far...`);
            }
          } catch (err) {
            console.error('Parse error for line:', line.substring(0, 100), 'Error:', err);
          }
        }
      }
      
      if (count >= limit) {
        console.log(`Reached limit of ${limit} records, stopping stream`);
        break;
      }
    }
    
    // Process any remaining complete line in buffer
    if (buffer.trim() && count < limit) {
      try {
        const parsed = JSON.parse(buffer) as SewerInspection;
        results.push(parsed);
        count++;
      } catch (err) {
        console.error('Parse error for final buffer:', buffer.substring(0, 100), 'Error:', err);
      }
    }
    
    console.log(`Successfully processed ${results.length} records from S3`);
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
