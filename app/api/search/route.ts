import { NextResponse } from "next/server";
import { searchInspections, getSearchOptions } from "@/lib/search";
import { SearchFilters } from "@/lib/types";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Handle special case for getting search options
  if (searchParams.get('options') === 'true') {
    try {
      const options = await getSearchOptions();
      return NextResponse.json(options);
    } catch (error) {
      console.error('Error fetching search options:', error);
      return NextResponse.json(
        { error: 'Failed to fetch search options' },
        { status: 500 }
      );
    }
  }
  
  // Parse search filters from query parameters
  const filters: SearchFilters = {
    city: searchParams.get('city') || undefined,
    state: searchParams.get('state') || undefined,
    material: searchParams.get('material') || undefined,
    scoreMin: searchParams.get('minScore') ? Number(searchParams.get('minScore')) : 0,
    scoreMax: searchParams.get('maxScore') ? Number(searchParams.get('maxScore')) : 100,
    requiresRepair: searchParams.get('needsRepair') === 'true' ? true : 
                   searchParams.get('needsRepair') === 'false' ? false : undefined,
    limit: Math.min(Number(searchParams.get('limit')) || 100, 100) // Cap at 100
  };
  
  console.log('Search API called with filters:', filters);

  try {
    const results = await searchInspections(filters);
    
    const response = {
      results,
      count: results.length,
      filters: filters,
      memoryUsage: process.memoryUsage()
    };
    
    console.log(`Search completed successfully: ${results.length} results found`);
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
    const filters: SearchFilters = {
      city: body.city,
      state: body.state,
      material: body.material,
      scoreMin: body.minScore ?? 0,
      scoreMax: body.maxScore ?? 100,
      requiresRepair: body.needsRepair,
      limit: Math.min(body.limit || 100, 100)
    };

    console.log('Search API POST called with filters:', filters);

    const results = await searchInspections(filters);
    
    return NextResponse.json({
      results,
      count: results.length,
      filters: filters,
      memoryUsage: process.memoryUsage()
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
