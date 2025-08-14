export interface GPS {
	lat: number;
	lon: number;
}

export interface Location {
	city: string;
	state: string;
	district?: string;
	street: string;
	gps?: GPS;
	upstream_manhole: string;    // Starting point
	downstream_manhole: string;  // Ending point
}

export interface PipeDetails {
	material: string;            // VCP, PVC, DIP, etc.
	material_desc?: string;      // Full material description
	diameter_in: number;         // Pipe diameter in inches
	length_ft: number;           // Pipe length in feet
	age_years: number;           // How old the pipe is
	shape?: string;              // Circular, Oval, etc.
	install_year?: number;       // Year installed
	slope_percent?: number;      // Pipe slope percentage
}

export interface Conditions {
	weather?: string;
	flow?: string;
	debris_level?: string;
	access_difficulty?: string;
}

export interface Equipment {
	type?: string;
	model?: string;
	camera_id?: string;
}

export interface Observations {
	roots?: string;
	grease?: string;
	debris?: string;
	corrosion?: string;
}

export interface SensorData {
	flow_rate_mgd?: number;
	velocity_fps?: number;
	depth_in?: number;
	temperature_f?: number;
	ph?: number;
	dissolved_oxygen_ppm?: number;
	turbidity_ntu?: number;
	h2s_ppm?: number;
}

export interface Crew {
	inspector_id?: string;
	inspector_name?: string;
	crew_size?: number;
	contractor?: string;
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
	inspection_type?: string;      // Type of inspection
	location: Location;
	pipe: PipeDetails;
	conditions?: Conditions;
	equipment?: Equipment;
	defects: Defect[];
	observations?: Observations;
	sensor_data?: SensorData;
	inspection_score: number;      // Overall condition score (0-100)
	severity_max: number;          // Maximum defect severity
	crew?: Crew;
	duration_minutes?: number;
	video_file?: string;
	report_generated?: boolean;
	requires_cleaning?: boolean;
	requires_repair: boolean;      // Needs immediate attention?
	notes?: string;
	qc_reviewed?: boolean;
	tags?: string[];
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
	page?: number;
}

export interface PaginationInfo {
	currentPage: number;
	totalPages: number;
	totalCount: number;
	pageSize: number;
	hasNextPage: boolean;
	hasPreviousPage: boolean;
}

export interface SearchResponse {
	results: SewerInspection[];
	pagination: PaginationInfo;
	filters: SearchFilters;
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

// AI-Powered SQL Query Generation Types
export type ContextStrategy = 'statistical' | 'comparative' | 'detailed' | 'temporal';

export interface QueryPlan {
	sql: string;
	params: any[];
	purpose: string;
	resultType: string;
	contextStrategy: ContextStrategy;
}

export interface QueryMetadata {
	rowCount: number;
	columns: string[];
	aggregations?: any;
	executionTime: number;
}

export interface QueryResult {
	data: any[];
	metadata: QueryMetadata;
	executionTime: number;
}

export interface SQLGenerationRequest {
	prompt: string;
	databaseSchema: string;
	sampleQueries: string[];
}

export interface SQLGenerationResponse {
	queries: QueryPlan[];
	contextStrategy: ContextStrategy;
	explanation: string;
	confidence: number;
}


