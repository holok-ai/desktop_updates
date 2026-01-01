import { ipcMain, BrowserWindow } from 'electron';
import { projectRepository } from '../repository/project-repository.js';
import { threadRepository } from '../repository/thread-repository.js';
import { createScopedLogger, logPerformance } from '../utils/logger.js';
import { getAuthService } from './auth-handler.js';

import type { Project, ProjectPrivacyMode, MemberDTO as FrontendMemberDTO } from '../../src/lib/types/project.type.js';
import type { UserSummaryDTO } from '../services/mokuapi/user.types.js';
import type { MemberDTO as BackendMemberDTO } from '../services/mokuapi/project-member-api.service.js';
import type { Project as BackendProject } from '../repository/project-repository.js';
import { GUID } from '../../src/lib/types/app.type.js';

const projectLog = createScopedLogger('project');

function toRendererProject(p: BackendProject | null): Project | null {
    if (!p) return null;

    const mapMember = (m: BackendMemberDTO): FrontendMemberDTO => ({
        id: m.id,
        userId: m.userId,
        userName: m.userName,
        email: m.userEmail,
        memberRole: m.role,
    });

    return {
        id: p.id,
        name: p.name,
        title: p.name, // For backward compatibility
        description: p.description,
        type: p.type as 'personal' | 'shared',
        active: p.active,
        memberCount: p.memberCount,
        createdBy: p.createdBy,
        organizationId: p.organizationId,
        userRole: p.userRole,
        metadata: p.metadata ? { ...p.metadata } : null,
        createdAt: new Date(p.createdAt.toISOString()),
        updatedAt: new Date(p.updatedAt.toISOString()),
        members: p.members.map(mapMember),
        // Legacy fields
        deletedAt: null,
        privacyMode: 'default',
    };
}

function broadcast(channel: string, ...args: unknown[]): void {
    const windows = BrowserWindow.getAllWindows();
    for (const window of windows) {
        window.webContents.send(channel, ...(args as [unknown]));
    }
}

