'use client';

import { useState, useRef, useEffect } from 'react';
import { ChatMessage } from '@/lib/types';

const EXAMPLE_QUERIES = [
  "What's the average inspection score in Houston?",
  "Find all pipes that need immediate repair",
  "Which material type has the most defects?",
  "Show me inspections with severity 5 defects",
  "What are the common problems in old pipes?"
];

export default function ChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      role: 'assistant',
      content: "Hello! I'm your GPT-5 powered sewer inspection data analyst. Ask me questions about pipe conditions, defects, repair needs, or any statistics about the inspection data.",
      timestamp: new Date().toISOString()
    }
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [streamingMessage, setStreamingMessage] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const eventSourceRef = useRef<EventSource | null>(null);

  // Check for query parameter on mount
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const query = urlParams.get('query');
      if (query && messages.length === 1) { // Only auto-send if it's the initial state
        setInput(query);
        // Auto-send the query after a short delay
        const timeoutId = setTimeout(() => {
          handleSendMessage(query);
          // Clear the URL parameter after sending
          window.history.replaceState({}, '', window.location.pathname);
        }, 1000);
        
        return () => clearTimeout(timeoutId);
      }
    }
  }, [messages.length]); // Only depend on messages.length to avoid loops

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessage]);

  const handleSendMessage = async (messageText?: string) => {
    const messageToSend = messageText || input.trim();
    if (!messageToSend || isLoading) return;

    const userMessage: ChatMessage = {
      role: 'user',
      content: messageToSend,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    if (!messageText) setInput(''); // Only clear input if not auto-sending
    setIsLoading(true);
    setStreamingMessage('');

    try {
      // Create EventSource for streaming response
      const eventSource = new EventSource(
        `/api/chat?query=${encodeURIComponent(messageToSend)}`
      );
      eventSourceRef.current = eventSource;

      let accumulatedContent = '';

      eventSource.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          
          if (data.error) {
            console.error('Chat error:', data.error);
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: `❌ Error: ${data.error}`,
              timestamp: new Date().toISOString()
            }]);
            setIsLoading(false);
            eventSource.close();
            return;
          }

          if (data.content) {
            accumulatedContent += data.content;
            setStreamingMessage(accumulatedContent);
          }

          if (data.done) {
            // Finalize the message
            setMessages(prev => [...prev, {
              role: 'assistant',
              content: accumulatedContent,
              timestamp: new Date().toISOString()
            }]);
            setStreamingMessage('');
            setIsLoading(false);
            eventSource.close();
          }
        } catch (err) {
          console.error('Error parsing SSE data:', err);
        }
      };

      eventSource.onerror = (error) => {
        console.error('EventSource error:', error);
        setMessages(prev => [...prev, {
          role: 'assistant',
          content: '❌ Connection error. Please try again.',
          timestamp: new Date().toISOString()
        }]);
        setIsLoading(false);
        setStreamingMessage('');
        eventSource.close();
      };

    } catch (error) {
      console.error('Chat request error:', error);
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: '❌ Failed to send message. Please try again.',
        timestamp: new Date().toISOString()
      }]);
      setIsLoading(false);
    }
  };

  const handleExampleClick = (query: string) => {
    if (isLoading) return;
    setInput(query);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const formatMessage = (content: string) => {
    // Simple markdown-like formatting
    return content
      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.*?)\*/g, '<em>$1</em>')
      .replace(/`(.*?)`/g, '<code class="bg-gray-100 dark:bg-gray-800 px-1 rounded">$1</code>')
      .replace(/\n/g, '<br>');
  };

  // Cleanup EventSource on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
      }
    };
  }, []);

  return (
    <div className="flex flex-col h-full max-w-4xl mx-auto">
      {/* Example Queries */}
      {messages.length === 1 && (
        <div className="mb-6 p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-lg font-medium text-blue-900 dark:text-blue-100 mb-3">
            Try these example questions:
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {EXAMPLE_QUERIES.map((query, index) => (
              <button
                key={index}
                onClick={() => handleExampleClick(query)}
                className="text-left p-3 text-sm bg-white dark:bg-gray-800 border border-blue-200 dark:border-blue-700 
                         rounded-lg hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors
                         disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isLoading}
              >
                "{query}"
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto space-y-4 mb-4 min-h-0">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-3xl p-4 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 dark:bg-gray-800 text-foreground'
              }`}
            >
              <div
                dangerouslySetInnerHTML={{ __html: formatMessage(message.content) }}
                className="whitespace-pre-wrap"
              />
              <div className="text-xs opacity-70 mt-2">
                {new Date(message.timestamp).toLocaleTimeString()}
              </div>
            </div>
          </div>
        ))}

        {/* Streaming message */}
        {streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-3xl p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-foreground">
              <div
                dangerouslySetInnerHTML={{ __html: formatMessage(streamingMessage) }}
                className="whitespace-pre-wrap"
              />
              {isLoading && (
                <div className="inline-block w-2 h-4 bg-gray-400 animate-pulse ml-1"></div>
              )}
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {isLoading && !streamingMessage && (
          <div className="flex justify-start">
            <div className="max-w-3xl p-4 rounded-lg bg-gray-100 dark:bg-gray-800 text-foreground">
              <div className="flex items-center space-x-2">
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-600"></div>
                <span className="text-sm text-gray-600 dark:text-gray-400">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="flex gap-2 p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700">
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Ask me about sewer inspection data..."
          className="flex-1 p-3 border border-gray-300 dark:border-gray-600 rounded-lg 
                   bg-background text-foreground resize-none
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          rows={2}
          disabled={isLoading}
        />
        <button
          onClick={() => handleSendMessage()}
          disabled={!input.trim() || isLoading}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 
                   focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 
                   disabled:opacity-50 disabled:cursor-not-allowed
                   transition-colors duration-200"
        >
          {isLoading ? (
            <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}
