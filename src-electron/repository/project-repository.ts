/**
 * Project Repository
 * Loads projects from Moku API and provides local caching
 */

import log from 'electron-log';
import type { ProjectDTO, ProjectDetailDTO } from '../services/mokuapi/project.types.js';
import { projectApiService } from '../services/mokuapi/project-api.service.js';

export interface Project {
    id: string;
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
}

export class ProjectRepository {
    private readonly projectsById: Map<string, Project> = new Map();
    private lastLoadTime: number = 0;
    private readonly CACHE_TTL = 60000; // 1 minute cache TTL

    /**
     * Load all projects from API
     * Returns cached results if they are fresh enough
     */
    public async loadProjects(forceRefresh: boolean = false): Promise<Project[]> {
        const now = Date.now();

        // Return cached if not forcing refresh and cache is fresh
        if (!forceRefresh && now - this.lastLoadTime < this.CACHE_TTL && this.projectsById.size > 0) {
            log.debug('[ProjectRepository] Returning cached projects');
            return this.listProjects();
        }

        try {
            log.info('[ProjectRepository] Loading projects from API');
            const response = await projectApiService.getProjects({ size: 1000 });

            // Clear cache and rebuild
            this.projectsById.clear();

            for (const dto of response.content) {
                const project = this.mapDTOToProject(dto);
                this.projectsById.set(project.id, project);
            }

            this.lastLoadTime = now;
            log.info('[ProjectRepository] Loaded', this.projectsById.size, 'projects');

            return this.listProjects();
        } catch (error) {
            log.error('[ProjectRepository] Failed to load projects:', error);
            // Return cached projects if available, otherwise empty array
            return this.listProjects();
        }
    }

    /**
     * Get a single project by ID
     * Fetches from API if not in cache
     */
    public async getProject(projectId: string): Promise<Project | null> {
        // Check cache first
        const cached = this.projectsById.get(projectId);
        if (cached) {
            log.debug('[ProjectRepository] Returning cached project:', projectId);
            return this.cloneProject(cached);
        }

        // Load from API
        try {
            log.info('[ProjectRepository] Fetching project from API:', projectId);
            const dto = await projectApiService.getProject(projectId);
            const project = this.mapDetailDTOToProject(dto);

            // Cache it
            this.projectsById.set(project.id, project);

            return this.cloneProject(project);
        } catch (error) {
            log.error('[ProjectRepository] Failed to load project:', projectId, error);
            return null;
        }
    }

    /**
     * List all cached projects sorted by name
     */
    public listProjects(): Project[] {
        return Array.from(this.projectsById.values())
            .filter((p) => p.status === 'active')
            .map((p) => this.cloneProject(p))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * List personal projects (type="personal")
     * Note: API already filters to only return personal projects created by user
     */
    public listPersonalProjects(): Project[] {
        return Array.from(this.projectsById.values())
            .filter((p) => p.status === 'active' && p.type === 'personal')
            .map((p) => this.cloneProject(p))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * List shared projects (type="shared")
     * Note: API already filters to only return shared projects where user is a member
     */
    public listSharedProjects(): Project[] {
        return Array.from(this.projectsById.values())
            .filter((p) => p.status === 'active' && p.type === 'shared')
            .map((p) => this.cloneProject(p))
            .sort((a, b) => a.name.localeCompare(b.name));
    }

    /**
     * Create a new project via API
     */
    public async createProject(name: string, description?: string, type?: string, metadata?: Record<string, unknown>): Promise<Project> {
        try {
            log.info('[ProjectRepository] Creating project:', name);
            const dto = await projectApiService.createProject({
                name,
                description: description || null,
                type: type || null,
                metadata: metadata || null,
            });

            const project = this.mapDetailDTOToProject(dto);

            // Add to cache
            this.projectsById.set(project.id, project);

            return this.cloneProject(project);
        } catch (error) {
            log.error('[ProjectRepository] Failed to create project:', error);
            throw error;
        }
    }

    /**
     * Update an existing project via API
     */
    public async updateProject(
        projectId: string,
        updates: { name?: string; description?: string | null; metadata?: Record<string, unknown> | null }
    ): Promise<Project> {
        try {
            log.info('[ProjectRepository] Updating project:', projectId);
            const dto = await projectApiService.updateProject(projectId, updates);

            const project = this.mapDetailDTOToProject(dto);

            // Update cache
            this.projectsById.set(project.id, project);

            return this.cloneProject(project);
        } catch (error) {
            log.error('[ProjectRepository] Failed to update project:', error);
            throw error;
        }
    }

    /**
     * Delete a project via API (soft delete)
     */
    public async deleteProject(projectId: string): Promise<void> {
        try {
            log.info('[ProjectRepository] Deleting project:', projectId);
            await projectApiService.deleteProject(projectId);

            // Remove from cache
            this.projectsById.delete(projectId);
        } catch (error) {
            log.error('[ProjectRepository] Failed to delete project:', error);
            throw error;
        }
    }

    /**
     * Clear all cached projects
     */
    public clearCache(): void {
        this.projectsById.clear();
        this.lastLoadTime = 0;
        log.info('[ProjectRepository] Cache cleared');
    }

    /**
     * Map ProjectDTO (list view) to Project domain model
     */
    private mapDTOToProject(dto: ProjectDTO): Project {
        return {
            id: dto.id,
            name: dto.name,
            description: dto.description,
            type: dto.type,
            status: dto.status,
            active: dto.active,
            memberCount: dto.memberCount,
            createdBy: '', // Not available in list DTO
            organizationId: '', // Not available in list DTO
            userRole: '', // Not available in list DTO
            metadata: null,
            createdAt: new Date(dto.createdAt),
            updatedAt: new Date(dto.updatedAt),
        };
    }

    /**
     * Map ProjectDetailDTO (detail view) to Project domain model
     */
    private mapDetailDTOToProject(dto: ProjectDetailDTO): Project {
        return {
            id: dto.id,
            name: dto.name,
            description: dto.description,
            type: dto.type,
            status: dto.status,
            active: dto.status === 'active',
            memberCount: dto.memberCount,
            createdBy: dto.createdBy,
            organizationId: dto.organizationId,
            userRole: dto.userRole,
            metadata: dto.metadata,
            createdAt: new Date(dto.createdAt),
            updatedAt: new Date(dto.updatedAt),
        };
    }

    /**
     * Clone a project object for immutability
     */
    private cloneProject(project: Project): Project {
        return {
            id: project.id,
            name: project.name,
            description: project.description,
            type: project.type,
            status: project.status,
            active: project.active,
            memberCount: project.memberCount,
            createdBy: project.createdBy,
            organizationId: project.organizationId,
            userRole: project.userRole,
            metadata: project.metadata ? { ...project.metadata } : null,
            createdAt: new Date(project.createdAt),
            updatedAt: new Date(project.updatedAt),
        };
    }
}

export const projectRepository = new ProjectRepository();
export default ProjectRepository;