export function registerProjectHandlers(): void {
    // Get all projects (loads from API)
    ipcMain.handle('project:getAll', async (): Promise<Project[]> => {
        const perfLog = logPerformance('project:getAll');
        try {
            const list = await projectRepository.loadProjects();
            const mapped = list.map((p) => toRendererProject(p)).filter((x): x is Project => x !== null);
            perfLog.end({ count: mapped.length });
            return mapped;
        } catch (error) {
            projectLog.error('Failed to load projects', error);
            perfLog.end({ error: true });
            throw error;
        }
    });

    // Get project by ID
    ipcMain.handle('project:getById', async (_event, id: GUID): Promise<Project | null> => {
        projectLog.info('Get project by id', { projectId: String(id) });
        try {
            const project = await projectRepository.getProject(id);
            return toRendererProject(project);
        } catch (error) {
            projectLog.error('Failed to get project', error);
            throw error;
        }
    });

    // Create project
    ipcMain.handle(
        'project:create',
        async (
            _event,
            data: {
                title: string;
                description?: string;
                type?: string;
                metadata?: Record<string, unknown>;
                privacyMode?: ProjectPrivacyMode;
            },
        ): Promise<Project> => {
            const perfLog = logPerformance('project:create');
            projectLog.info('Create called', { title: data.title, type: data.type });

            const auth = getAuthService();
            if (!auth.isAuthenticated()) {
                throw new Error('Authentication required');
            }

            if (!data.title || data.title.trim().length === 0) {
                throw new Error('Project title is required');
            }

            try {
                const project = await projectRepository.createProject(
                    data.title.trim(),
                    data.description?.trim(),
                    data.type, // type parameter
                    data.metadata,
                );
                const rp = toRendererProject(project);
                if (!rp) throw new Error('Failed to convert created project');

                broadcast('project:created', rp);
                perfLog.end({ projectId: project.id });
                return rp;
            } catch (error) {
                projectLog.error('Failed to create project', error);
                perfLog.end({ error: true });
                throw error;
            }
        },
    );

    // Update/rename project
    ipcMain.handle(
        'project:update',
        async (
            _event,
            id: GUID,
            updates: {
                title?: string;
                description?: string;
                metadata?: Record<string, unknown>;
                privacyMode?: ProjectPrivacyMode;
            },
        ): Promise<Project> => {
            const perfLog = logPerformance('project:update');
            projectLog.info('Update called');

            const auth = getAuthService();
            if (!auth.isAuthenticated()) {
                throw new Error('Authentication required');
            }

            if (updates.title !== undefined && updates.title.trim().length === 0) {
                throw new Error('Project title cannot be empty');
            }

            try {
                const updateData: { name?: string; description?: string | null; metadata?: Record<string, unknown> | null } = {};
                if (updates.title !== undefined) updateData.name = updates.title.trim();
                if (updates.description !== undefined) updateData.description = updates.description.trim();
                if (updates.metadata !== undefined) updateData.metadata = updates.metadata;

                const updated = await projectRepository.updateProject(id, updateData);
                const rp = toRendererProject(updated);
                if (!rp) throw new Error('Failed to convert updated project');

                broadcast('project:updated', rp);
                perfLog.end({ projectId: id });
                return rp;
            } catch (error) {
                projectLog.error('Failed to update project', error);
                perfLog.end({ error: true });
                throw error;
            }
        },
    );

    // Delete project
    ipcMain.handle(
        'project:delete',
        async (_event, id: GUID, options?: { deleteThreads?: boolean }): Promise<boolean> => {
            const perfLog = logPerformance('project:delete');
            projectLog.info('Delete called', { projectId: String(id), options });

            const auth = getAuthService();
            if (!auth.isAuthenticated()) {
                throw new Error('Authentication required');
            }

            try {
                const project = await projectRepository.getProject(id);
                if (!project) {
                    return false;
                }

                // Handle thread deletion/reassignment
                if (options?.deleteThreads) {
                    // Delete all threads associated with this project
                    const threads = await threadRepository.listThreads();
                    const projectThreads = threads.filter((t) => t.metadata?.projectId === id);

                    for (const thread of projectThreads) {
                        await threadRepository.softDeleteThread(thread.id);
                    }
                    projectLog.info('Deleted associated threads', {
                        projectId: String(id),
                        threadCount: projectThreads.length,
                    });
                } else {
                    // Unassign threads from project (set projectId to undefined)
                    const threads = await threadRepository.listThreads();
                    const projectThreads = threads.filter((t) => t.metadata?.projectId === id);

                    for (const thread of projectThreads) {
                        const newMetadata = { ...thread.metadata };
                        delete newMetadata.projectId;
                        threadRepository.updateThreadMetadata(thread.id, newMetadata);
                    }
                    projectLog.info('Unassigned threads from project', {
                        projectId: String(id),
                        threadCount: projectThreads.length,
                    });
                }

                await projectRepository.deleteProject(id);
                broadcast('project:deleted', id);
                perfLog.end({ projectId: id, deleted: true });
                return true;
            } catch (error) {
                projectLog.error('Failed to delete project', error);
                perfLog.end({ error: true });
                throw error;
            }
        },
    );

    // Get threads for a project
    ipcMain.handle('project:getThreads', async (_event, projectId: GUID): Promise<number> => {
        const threads = await threadRepository.listThreads();
        const projectThreads = threads.filter((t) => t.metadata?.projectId === projectId);
        return projectThreads.length;
    });

    // Search users in organization
    ipcMain.handle(
        'project:searchUsers',
        async (_event, searchTerm?: string | null): Promise<UserSummaryDTO[]> => {
            const perfLog = logPerformance('project:searchUsers');
            projectLog.info('Search users called', { searchTerm });

            const auth = getAuthService();
            if (!auth.isAuthenticated()) {
                throw new Error('Authentication required');
            }

            try {
                const users = await projectRepository.searchUsers(searchTerm);
                perfLog.end({ userCount: users.length });
                return users;
            } catch (error) {
                projectLog.error('Failed to search users', error);
                perfLog.end({ error: true });
                throw error;
            }
        },
    );

    projectLog.info('Handlers registered');
}

export function unregisterProjectHandlers(): void {
    ipcMain.removeHandler('project:getAll');
    ipcMain.removeHandler('project:getById');
    ipcMain.removeHandler('project:create');
    ipcMain.removeHandler('project:update');
    ipcMain.removeHandler('project:delete');
    ipcMain.removeHandler('project:getThreads');
    ipcMain.removeHandler('project:searchUsers');
    projectLog.info('Handlers unregistered');
}
