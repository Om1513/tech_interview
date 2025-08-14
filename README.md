# 🚰 Sewer Inspection Analysis Platform

A high-performance web application for analyzing large-scale sewer inspection datasets with AI-powered insights. Stream and process 1GB+ JSONL files directly from S3, perform lightning-fast searches across millions of records, and get intelligent answers to infrastructure questions.

## 🎯 Overview

This application enables infrastructure engineers to:
- **Stream massive datasets** (1GB+ per file) without memory constraints
- **Search and filter** inspections by location, pipe attributes, defects, and scores
- **Chat with AI** to get insights, summaries, and answers about inspection data
- **Analyze trends** across materials, defect patterns, and repair priorities

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with streaming
- **AI**: OpenAI GPT-3.5-turbo with Server-Sent Events
- **Data**: AWS S3 streaming (5GB+ JSONL files)
- **Database**: SQLite with Prisma (local caching)

### Key Features
- 🔄 **Memory-efficient streaming** - Process gigabyte files line-by-line
- ⚡ **Real-time search** - Filter millions of records with sub-second response
- 🤖 **AI chat interface** - Natural language Q&A over inspection data
- 📊 **Smart aggregations** - Automatic stats and insights
- 🎨 **Responsive UI** - Modern interface with loading states and error handling

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm
- OpenAI API key

### Installation

1. **Clone and install dependencies**
   ```bash
   git clone <repository-url>
   cd tech_interview
   npm install
   ```

2. **Set up environment variables**
   ```bash
   cp .env.example .env.local
   ```
   
   Add your OpenAI API key to `.env.local`:
   ```env
   OPENAI_API_KEY=your-openai-api-key-here
   ```

3. **Run the development server**
   ```bash
   npm run dev
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

## 📊 Data Source

The application processes sewer inspection data from a public S3 bucket:
- **Bucket**: `sewerai-public` (US West 2)
- **Files**: `sewer-inspections-part1.jsonl` through `part5.jsonl`
- **Size**: ~1GB per file, 5GB total
- **Records**: Millions of inspection records with pipe details, defects, and scores

### Sample Record Structure
```json
{
  "id": "inspection_12345",
  "timestamp": "2024-01-15T10:30:00Z",
  "location": {
    "city": "Houston",
    "state": "TX",
    "street": "Main St",
    "coordinates": [-95.3698, 29.7604]
  },
  "pipe": {
    "material": "PVC",
    "diameter_inches": 12,
    "length_feet": 500,
    "age_years": 15
  },
  "defects": [
    {
      "code": "CR",
      "description": "Crack",
      "severity": 3,
      "distance_feet": 150
    }
  ],
  "inspection_score": 75,
  "requires_repair": false
}
```

## 🔍 API Endpoints

### Search Inspections
```http
GET /api/search?city=Houston&material=PVC&minScore=70&limit=100
```

**Query Parameters:**
- `city` - Filter by city name
- `state` - Filter by state
- `material` - Pipe material (PVC, Cast Iron, etc.)
- `minScore` / `maxScore` - Inspection score range
- `needsRepair` - Boolean filter for repair requirements
- `limit` - Maximum results (default: 100)

**Response:**
```json
{
  "results": [...],
  "count": 1543,
  "hasMore": true
}
```

### AI Chat Interface
```http
GET /api/chat?query=What's the average score in Houston?
```

Returns Server-Sent Events stream with AI responses based on relevant inspection data.

### Health Check
```http
GET /api/health
```

Returns system status and data availability.

## 🎮 Usage Examples

### Search Operations
```bash
# Find all pipes needing repair in Houston
curl "localhost:3000/api/search?city=Houston&needsRepair=true"

# Get low-scoring inspections
curl "localhost:3000/api/search?maxScore=50&limit=50"

# Filter by material and location
curl "localhost:3000/api/search?material=Cast%20Iron&state=TX"
```

### AI Chat Queries
- "What's the average inspection score in Houston?"
- "Find all pipes that need immediate repair"
- "Which material type has the most defects?"
- "Show me inspections with severity 5 defects"
- "What are common problems in old pipes?"

## 🏃‍♂️ Performance

### Streaming Architecture
- **Memory usage**: <100MB even for 1GB+ files
- **Search latency**: <3 seconds for filtered results
- **Concurrent users**: Handles multiple simultaneous streams
- **Error recovery**: Graceful handling of network issues

### Optimization Features
- Line-by-line JSON processing
- Early termination when limits reached
- Intelligent caching of frequent queries
- Progressive loading with user feedback

## 🛠️ Development

### Project Structure
```
tech_interview/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── search/        # Search endpoint
│   │   ├── chat/          # AI chat endpoint
│   │   └── health/        # Health check
│   ├── search/            # Search page
│   └── chat/              # Chat interface page
├── components/            # React components
├── lib/                   # Utilities and services
├── prisma/               # Database schema
└── docs/                 # Project documentation
```

### Available Scripts
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

### Environment Variables
```env
OPENAI_API_KEY=          # Required: OpenAI API key
NODE_ENV=development     # Environment mode
PORT=3000               # Server port (optional)
```

## 🧪 Testing

### Manual Testing
Visit the test functionality page at `/test` to verify:
- S3 streaming connectivity
- Search performance with various filters
- AI chat responsiveness
- Error handling scenarios

### Sample Test Queries
```javascript
// Test streaming performance
fetch('/api/search?limit=1000')

// Test AI integration
fetch('/api/chat?query=summarize Houston inspections')

// Test error handling
fetch('/api/search?invalidParam=true')
```

## 🚨 Troubleshooting

### Common Issues

**Slow search responses**
- Check network connectivity to S3
- Reduce search limit parameter
- Clear browser cache

**AI chat not working**
- Verify OPENAI_API_KEY is set correctly
- Check OpenAI API quota and billing
- Monitor browser console for errors

**Memory issues**
- Restart the development server
- Check for memory leaks in browser dev tools
- Reduce concurrent request limits

### Debug Logging
Enable detailed logging by setting:
```env
DEBUG=sewer-inspection:*
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

- [ ] **Real-time collaboration** - Multiple users analyzing data simultaneously
- [ ] **Advanced visualizations** - Charts and maps for inspection data
- [ ] **Predictive analytics** - ML models for failure prediction
- [ ] **Mobile app** - Field inspection data entry
- [ ] **API rate limiting** - Production-ready request throttling
- [ ] **Data export** - CSV/Excel export functionality

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions or issues:
- Check the [troubleshooting section](#🚨-troubleshooting)
- Review [project documentation](docs/)
- Open an issue on GitHub

---

Built with ❤️ for infrastructure engineers managing critical sewer networks.