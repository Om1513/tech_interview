### Sewer Inspection Analysis Web App — Product Brief

### Project overview / description
Build a web application that streams and processes large JSONL sewer inspection datasets (1GB+ per file) directly from a public S3 bucket, enables fast search/filter across records, and provides an AI-powered chat interface to help infrastructure engineers analyze inspections, summarize findings, and answer domain questions in real time.

### Target audience
- **Infrastructure engineers** responsible for pipe condition assessment and rehab planning
- **Asset managers/public works supervisors** monitoring network health and prioritizing repairs
- **Data analysts** exploring trends, materials, defects, and scores across the network
- **Field operations** teams needing quick answers on segments requiring attention

### Primary benefits / features
- **Streaming data ingestion**: Line-by-line processing of JSONL files from S3 without loading entire files into memory; backpressure-aware, low memory footprint
- **Search & filter**: Query by city/state/street, date/time ranges, pipe attributes (material, diameter, length, age), defect codes/severity, `requires_repair`, and score ranges; early termination with result limits and pagination
- **AI assistant**: Natural language Q&A over search results and summary stats; streamed responses; selective context to fit model token limits; robust error handling and fallbacks
- **User-friendly UI**: Responsive search form, readable result list with key fields, streaming chat panel, loading/progress indicators, and clear error messages
- **Reliability & performance**: Graceful error handling, timeouts/retries, basic caching of frequent queries (optional), and development-friendly logging

### High-level tech / architecture
- **Backend (Node.js + TypeScript)**
  - HTTP server (Express or Fastify)
  - Stream JSONL from public S3 HTTP endpoints; parse line-by-line and filter on the fly
  - REST endpoints: `GET /api/search` (query params, paginated), `GET /api/chat` (SSE for AI streaming), `GET /health`
  - OpenAI integration with streaming completions; compact context builder (sample top-N, field selection, computed aggregates)
  - Backpressure-aware pipelines; early termination when result limit reached; low memory use
  - Config via environment variables; structured error handling and logging
- **Frontend (React + Vite)**
  - Search interface with filters and paginated results
  - Chat interface consuming SSE for streamed AI responses
  - Loading states, error boundaries, and responsive layout; optional list virtualization for large result sets
- **Streaming & comms**: Server-Sent Events (SSE) for AI token streaming to browser

### APIs (illustrative)
- `GET /api/search?city=&state=&material=&severityMin=&severityMax=&scoreMin=&scoreMax=&requiresRepair=&limit=&cursor=` → returns first page and a cursor/token
- `GET /api/chat?sessionId=` (SSE) with POST/WS alternative; request body: user question + optional filter context

### Environment & configuration
- `OPENAI_API_KEY` (required; never commit the raw key)
- `PORT` (default 3000)
- `OPENAI_MODEL` (e.g., `gpt-4o-mini` or equivalent)
- `DATA_URLS` (public S3 JSONL URLs)

### Data model (reference)
`SewerInspection` records include id, timestamp, location, pipe details, defects list (code/description/severity/distance), `inspection_score`, and `requires_repair`.

### Risks and mitigations
- **Large-file memory pressure**: Stream JSONL with backpressure and discard non-matches early
- **Slow searches**: Limit to first N matches, paginate, and pre-select filter fields
- **AI token limits**: Summarize/aggregate, sample top-N exemplars, and elide unneeded fields
- **External API failures**: Timeouts, retries with backoff, and user-friendly fallback messages

### Success criteria
- Searches return initial results quickly (e.g., <3s for common filters)
- Memory remains bounded while processing 1GB+ files
- AI chat streams tokens with low latency and produces grounded answers using provided context
- Example queries (avg score by city, severity 5 defects, materials with most defects, immediate repairs) yield correct, explainable results


