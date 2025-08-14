import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDataContext, createFocusedPrompt } from "@/lib/ai-context";
import { generateSQLFromPrompt } from "@/lib/query-generator";
import { executeMultipleQueries, executeSafeQuery } from "@/lib/database/query-executor";
import { buildIntelligentContext, determineContextStrategy } from "@/lib/intelligent-context";

// Initialize OpenAI client for GPT-5
// GPT-5 Pricing: $1.25 per million input tokens, $10 per million output tokens
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('query');
  
  if (!query) {
    return new Response(
      `data: ${JSON.stringify({ error: "Query parameter is required" })}\n\n`,
      {
        status: 400,
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      }
    );
  }

  console.log('Chat API called with query:', query);

  // Create the streaming response
  const stream = new ReadableStream({
    async start(controller) {
      try {
        // Send initial status
        controller.enqueue(`data: ${JSON.stringify({ content: "🔍 Analyzing your question...\n" })}\n\n`);
        
        let contextData;
        let focusedPrompt;
        
        try {
          // NEW: AI-Powered SQL Generation Pipeline
          controller.enqueue(`data: ${JSON.stringify({ content: "🧠 Generating SQL queries from your question...\n" })}\n\n`);
          
          const sqlGeneration = await generateSQLFromPrompt(query);
          
          controller.enqueue(`data: ${JSON.stringify({ content: `✅ Generated ${sqlGeneration.queries.length} optimized ${sqlGeneration.queries.length === 1 ? 'query' : 'queries'}\n` })}\n\n`);
          
          // Execute generated SQL queries
          controller.enqueue(`data: ${JSON.stringify({ content: "⚡ Executing database queries...\n" })}\n\n`);
          
          const queryResults = await executeMultipleQueries(sqlGeneration.queries);
          
          const totalRows = queryResults.reduce((sum, result) => sum + result.metadata.rowCount, 0);
          controller.enqueue(`data: ${JSON.stringify({ content: `📊 Retrieved ${totalRows} records from database\n` })}\n\n`);
          
          // Build intelligent context based on query results
          controller.enqueue(`data: ${JSON.stringify({ content: "🎯 Building intelligent context for analysis...\n" })}\n\n`);
          
          contextData = buildIntelligentContext(queryResults, query, sqlGeneration.contextStrategy);
          
          // Create optimized prompt for final AI analysis
          focusedPrompt = createIntelligentPrompt(query, contextData, sqlGeneration);
          
        } catch (sqlError) {
          console.warn('SQL generation failed, falling back to legacy method:', sqlError);
          controller.enqueue(`data: ${JSON.stringify({ content: "⚠️ Using legacy search method...\n" })}\n\n`);
          
          // Fallback to existing method
          contextData = await getDataContext(query);
          focusedPrompt = createFocusedPrompt(query, contextData);
        }
        
        controller.enqueue(`data: ${JSON.stringify({ content: "🤖 Generating analysis...\n\n" })}\n\n`);
        
                 // Create OpenAI completion with streaming using GPT-5
         const completion = await openai.chat.completions.create({
           model: "gpt-5",
           messages: [
             {
               role: "system",
               content: `You are an expert sewer infrastructure analyst. Analyze the provided inspection data and give specific, data-driven answers. When possible, include:
- Exact numbers and statistics
- Specific pipe IDs or locations
- Actionable insights
- Comparisons between different aspects of the data

Always base your answers strictly on the provided data. If the data doesn't contain enough information to answer the question, say so clearly.`
             },
             {
               role: "user",
               content: focusedPrompt
             }
           ],
           stream: true,
         });
        
        // Stream the response with backpressure handling
        try {
          let tokenCount = 0;
          const maxTokensPerSecond = 100; // Rate limit for smooth streaming
          let lastTokenTime = Date.now();
          
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              tokenCount += content.split(' ').length; // Rough token count
              
              // Implement backpressure - pause if streaming too fast
              if (tokenCount > maxTokensPerSecond) {
                const timeDiff = Date.now() - lastTokenTime;
                if (timeDiff < 1000) {
                  await new Promise(resolve => setTimeout(resolve, 50)); // Small delay
                }
                tokenCount = 0;
                lastTokenTime = Date.now();
              }
              
              // Check if controller is still writable before enqueuing
              if (controller.desiredSize !== null && controller.desiredSize > 0) {
                controller.enqueue(`data: ${JSON.stringify({ content })}\n\n`);
              } else {
                // Client may have disconnected, implement graceful degradation
                console.log('Stream backpressure detected, slowing down...');
                await new Promise(resolve => setTimeout(resolve, 100));
              }
            }
          }
          
          // Send completion signal
          controller.enqueue(`data: ${JSON.stringify({ done: true })}\n\n`);
        } catch (streamError) {
          console.error('Streaming error:', streamError);
          if (!controller.desiredSize === null) {
            controller.enqueue(`data: ${JSON.stringify({ error: 'Streaming interrupted' })}\n\n`);
          }
        } finally {
          try {
            controller.close();
          } catch (closeError) {
            console.error('Controller close error:', closeError);
          }
        }
        
      } catch (error) {
        console.error('Chat API error:', error);
        
        let errorMessage = 'Sorry, I encountered an error while analyzing the data.';
        
                 if (error instanceof Error) {
           if (error.message.includes('API key')) {
             errorMessage = 'OpenAI API key is not configured properly for GPT-5 access.';
           } else if (error.message.includes('quota') || error.message.includes('billing')) {
             errorMessage = 'OpenAI API quota exceeded or billing issue. GPT-5 requires sufficient credits.';
           } else if (error.message.includes('rate limit')) {
             errorMessage = 'Too many requests. Please wait a moment and try again.';
           } else if (error.message.includes('model') || error.message.includes('gpt-5')) {
             errorMessage = 'GPT-5 model access error. Please ensure your API key has GPT-5 access.';
           }
         }
        
        try {
          controller.enqueue(`data: ${JSON.stringify({ 
            error: errorMessage,
            details: error instanceof Error ? error.message : 'Unknown error'
          })}\n\n`);
        } catch (enqueueError) {
          console.error('Error enqueue failed:', enqueueError);
        }
        
        try {
          controller.close();
        } catch (closeError) {
          console.error('Controller close error in catch:', closeError);
        }
      }
    }
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}

