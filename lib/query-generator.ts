import OpenAI from 'openai';
import { QueryPlan, SQLGenerationRequest, SQLGenerationResponse, ContextStrategy } from './types';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// Database schema for AI context
const DATABASE_SCHEMA = `
-- Sewer Inspection Database Schema
CREATE TABLE inspections (
  id TEXT PRIMARY KEY,
  timestamp_utc TEXT NOT NULL,
  inspection_type TEXT,
  
  -- Location fields
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  district TEXT,
  street TEXT,
  gps_lat REAL,
  gps_lon REAL,
  upstream_manhole TEXT,
  downstream_manhole TEXT,
  
  -- Pipe properties
  material TEXT NOT NULL,
  material_desc TEXT,
  diameter_in INTEGER NOT NULL,
  length_ft INTEGER NOT NULL,
  age_years INTEGER,
  shape TEXT,
  install_year INTEGER,
  slope_percent REAL,
  
  -- Inspection results
  inspection_score INTEGER NOT NULL, -- 0-100 scale
  severity_max INTEGER NOT NULL,     -- Maximum defect severity 0-5
  requires_repair INTEGER NOT NULL,  -- 0=false, 1=true
  requires_cleaning INTEGER,
  
  -- Additional data (JSON columns)
  conditions TEXT, -- JSON: weather, flow, debris_level, access_difficulty
  equipment TEXT,  -- JSON: type, model, camera_id
  observations TEXT, -- JSON: roots, grease, debris, corrosion
  sensor_data TEXT,  -- JSON: flow_rate_mgd, velocity_fps, depth_in, temperature_f, ph, etc.
  crew TEXT,       -- JSON: inspector_id, inspector_name, crew_size, contractor
  
  -- Metadata
  duration_minutes INTEGER,
  video_file TEXT,
  report_generated INTEGER,
  notes TEXT,
  qc_reviewed INTEGER,
  tags TEXT -- JSON array
);

CREATE TABLE defects (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  inspection_id TEXT NOT NULL,
  code TEXT NOT NULL,        -- Defect code (CC, CR, etc.)
  description TEXT NOT NULL, -- Human readable description
  severity INTEGER NOT NULL, -- 1-5 scale (5 is worst)
  distance_ft REAL NOT NULL, -- Distance from start point
  FOREIGN KEY (inspection_id) REFERENCES inspections(id)
);

-- Common queries and patterns:
-- Aggregations: COUNT(*), AVG(inspection_score), MAX(severity_max)
-- Grouping: GROUP BY city, GROUP BY material, GROUP BY requires_repair
-- Filtering: WHERE city='Houston', WHERE inspection_score < 50, WHERE requires_repair=1
-- Joins: inspections i JOIN defects d ON i.id = d.inspection_id
-- Date filtering: WHERE timestamp_utc >= '2020-01-01'
-- Material analysis: popular materials are PVC, VCP, DIP, PE, RCP
-- Score ranges: 0-30 poor, 31-60 fair, 61-80 good, 81-100 excellent
`;

// Sample queries for AI learning
const SAMPLE_QUERIES = [
  {
    prompt: "What's the average inspection score in Houston?",
    sql: "SELECT AVG(inspection_score) as avg_score, COUNT(*) as total_inspections FROM inspections WHERE city = 'Houston'",
    purpose: "Calculate average inspection score for specific city"
  },
  {
    prompt: "Which material has the most defects?",
    sql: `SELECT i.material, COUNT(d.id) as defect_count, COUNT(DISTINCT i.id) as pipe_count, 
           ROUND(COUNT(d.id) * 1.0 / COUNT(DISTINCT i.id), 2) as defects_per_pipe
           FROM inspections i 
           LEFT JOIN defects d ON i.id = d.inspection_id 
           GROUP BY i.material 
           ORDER BY defect_count DESC`,
    purpose: "Compare defect rates across different pipe materials"
  },
  {
    prompt: "Show me pipes that need immediate repair",
    sql: `SELECT id, city, state, material, inspection_score, severity_max 
          FROM inspections 
          WHERE requires_repair = 1 
          ORDER BY severity_max DESC, inspection_score ASC`,
    purpose: "Find pipes requiring urgent attention"
  },
  {
    prompt: "What are the inspection score trends by age?",
    sql: `SELECT 
            CASE 
              WHEN age_years < 10 THEN '0-10 years'
              WHEN age_years < 20 THEN '11-20 years'
              WHEN age_years < 30 THEN '21-30 years'
              WHEN age_years < 40 THEN '31-40 years'
              ELSE '40+ years'
            END as age_group,
            COUNT(*) as pipe_count,
            AVG(inspection_score) as avg_score,
            SUM(requires_repair) as repair_needed
          FROM inspections 
          WHERE age_years IS NOT NULL
          GROUP BY age_group 
          ORDER BY age_years`,
    purpose: "Analyze how pipe age affects inspection scores and repair needs"
  }
];

// Safety whitelist for allowed SQL operations
const ALLOWED_SQL_KEYWORDS = [
  'SELECT', 'FROM', 'WHERE', 'GROUP BY', 'ORDER BY', 'HAVING', 'LIMIT',
  'INNER JOIN', 'LEFT JOIN', 'RIGHT JOIN', 'COUNT', 'AVG', 'SUM', 'MAX', 'MIN',
  'DISTINCT', 'AS', 'AND', 'OR', 'NOT', 'IN', 'LIKE', 'BETWEEN', 'CASE', 'WHEN', 'THEN', 'ELSE', 'END'
];

const FORBIDDEN_SQL_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE', 'EXEC', 'EXECUTE'
];

