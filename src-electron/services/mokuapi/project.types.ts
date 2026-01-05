/**
 * Project API Type Definitions
 * These types match the Moku API backend DTOs for project operations
 */

/**
 * Project DTO from Moku API (list view)
 */
export interface ProjectDTO {
    id: string;
    name: string;
    description: string | null;
    type: 'personal' | 'shared';
    active: boolean;
    memberCount: number;
    createdAt: string; // ISO-8601 timestamp
    updatedAt: string; // ISO-8601 timestamp
}

/**
 * Project Detail DTO from Moku API (full details)
 */
export interface ProjectDetailDTO {
    id: string;
    name: string;
    description: string | null;
    type: 'personal' | 'shared';
    createdBy: string;
    organizationId: string;
    active: boolean;
    metadata: Record<string, unknown> | null;
    memberCount: number;
    createdAt: string; // ISO-8601 timestamp
    updatedAt: string; // ISO-8601 timestamp
    userRole: string; // 'owner' | 'editor' | 'viewer'
}

/**
 * Request body for creating a new project
 */
export interface ProjectCreateRequest {
    name: string;
    description?: string | null;
    type?: 'personal' | 'shared' | null;
    metadata?: Record<string, unknown> | null;
}

/**
 * Request body for updating a project
 */
export interface ProjectUpdateRequest {
    name?: string;
    description?: string | null;
    metadata?: Record<string, unknown> | null;
}

/**
 * Query filters for listing projects
 */
export interface ProjectFilters {
    page?: number;
    size?: number;
    sort?: string;
}

/**
 * Project updates response
 */
export interface ProjectUpdatesResponse {
    threadsUpdated: number;
    membersUpdated: number;
    workflowsUpdated: number;
}
