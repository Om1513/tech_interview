# 🚰 Sewer Inspection Analysis Platform

A high-performance web application for analyzing large-scale sewer inspection datasets with AI-powered insights and local database capabilities. Features both S3 streaming and lightning-fast SQLite database storage with intelligent SQL query generation for comprehensive data analysis.

## 🎯 Overview

This application enables infrastructure engineers to:
- **Stream massive datasets** (1GB+ per file) without memory constraints
- **Local SQLite database** with 10x faster searches and offline capability
- **AI-powered SQL generation** for complex queries and comprehensive data analysis
- **Search and filter** inspections by location, pipe attributes, defects, and scores
- **Chat with AI** to get insights, summaries, and answers about inspection data
- **Import and manage** data through web admin interface and CLI tools
- **Analyze trends** across materials, defect patterns, and repair priorities

## 🏗️ Architecture

### Tech Stack
- **Frontend**: Next.js 15, React 19, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes with streaming
- **AI**: OpenAI GPT-4/GPT-5 with Server-Sent Events and SQL generation
- **Database**: SQLite with better-sqlite3 (primary) + S3 streaming (fallback)
- **Data Processing**: AWS S3 streaming (5GB+ JSONL files)
- **CLI Tools**: Commander.js with TypeScript execution (tsx)

### Key Features
- 🔄 **Memory-efficient streaming** - Process gigabyte files line-by-line
- ⚡ **SQLite database** - 10x faster searches with local data storage
- 🧠 **AI SQL generation** - Natural language to optimized SQL queries
- 🤖 **Enhanced AI chat** - Complete dataset access with intelligent context
- 📥 **Data import system** - Web admin interface and CLI tools
- 📊 **Smart aggregations** - Automatic stats and insights
- 🎨 **Responsive UI** - Modern interface with loading states and error handling
- 🔧 **Admin dashboard** - Real-time import monitoring and database management

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
   
   Add your OpenAI API key and database configuration to `.env.local`:
   ```env
   OPENAI_API_KEY=your-openai-api-key-here
   DATABASE_URL=file:./data/inspections.db
   DATABASE_MODE=sqlite
   ```

