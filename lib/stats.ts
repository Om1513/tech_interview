import { streamFromS3 } from './s3-stream';
import { SewerInspection } from './types';

export interface AppStats {
  totalInspections: number;
  averageScore: number;
  repairRate: number;
  uniqueCities: number;
  uniqueMaterials: number;
  recentActivity: {
    searchesPerformed: number;
    chatQueriesAsked: number;
  };
  dataHealth: {
    filesProcessed: number;
    lastUpdated: string;
    processingTime: number;
  };
}

// Cache stats for 5 minutes to improve performance
let statsCache: { data: AppStats; timestamp: number } | null = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getAppStats(): Promise<AppStats> {
  // Return cached data if still valid
  if (statsCache && Date.now() - statsCache.timestamp < CACHE_DURATION) {
    return statsCache.data;
  }

  console.log('Calculating app statistics...');
  const startTime = Date.now();

  try {
    // Sample data from multiple files for comprehensive stats
    const samplePromises = [
      streamFromS3('sewer-inspections-part1.jsonl', 100),
      streamFromS3('sewer-inspections-part2.jsonl', 100),
      streamFromS3('sewer-inspections-part3.jsonl', 100)
    ];

    const samples = await Promise.allSettled(samplePromises);
    const allInspections: SewerInspection[] = [];

    let filesProcessed = 0;
    samples.forEach((result) => {
      if (result.status === 'fulfilled') {
        allInspections.push(...result.value);
        filesProcessed++;
      }
    });

    if (allInspections.length === 0) {
      throw new Error('No inspection data available');
    }

    // Calculate statistics
    const totalInspections = allInspections.length;
    const scores = allInspections.map(i => i.inspection_score);
    const averageScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    
    const repairsNeeded = allInspections.filter(i => i.requires_repair).length;
    const repairRate = Math.round((repairsNeeded / totalInspections) * 100);

    const cities = new Set(allInspections.map(i => i.location?.city).filter(Boolean));
    const materials = new Set(allInspections.map(i => i.pipe?.material).filter(Boolean));

    const processingTime = Date.now() - startTime;

    const stats: AppStats = {
      totalInspections: totalInspections * 10, // Estimate based on sample
      averageScore,
      repairRate,
      uniqueCities: cities.size,
      uniqueMaterials: materials.size,
      recentActivity: {
        searchesPerformed: getStoredMetric('searches', 0),
        chatQueriesAsked: getStoredMetric('chatQueries', 0)
      },
      dataHealth: {
        filesProcessed,
        lastUpdated: new Date().toISOString(),
        processingTime
      }
    };

    // Cache the results
    statsCache = {
      data: stats,
      timestamp: Date.now()
    };

    console.log(`Stats calculated in ${processingTime}ms:`, stats);
    return stats;

  } catch (error) {
    console.error('Error calculating app stats:', error);
    
    // Return fallback stats on error
    return {
      totalInspections: 0,
      averageScore: 0,
      repairRate: 0,
      uniqueCities: 0,
      uniqueMaterials: 0,
      recentActivity: {
        searchesPerformed: 0,
        chatQueriesAsked: 0
      },
      dataHealth: {
        filesProcessed: 0,
        lastUpdated: new Date().toISOString(),
        processingTime: Date.now() - startTime
      }
    };
  }
}

// Simple metrics tracking using localStorage
function getStoredMetric(key: string, defaultValue: number): number {
  if (typeof window === 'undefined') return defaultValue;
  
  try {
    const stored = localStorage.getItem(`sewer_app_${key}`);
    return stored ? parseInt(stored, 10) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export function incrementMetric(key: string): void {
  if (typeof window === 'undefined') return;
  
  try {
    const current = getStoredMetric(key, 0);
    localStorage.setItem(`sewer_app_${key}`, (current + 1).toString());
  } catch (error) {
    console.warn('Failed to increment metric:', key, error);
  }
}

// Helper function to get performance insights
export function getPerformanceInsights(stats: AppStats): {
  status: 'good' | 'warning' | 'error';
  message: string;
  details: string[];
} {
  const insights: string[] = [];
  let status: 'good' | 'warning' | 'error' = 'good';
  let message = 'System is operating normally';

  // Check data processing performance
  if (stats.dataHealth.processingTime > 5000) {
    status = 'warning';
    message = 'Slower than usual data processing';
    insights.push(`Processing time: ${stats.dataHealth.processingTime}ms`);
  }

  // Check data availability
  if (stats.dataHealth.filesProcessed < 3) {
    if (status !== 'error') status = 'warning';
    message = 'Limited data availability';
    insights.push(`Only ${stats.dataHealth.filesProcessed} data files accessible`);
  }

  // Check repair rate for infrastructure insights
  if (stats.repairRate > 30) {
    insights.push(`High repair rate: ${stats.repairRate}% of inspected pipes need repair`);
  } else if (stats.repairRate < 5) {
    insights.push(`Low repair rate: ${stats.repairRate}% indicates good infrastructure condition`);
  }

  // Check average score
  if (stats.averageScore < 60) {
    insights.push(`Below average infrastructure condition (score: ${stats.averageScore})`);
  } else if (stats.averageScore > 85) {
    insights.push(`Excellent infrastructure condition (score: ${stats.averageScore})`);
  }

  return { status, message, details: insights };
}
