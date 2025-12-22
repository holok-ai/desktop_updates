import type { GUID } from './app.type.js';

export type ProjectPrivacyMode = 'default' | 'project_only';

/**
 * Project type matching backend API structure
 */
export interface Project {
    id: GUID;
    name: string;
    description: string | null;
    type: string;
    status: string;
    active: boolean;
    memberCount: number;
    createdBy: string;
    organizationId: string;
    userRole: string; // 'owner' | 'editor' | 'viewer'
    metadata: Record<string, unknown> | null;
    createdAt: Date;
    updatedAt: Date;
    members: MemberDTO[];
    // Legacy fields for backward compatibility
    title?: string; // Alias for name
    deletedAt?: Date | null;
    privacyMode?: ProjectPrivacyMode;
}

export type ProjectCreateInput = Omit<Project, 'id' | 'createdAt' | 'updatedAt' | 'deletedAt'>;

export type ProjectUpdateInput = Partial<Omit<Project, 'id' | 'createdAt' | 'updatedAt'>>;

/**
 * User Summary DTO from Moku API for project member management
 */
export interface UserSummaryDTO {
    id: string;
    email: string;
    displayName: string;
    active: boolean;
    roles: string[];
    provider: string;
    lastLogin: string | null;
    createdAt: string;
}

/**
 * Project Member DTO
 */
export interface MemberDTO {
    id: string;
    userId: string;
    userName: string;
    email: string;
    memberRole: string; // 'owner' | 'editor' | 'viewer'
}