/**
 * Create an intelligent prompt based on SQL query results and strategy
 */
function createIntelligentPrompt(query: string, contextData: any, sqlGeneration: any): string {
  const { contextStrategy } = sqlGeneration;
  
  // Base prompt with query and strategy
  let prompt = `Query: ${query}\nContext Strategy: ${contextStrategy}\n\n`;
  
  // Add SQL query explanation for transparency
  if (sqlGeneration.queries.length > 0) {
    prompt += `SQL Queries Generated:\n`;
    sqlGeneration.queries.forEach((q: any, i: number) => {
      prompt += `${i + 1}. ${q.purpose}\n`;
    });
    prompt += `\n`;
  }
  
  // Strategy-specific context formatting
  switch (contextStrategy) {
    case 'statistical':
      prompt += formatStatisticalContext(contextData);
      break;
      
    case 'comparative':
      prompt += formatComparativeContext(contextData);
      break;
      
    case 'temporal':
      prompt += formatTemporalContext(contextData);
      break;
      
    case 'detailed':
    default:
      prompt += formatDetailedContext(contextData);
      break;
  }
  
  return prompt;
}

function formatStatisticalContext(contextData: any): string {
  const { summary } = contextData;
  
  let context = `Statistical Analysis Data:\n`;
  context += `- Total Records Analyzed: ${summary.totalRecords}\n`;
  
  if (summary.aggregatedResults) {
    context += `- Aggregated Results:\n`;
    Object.entries(summary.aggregatedResults).forEach(([key, value]) => {
      context += `  ${key}: ${JSON.stringify(value)}\n`;
    });
  }
  
  return context;
}

function formatComparativeContext(contextData: any): string {
  const { summary, inspections } = contextData;
  
  let context = `Comparative Analysis Data:\n`;
  context += `- Total Records: ${summary.totalRecords}\n`;
  context += `- Records in Context: ${inspections.length}\n`;
  
  if (summary.categoryBreakdowns) {
    context += `- Category Breakdowns:\n${JSON.stringify(summary.categoryBreakdowns, null, 2)}\n`;
  }
  
  return context;
}

function formatTemporalContext(contextData: any): string {
  const { summary, inspections } = contextData;
  
  let context = `Temporal Analysis Data:\n`;
  context += `- Total Records: ${summary.totalRecords}\n`;
  context += `- Time Series Points: ${inspections.length}\n`;
  
  if (summary.timePatterns) {
    context += `- Time Patterns:\n${JSON.stringify(summary.timePatterns, null, 2)}\n`;
  }
  
  return context;
}

function formatDetailedContext(contextData: any): string {
  const { summary, inspections } = contextData;
  
  let context = `Detailed Analysis Data:\n`;
  context += `- Total Records: ${summary.totalRecords}\n`;
  context += `- Detailed Records: ${inspections.length}\n`;
  
  // Include comprehensive data
  context += `\nDetailed Records:\n${JSON.stringify(inspections.slice(0, 10), null, 2)}`;
  
  return context;
}

// Handle preflight requests for CORS
export async function OPTIONS() {
  return new Response(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET',
      'Access-Control-Allow-Headers': 'Content-Type',
    },
  });
}
