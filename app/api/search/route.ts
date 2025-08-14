import { NextResponse } from "next/server";
import { SearchFilters, PaginationInfo } from "@/lib/types";

// Import SQLite search functions
import { searchInspections } from "@/lib/database/search";
import { getUniqueValues, initializeDatabase } from "@/lib/database/sqlite";

// Fallback to S3 search if needed
import { searchInspections as s3SearchInspections } from "@/lib/search";

const USE_DATABASE = process.env.DATABASE_MODE !== 'false';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Handle special case for getting search options
  if (searchParams.get('options') === 'true') {
    try {
      if (USE_DATABASE) {
        // Initialize database if needed
        initializeDatabase();
        
        // Get unique values from database
        const cities = getUniqueValues('city');
        const states = getUniqueValues('state');
        
        return NextResponse.json({ cities, states });
      } else {
        // Fallback to S3 (if getSearchOptions is still available)
        const { getSearchOptions } = await import("@/lib/search");
        const options = await getSearchOptions();
        return NextResponse.json(options);
      }
    } catch (error) {
      console.error('Error fetching search options:', error);
      return NextResponse.json(
        { error: 'Failed to fetch search options' },
        { status: 500 }
      );
    }
  }
  
  // Parse search filters from query parameters
  const page = Math.max(1, Number(searchParams.get('page')) || 1);
  const pageSize = 10; // Fixed page size
  
  const filters: SearchFilters = {
    city: searchParams.get('city') || undefined,
    state: searchParams.get('state') || undefined,
    material: searchParams.get('material') || undefined,
    scoreMin: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : 0,
    scoreMax: searchParams.get('maxScore') ? Number(searchParams.get('maxScore')) : 100,
    requiresRepair: searchParams.get('needsRepair') === 'true' ? true : 
                   searchParams.get('needsRepair') === 'false' ? false : undefined,
    page: page
  };
  
  console.log(`Search API called with filters (${USE_DATABASE ? 'SQLite' : 'S3'}):`, filters, 'page:', page);

  try {
    let searchResult: { results: any[], totalCount: number };
    
    if (USE_DATABASE) {
      // Initialize database if needed
      initializeDatabase();
      
      // Use SQLite search
      searchResult = await searchInspections(filters, page, pageSize);
    } else {
      // Fallback to S3 search
      searchResult = await s3SearchInspections(filters, page, pageSize);
    }
    
    const { results, totalCount } = searchResult;
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination: PaginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalCount,
      pageSize: pageSize,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
    
    const response = {
      results,
      pagination,
      filters: filters,
      memoryUsage: process.memoryUsage(),
      source: USE_DATABASE ? 'sqlite' : 's3'
    };
    
    console.log(`Search completed successfully (${USE_DATABASE ? 'SQLite' : 'S3'}): ${totalCount} total results, ${results.length} on page ${page}`);
    return NextResponse.json(response);

  } catch (error) {
    console.error('Search API error:', error);
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        filters: filters
      },
      { status: 500 }
    );
  }
}

// Optional POST method for complex search queries
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const page = Math.max(1, Number(body.page) || 1);
    const pageSize = 10; // Fixed page size
    
    const filters: SearchFilters = {
      city: body.city,
      state: body.state,
      material: body.material,
      scoreMin: body.minScore ?? 0,
      scoreMax: body.maxScore ?? 100,
      requiresRepair: body.needsRepair,
      page: page
    };

    console.log(`Search API POST called with filters (${USE_DATABASE ? 'SQLite' : 'S3'}):`, filters, 'page:', page);

    let searchResult: { results: any[], totalCount: number };
    
    if (USE_DATABASE) {
      // Initialize database if needed
      initializeDatabase();
      
      // Use SQLite search
      searchResult = await searchInspections(filters, page, pageSize);
    } else {
      // Fallback to S3 search
      searchResult = await s3SearchInspections(filters, page, pageSize);
    }
    
    const { results, totalCount } = searchResult;
    
    // Calculate pagination metadata
    const totalPages = Math.ceil(totalCount / pageSize);
    const pagination: PaginationInfo = {
      currentPage: page,
      totalPages: totalPages,
      totalCount: totalCount,
      pageSize: pageSize,
      hasNextPage: page < totalPages,
      hasPreviousPage: page > 1
    };
    
    return NextResponse.json({
      results,
      pagination,
      filters: filters,
      memoryUsage: process.memoryUsage(),
      source: USE_DATABASE ? 'sqlite' : 's3'
    });

  } catch (error) {
    console.error('Search API POST error:', error);
    return NextResponse.json(
      { 
        error: 'Search failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}
