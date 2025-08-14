import { NextRequest } from "next/server";
import OpenAI from "openai";
import { getDataContext, createFocusedPrompt } from "@/lib/ai-context";

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
        
        // Get relevant data context
        console.log('Getting data context for query...');
        const contextData = await getDataContext(query);
        
        controller.enqueue(`data: ${JSON.stringify({ content: "📊 Found " + contextData.summary.totalRecords + " relevant inspections...\n" })}\n\n`);
        
        // Create focused prompt
        const focusedPrompt = createFocusedPrompt(query, contextData);
        
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
        
        // Stream the response
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content || '';
            if (content) {
              controller.enqueue(`data: ${JSON.stringify({ content })}\n\n`);
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