3. **Import inspection data** (Choose one option)
   
   **Option A: Admin Interface (Recommended)**
   ```bash
   npm run dev
   ```
   Visit [http://localhost:3000/admin](http://localhost:3000/admin) and click "Import All Files"
   
   **Option B: Command Line**
   ```bash
   npm run db:import
   ```

4. **Open your browser**
   Navigate to [http://localhost:3000](http://localhost:3000) to start analyzing data

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

## 🗄️ Database Features

### SQLite Database System
The platform includes a high-performance SQLite database for local data storage and lightning-fast queries:

- ✅ **10x Faster Searches**: Local SQLite vs S3 streaming
- ✅ **Offline Capability**: Full functionality without internet connection
- ✅ **Data Import System**: Stream and import from S3 files with progress tracking
- ✅ **CLI Management Tools**: Command-line database operations
- ✅ **Admin Web Interface**: Browser-based import monitoring and management
- ✅ **Backward Compatible**: Automatic fallback to S3 when database unavailable

### Database CLI Commands

**Data Management:**
```bash
npm run db:import          # Import all S3 files
npm run db:status          # Show database statistics
npm run db:validate        # Validate data integrity
npm run db:history         # Show import history
```

**Database Maintenance:**
```bash
npm run db:vacuum          # Optimize database
npm run db:analyze         # Update query statistics
npm run db:backup          # Create backup
npm run db:cleanup         # Clean old import logs
npm run db:reset           # Reset database (requires --confirm)
```

### Admin Interface Features
Visit `/admin` for:
- Real-time import progress monitoring
- Database statistics and health checks
- Import history and error tracking
- One-click data import from S3
- Database optimization tools

### AI-Powered SQL Generation
The chat interface now features intelligent SQL query generation:
- **Natural Language Processing**: Convert user questions to optimized SQL
- **Complete Dataset Access**: No more 10-30 record limitations
- **Multi-Query Support**: Handle complex questions requiring multiple queries
- **Smart Context Building**: Only include relevant data for AI analysis
- **Query Optimization**: Automatic index usage and performance tuning

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

Returns Server-Sent Events stream with AI responses based on relevant inspection data and intelligent SQL query generation.

### Database Import Management
```http
POST /api/import?action=start          # Start data import
POST /api/import?action=stop           # Stop running import  
GET /api/import?action=status          # Get import status
GET /api/import?action=history         # Get import history
GET /api/import?action=stats           # Get database statistics
POST /api/import?action=validate       # Validate data
```

### Health Check
```http
GET /api/health
```

Returns system status, data availability, and database connectivity.

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

### SQLite vs S3 Streaming Comparison
| Feature | SQLite Database | S3 Streaming |
|---------|----------------|--------------|
| **Search Speed** | <0.5 seconds | 3-10 seconds |
| **Memory Usage** | ~50MB | ~100MB |
| **Offline Mode** | ✅ Full functionality | ❌ Requires internet |
| **Complex Queries** | ✅ SQL aggregations | ⚠️ Limited filtering |
| **Data Import** | One-time setup | Real-time streaming |
| **Setup Time** | 10-30 minutes | Instant |

### Performance Optimizations
- **SQLite WAL Mode**: Write-Ahead Logging for concurrent access
- **Smart Indexing**: Optimized indexes for common search patterns
- **Batch Processing**: 100-record transactions for efficient imports
- **Query Optimization**: AI-generated SQL with automatic index usage
- **Memory Management**: Efficient chunk processing for large datasets
- **Connection Pooling**: Reused database connections for better performance

### Streaming Architecture (S3 Fallback)
- **Memory usage**: <100MB even for 1GB+ files
- **Search latency**: 3-10 seconds for filtered results
- **Concurrent users**: Handles multiple simultaneous streams
- **Error recovery**: Graceful handling of network issues
- **Progressive loading**: Line-by-line JSON processing with user feedback

## 🛠️ Development

### Project Structure
```
tech_interview/
├── app/                    # Next.js app directory
│   ├── api/               # API routes
│   │   ├── search/        # Enhanced search endpoint (SQLite + S3)
│   │   ├── chat/          # AI chat with SQL generation
│   │   ├── import/        # Database import management
│   │   └── health/        # Health check
│   ├── admin/             # Admin interface for data management
│   ├── search/            # Search page
│   └── chat/              # Enhanced chat interface
├── components/            # React components
│   ├── ImportManager.tsx  # Data import interface
│   └── ...               # Other UI components
├── lib/                   # Core utilities and services
│   ├── database/          # Database layer
│   │   ├── config.ts      # Database configuration
│   │   ├── importer.ts    # Data import engine
│   │   ├── query-executor.ts # Safe SQL execution
│   │   └── search.ts      # Enhanced search logic
│   ├── query-generator.ts # AI SQL generation
│   ├── intelligent-context.ts # Smart context building
│   └── s3-stream.ts       # S3 streaming (fallback)
├── data/                  # Local database storage
├── scripts/               # CLI tools and utilities
│   └── db-import.ts       # Database import CLI
├── docs/                  # Comprehensive documentation
│   ├── DATABASE_SETUP.md  # Database setup guide
│   └── features/          # Feature development plans
└── prisma/               # Database schema definitions
```

### Available Scripts

**Development:**
```bash
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server
npm run lint         # Run ESLint
```

**Database Management:**
```bash
npm run db:import          # Import all S3 files to database
npm run db:resume          # Resume interrupted import
npm run db:resume:list     # List available resume points
npm run db:status          # Show database statistics
npm run db:validate        # Validate data integrity
npm run db:history         # Show import history
npm run db:reset           # Reset database (with confirmation)
npm run db:vacuum          # Optimize database performance
npm run db:analyze         # Update query statistics
npm run db:backup          # Create database backup
npm run db:cleanup         # Clean old import logs
```

### Environment Variables
```env
# Required
OPENAI_API_KEY=                        # OpenAI API key for AI features

# Database Configuration  
DATABASE_URL=file:./data/inspections.db   # SQLite database file path
DATABASE_MODE=sqlite                       # 'sqlite' or 'false' (S3-only)

# Import Settings (Optional)
DATABASE_IMPORT_BATCH_SIZE=100            # Records per transaction
IMPORT_MAX_RETRIES=3                      # Retry failed imports
IMPORT_AUTO_SYNC=false                    # Auto-sync with S3

# Server Configuration (Optional)
NODE_ENV=development                      # Environment mode
PORT=3000                                # Server port
```

## 🧪 Testing

### Manual Testing
Visit these pages to verify functionality:
- **Main Search**: `/` - Test search interface and filters
- **AI Chat**: `/chat` - Test natural language queries and SQL generation
- **Admin Interface**: `/admin` - Test data import and database management
- **Health Check**: `/api/health` - Verify system status and connectivity

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

### Database Issues

**Import stuck or slow:**
```bash
npm run db:status          # Check current status
npm run db:history         # Review recent imports
```

**Data validation errors:**
```bash
npm run db:validate        # Check data integrity
npm run db:cleanup         # Clear old logs
```

**Database corruption:**
```bash
npm run db:backup          # Create backup first
npm run db:vacuum          # Optimize database
npm run db:analyze         # Update statistics
```

**Complete database reset:**
```bash
npm run db:reset -- --confirm
npm run db:import
```

### Performance Issues

**Slow searches (SQLite mode):**
```bash
npm run db:analyze         # Update query statistics
npm run db:vacuum          # Defragment database
```

**Slow searches (S3 mode):**
- Check network connectivity to S3
- Reduce search limit parameter
- Clear browser cache

**High memory usage:**
- Reduce `DATABASE_IMPORT_BATCH_SIZE` in environment
- Monitor with `npm run db:status`
- Restart the development server

### AI Chat Issues

**AI chat not working:**
- Verify OPENAI_API_KEY is set correctly
- Check OpenAI API quota and billing
- Monitor browser console for errors

**SQL generation errors:**
- System falls back to S3 streaming automatically
- Check database connectivity with `npm run db:status`
- Review console logs for SQL validation errors

### Import Management

**Import progress tracking:**
- Visit `/admin` for real-time monitoring
- Use `npm run db:status` for CLI status
- Check `npm run db:history` for past imports

**Resume interrupted imports:**
```bash
npm run db:resume:list     # List available resume points
npm run db:resume          # Resume from last checkpoint
```

### Debug Logging
Enable detailed logging by setting:
```env
DEBUG=sewer-inspection:*
DATABASE_DEBUG=true
```

### File Locations
- **Database**: `./data/inspections.db`
- **Backups**: `./backups/inspections-*.db`
- **Logs**: Console output and import_log table

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📋 Roadmap

### ✅ Completed Features
- [x] **SQLite Database Integration** - Local high-performance storage
- [x] **AI-Powered SQL Generation** - Natural language to SQL conversion
- [x] **Data Import System** - Web and CLI-based data management
- [x] **Admin Interface** - Real-time monitoring and management
- [x] **Enhanced Performance** - 10x faster searches with local database

### 🚧 In Progress
- [ ] **Advanced AI Context** - Multi-query optimization and smart aggregations
- [ ] **Performance Monitoring** - Real-time query and import metrics

### 🎯 Future Enhancements
- [ ] **Real-time collaboration** - Multiple users analyzing data simultaneously
- [ ] **Advanced visualizations** - Interactive charts and maps for inspection data
- [ ] **Predictive analytics** - ML models for pipe failure prediction
- [ ] **Mobile app** - Field inspection data entry and offline sync
- [ ] **API rate limiting** - Production-ready request throttling
- [ ] **Data export** - CSV/Excel export functionality with custom queries
- [ ] **Multi-database support** - PostgreSQL and MySQL compatibility
- [ ] **Automated reporting** - Scheduled reports and notifications

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🆘 Support

For questions or issues:
- Check the [troubleshooting section](#🚨-troubleshooting)
- Review [Database Setup Guide](docs/DATABASE_SETUP.md) for detailed instructions
- Review [project documentation](docs/) for feature development plans
- Use CLI tools: `npm run db:status` and `npm run db:validate`
- Visit `/admin` for real-time system monitoring
- Open an issue on GitHub

---

Built with ❤️ for infrastructure engineers managing critical sewer networks.