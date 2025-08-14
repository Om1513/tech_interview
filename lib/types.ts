export interface Location {
	city: string;
	state: string;
	street: string;
	upstream_manhole: string;    // Starting point
	downstream_manhole: string;  // Ending point
}

export interface PipeDetails {
	material: string;            // VCP, PVC, etc.
	diameter_in: number;         // Pipe diameter in inches
	length_ft: number;           // Pipe length in feet
	age_years: number;           // How old the pipe is
}

export interface Defect {
	code: string;                // Defect code (e.g., "CC" for crack)
	description: string;         // Human-readable description
	severity: number;            // 1-5 scale (5 is worst)
	distance_ft: number;         // How far from start
}

export interface SewerInspection {
	id: string;                    // Unique inspection ID
	timestamp_utc: string;         // When the inspection happened
	location: Location;
	pipe: PipeDetails;
	defects: Defect[];
	inspection_score: number;      // Overall condition score (0-100)
	requires_repair: boolean;      // Needs immediate attention?
}

export interface SearchFilters {
	city?: string;
	state?: string;
	material?: string;
	severityMin?: number;
	severityMax?: number;
	scoreMin?: number;
	scoreMax?: number;
	requiresRepair?: boolean;
	limit?: number;
	cursor?: string;
}

export interface SearchResponse {
	items: SewerInspection[];
	nextCursor?: string | null;
}

// Chat-specific types
export interface ChatMessage {
	role: 'user' | 'assistant';
	content: string;
	timestamp: string;
}

export interface ChatResponse {
	content?: string;
	error?: string;
	done?: boolean;
}