/**
 * Generate SQL queries from natural language prompts using OpenAI
 */
export async function generateSQLFromPrompt(prompt: string): Promise<SQLGenerationResponse> {
  console.log('Generating SQL for prompt:', prompt);
  
  try {
    const systemPrompt = createSystemPrompt();
    const userPrompt = createUserPrompt(prompt);
    
    const completion = await openai.chat.completions.create({
      model: "gpt-4",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ],
      temperature: 0.1, // Low temperature for consistent SQL generation
      response_format: { type: "json_object" }
    });
    
    const response = completion.choices[0]?.message?.content;
    if (!response) {
      throw new Error('No response from OpenAI');
    }
    
    const parsed = JSON.parse(response) as SQLGenerationResponse;
    
    // Validate generated queries
    for (const query of parsed.queries) {
      if (!validateQuery(query.sql)) {
        throw new Error(`Generated query failed validation: ${query.sql}`);
      }
    }
    
    console.log('Generated SQL queries:', parsed.queries.length);
    return parsed;
    
  } catch (error) {
    console.error('SQL generation error:', error);
    throw new Error(`Failed to generate SQL: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Validate SQL query for safety and correctness
 */
export function validateQuery(sql: string): boolean {
  const upperSQL = sql.toUpperCase().trim();
  
  // Check for forbidden keywords
  for (const forbidden of FORBIDDEN_SQL_KEYWORDS) {
    if (upperSQL.includes(forbidden)) {
      console.error(`Forbidden keyword detected: ${forbidden}`);
      return false;
    }
  }
  
  // Must start with SELECT
  if (!upperSQL.startsWith('SELECT')) {
    console.error('Query must start with SELECT');
    return false;
  }
  
  // Basic SQL injection checks
  if (upperSQL.includes('--') || upperSQL.includes('/*') || upperSQL.includes(';')) {
    console.error('Potential SQL injection detected');
    return false;
  }
  
  // Must reference known tables
  const hasValidTable = upperSQL.includes('INSPECTIONS') || upperSQL.includes('DEFECTS');
  if (!hasValidTable) {
    console.error('Query must reference valid tables (inspections, defects)');
    return false;
  }
  
  return true;
}

/**
 * Optimize SQL query for better performance
 */
export function optimizeQuery(sql: string): string {
  let optimized = sql;
  
  // Add LIMIT if not present and not using aggregation
  if (!sql.toUpperCase().includes('LIMIT') && 
      !sql.toUpperCase().includes('COUNT') && 
      !sql.toUpperCase().includes('AVG') &&
      !sql.toUpperCase().includes('SUM')) {
    optimized += ' LIMIT 1000';
  }
  
  // Add indexes hints for common patterns
  if (sql.includes('WHERE city')) {
    console.log('Query will benefit from city index');
  }
  
  if (sql.includes('WHERE material')) {
    console.log('Query will benefit from material index');
  }
  
  return optimized;
}

/**
 * Determine the appropriate context strategy based on the prompt
 */
export function determineContextStrategy(prompt: string): ContextStrategy {
  const lowerPrompt = prompt.toLowerCase();
  
  if (lowerPrompt.includes('average') || lowerPrompt.includes('total') || 
      lowerPrompt.includes('count') || lowerPrompt.includes('sum')) {
    return 'statistical';
  }
  
  if (lowerPrompt.includes('compare') || lowerPrompt.includes('vs') || 
      lowerPrompt.includes('difference') || lowerPrompt.includes('material')) {
    return 'comparative';
  }
  
  if (lowerPrompt.includes('trend') || lowerPrompt.includes('over time') || 
      lowerPrompt.includes('year') || lowerPrompt.includes('month')) {
    return 'temporal';
  }
  
  // Default to detailed for specific queries
  return 'detailed';
}

/**
 * Create system prompt for SQL generation
 */
function createSystemPrompt(): string {
  return `You are an expert SQL analyst for a sewer inspection database. Your job is to convert natural language questions into accurate SQL queries.

DATABASE SCHEMA:
${DATABASE_SCHEMA}

SAMPLE QUERIES:
${SAMPLE_QUERIES.map(q => `Q: ${q.prompt}\nSQL: ${q.sql}\nPurpose: ${q.purpose}`).join('\n\n')}

IMPORTANT RULES:
1. Only generate SELECT queries - no INSERT, UPDATE, DELETE, or DDL operations
2. Use parameterized queries where appropriate
3. Always validate that tables and columns exist in the schema
4. For statistical queries, return aggregated data to minimize data transfer
5. For comparison queries, group data appropriately
6. Include relevant metadata about the query purpose and expected results
7. Respond in valid JSON format with the structure provided

Response must be valid JSON with this exact structure:
{
  "queries": [
    {
      "sql": "SELECT statement here",
      "params": ["param1", "param2"],
      "purpose": "Brief description of what this query does",
      "resultType": "aggregation|detailed|comparison|temporal",
      "contextStrategy": "statistical|comparative|detailed|temporal"
    }
  ],
  "contextStrategy": "statistical|comparative|detailed|temporal",
  "explanation": "Brief explanation of the analysis approach",
  "confidence": 0.95
}`;
}

/**
 * Create user prompt with the specific question
 */
function createUserPrompt(prompt: string): string {
  return `Convert this natural language question into optimized SQL queries for the sewer inspection database:

"${prompt}"

Generate the most efficient SQL query(ies) to answer this question. Consider:
- Whether aggregated data is sufficient or if detailed records are needed
- The best context strategy for the AI to analyze the results
- Performance optimization for large datasets
- Multiple queries if the question requires different data perspectives

Respond with valid JSON only.`;
}
