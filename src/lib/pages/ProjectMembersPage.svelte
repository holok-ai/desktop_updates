<script lang="ts">
  import { onMount } from 'svelte';
  import { querystring, push } from 'svelte-spa-router';
  import { ROUTE } from '$lib/constants/route.constant';
  import type { Project, UserSummaryDTO } from '$lib/types/project.type';
  import { projectService } from '$lib/services/project.service';

  let projectId = $state<string | null>(null);
  let project = $state<Project | null>(null);
  let loading = $state(false);
  let error = $state('');

  let searchTerm = $state('');
  let searchResults = $state<UserSummaryDTO[]>([]);
  let isSearching = $state(false);
  let showDropdown = $state(false);

  // Track selected users and their roles
  let selectedUsers = $state<Map<string, 'viewer' | 'editor'>>(new Map());

  // Parse projectId from query string and load project
  $effect(() => {
    const qs = $querystring;
    if (qs) {
      const params = new URLSearchParams(qs);
      const id = params.get('projectId');
      if (id && id !== projectId) {
        projectId = id;
        void loadProject(id);
      }
    }
  });

  async function loadProject(id: string) {
    loading = true;
    error = '';
    try {
      project = await projectService.getProjectById(id);
    } catch (e) {
      console.error('Failed to load project:', e);
      error = e instanceof Error ? e.message : 'Failed to load project';
      project = null;
    } finally {
      loading = false;
    }
  }

  // Search users when input changes
  async function handleSearchInput(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;

    if (searchTerm.length > 0) {
      isSearching = true;
      showDropdown = true;
      try {
        searchResults = await projectService.searchUsers(searchTerm);
      } catch (error) {
        console.error('[ProjectMembersPage] Failed to search users:', error);
        searchResults = [];
      } finally {
        isSearching = false;
      }
    } else {
      showDropdown = false;
      searchResults = [];
    }
  }

  function handleUserCheckboxChange(user: UserSummaryDTO, checked: boolean): void {
    if (checked) {
      selectedUsers.set(user.id, 'viewer');
    } else {
      selectedUsers.delete(user.id);
    }
    selectedUsers = new Map(selectedUsers);
  }

  function handleClickOutside(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.search-container')) {
      showDropdown = false;
    }
  }

  async function handleAddMembers(role: 'viewer' | 'editor'): Promise<void> {
    if (!project || selectedUsers.size === 0) {
      return;
    }

    const selectedUserIds = Array.from(selectedUsers.keys());

    if (selectedUserIds.length === 0) {
      console.warn('[ProjectMembersPage] No users selected');
      return;
    }

    console.log(`[ProjectMembersPage] Adding ${selectedUserIds.length} members as ${role}`);

    try {
      const results = await projectService.addMembers(project.id, selectedUserIds, role);

      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      console.log(`[ProjectMembersPage] Successfully added ${successes.length} members`);
      if (failures.length > 0) {
        console.error('[ProjectMembersPage] Failed to add:', failures);
      }

      // Clear selection and search
      selectedUsers.clear();
      selectedUsers = new Map(selectedUsers);
      searchTerm = '';
      searchResults = [];
      showDropdown = false;

      // Reload project to update members list
      if (projectId) {
        await loadProject(projectId);
      }
    } catch (error) {
      console.error('[ProjectMembersPage] Failed to add members:', error);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string): Promise<void> {
    if (!project) {
      return;
    }

    console.log(`[ProjectMembersPage] Removing member ${memberName} (${memberId})`);

    try {
      await projectService.removeMember(project.id, memberId);
      console.log(`[ProjectMembersPage] Successfully removed member ${memberName}`);

      // Reload project to update members list
      if (projectId) {
        await loadProject(projectId);
      }
    } catch (error) {
      console.error('[ProjectMembersPage] Failed to remove member:', error);
    }
  }

  function handleBackToProject() {
    if (projectId) {
      push(`${ROUTE.PROJECTS}?projectId=${projectId}`);
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="project-members-page">
  <header class="page-header">
    <div class="header-content">
      <button class="back-button" onclick={handleBackToProject} aria-label="Back to project">
        <i class="pi pi-arrow-left"></i>
      </button>
      <h1>Project Members</h1>
    </div>
  </header>

  <div class="page-content">
    {#if loading}
      <div class="loading-state">Loading members...</div>
    {:else if error}
      <div class="error-state">{error}</div>
    {:else if project}
      <div class="members-section">
        <div class="members-header">
          <h2 class="members-title">Members ({project?.members?.length ?? 0})</h2>
        </div>

        {#if !project?.members || project.members.length === 0}
          <div class="empty-state">
            <i class="pi pi-users"></i>
            <h3>You're the only member</h3>
            <p>Invite team members to collaborate on this project</p>
          </div>
        {:else}
          <div class="members-list">
            {#each project.members as member (member.id)}
              <div class="member-card">
                <div class="member-avatar">
                  <i class="pi pi-user"></i>
                </div>
                <div class="member-info">
                  <div class="member-name">{member.userName}</div>
                  <div class="member-email">{member.email}</div>
                </div>
                <div class="member-role">
                  <span class="role-badge role-{member.memberRole.toLowerCase()}">{member.memberRole}</span>
                </div>
                {#if member.memberRole.toLowerCase() !== 'owner'}
                  <button
                    class="delete-member-btn"
                    title="Remove member"
                    aria-label="Remove {member.userName}"
                    onclick={() => handleRemoveMember(member.id, member.userName)}
                  >
                    <i class="pi pi-trash"></i>
                  </button>
                {/if}
              </div>
            {/each}
          </div>

          {#if project.type === 'shared'}
            <div class="add-member-section">
              <div class="label-and-buttons">
                <label for="user-search" class="find-user-label">Find user(s):</label>
                <div class="button-column">
                  <button class="add-button add-viewer" onclick={() => handleAddMembers('viewer')} disabled={selectedUsers.size === 0}>Add Viewer</button>
                  <button class="add-button add-editor" onclick={() => handleAddMembers('editor')} disabled={selectedUsers.size === 0}>Add Editor</button>
                </div>
              </div>
              <div class="search-container">
                <input
                  id="user-search"
                  type="text"
                  class="search-input"
                  placeholder="Search users to add..."
                  value={searchTerm}
                  oninput={handleSearchInput}
                />

                {#if showDropdown && searchTerm.length > 0}
                  <div class="search-dropdown">
                    {#if isSearching}
                      <div class="dropdown-item-wrapper">
                        <div class="dropdown-item loading">
                          <i class="pi pi-spinner pi-spin"></i>
                          <span>Searching...</span>
                        </div>
                      </div>
                    {:else if searchResults.length === 0}
                      <div class="dropdown-item-wrapper">
                        <div class="dropdown-item empty">
                          <i class="pi pi-info-circle"></i>
                          <span>No users found</span>
                        </div>
                      </div>
                    {:else}
                      {#each searchResults as user (user.id)}
                        <div class="dropdown-item-wrapper">
                          <label class="dropdown-item">
                            <input
                              type="checkbox"
                              checked={selectedUsers.has(user.id)}
                              onchange={(e) => handleUserCheckboxChange(user, (e.target as HTMLInputElement).checked)}
                            />
                            <div class="user-info">
                              <span class="user-display">{user.displayName} - {user.email}</span>
                            </div>
                          </label>
                        </div>
                      {/each}
                    {/if}
                  </div>
                {/if}
              </div>
            </div>
          {/if}
        {/if}
      </div>
    {/if}
  </div>
</div>

<style>
  .project-members-page {
    display: flex;
    flex-direction: column;
    height: 100%;
    background: var(--surface-main, #fafafa);
  }

  .page-header {
    padding: 1rem 1.5rem;
    border-bottom: 1px solid var(--surface-border, #e0e0e0);
    background: var(--surface-card, #fff);
  }

  .header-content {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .back-button {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    background: transparent;
    border: none;
    color: var(--text-secondary);
    cursor: pointer;
    border-radius: 4px;
    transition: all 0.2s;
  }

  .back-button:hover {
    background: var(--surface-hover);
    color: var(--text-primary);
  }

  .page-header h1 {
    margin: 0;
    font-size: 1.5rem;
    font-weight: 600;
    color: var(--text-primary);
  }

  .page-content {
    flex: 1;
    padding: 1.5rem;
    overflow-y: auto;
  }

  .loading-state,
  .error-state {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 2rem;
    color: var(--text-secondary);
  }

  .error-state {
    color: var(--error-color, #dc2626);
  }

  .members-section {
    max-width: 800px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .members-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .members-title {
    font-size: 18px;
    font-weight: 600;
    color: var(--text-primary);
    margin: 0;
  }

  .members-list {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .member-card {
    display: flex;
    align-items: center;
    gap: 16px;
    padding: 16px;
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    background: var(--surface-card);
    transition: all 0.2s;
  }

  .member-card:hover {
    border-color: var(--primary-color);
    background: var(--surface-hover);
  }

  .member-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--primary-color);
    color: white;
    font-size: 20px;
    flex-shrink: 0;
  }

  .member-info {
    flex: 1;
    min-width: 0;
  }

  .member-name {
    font-size: 15px;
    font-weight: 600;
    color: var(--text-primary);
    margin-bottom: 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-email {
    font-size: 13px;
    color: var(--text-secondary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .member-role {
    flex-shrink: 0;
  }

  .delete-member-btn {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 32px;
    height: 32px;
    padding: 0;
    margin-left: 8px;
    background: transparent;
    border: none;
    border-radius: 4px;
    color: #ef4444;
    cursor: pointer;
    transition: all 0.2s;
    flex-shrink: 0;
  }

  .delete-member-btn:hover {
    background: rgba(239, 68, 68, 0.1);
    color: #dc2626;
  }

  .delete-member-btn i {
    font-size: 16px;
  }

  .role-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 600;
    text-transform: capitalize;
  }

  .role-badge.role-owner {
    background: #fef2f2;
    color: #dc2626;
  }

  .role-badge.role-editor {
    background: #fffbeb;
    color: #d97706;
  }

  .role-badge.role-viewer {
    background: #eff6ff;
    color: #2563eb;
  }

  .empty-state {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    color: var(--text-secondary);
    text-align: center;
    padding: 40px;
  }

  .empty-state i {
    font-size: 48px;
    opacity: 0.3;
    margin-bottom: 16px;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0;
  }

  .add-member-section {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--surface-border);
    align-items: start;
  }

  .label-and-buttons {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .button-column {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }

  .find-user-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
    white-space: nowrap;
  }

  .search-container {
    position: relative;
    flex: 1;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    background: var(--surface-card);
    color: var(--text-primary);
    font-size: 14px;
    transition: border-color 0.2s;
  }

  .search-input:focus {
    outline: none;
    border-color: var(--primary-color);
  }

  .search-input::placeholder {
    color: var(--text-secondary);
  }

  .search-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    right: 0;
    max-height: 400px;
    overflow-y: auto;
    background: var(--surface-card);
    border: 1px solid var(--surface-border);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .dropdown-item-wrapper {
    border-bottom: 1px solid var(--surface-border);
  }

  .dropdown-item-wrapper:last-child {
    border-bottom: none;
  }

  .dropdown-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 16px;
    cursor: pointer;
    transition: background 0.2s;
  }

  .dropdown-item:hover {
    background: var(--surface-hover);
  }

  .add-button {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 16px;
    background: var(--surface-card);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    font-size: 14px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
    min-width: max-content;
  }

  .add-button:hover:not(:disabled) {
    background: var(--surface-hover);
    border-color: var(--primary-color);
  }

  .add-button:disabled {
    opacity: 0.5;
    cursor: not-allowed;
  }

  .dropdown-item.loading,
  .dropdown-item.empty {
    cursor: default;
    color: var(--text-secondary);
  }

  .dropdown-item.loading:hover,
  .dropdown-item.empty:hover {
    background: transparent;
  }

  .dropdown-item input[type="checkbox"] {
    width: 18px;
    height: 18px;
    cursor: pointer;
    accent-color: var(--primary-color);
  }

  .dropdown-item .user-info {
    flex: 1;
    min-width: 0;
  }

  .dropdown-item .user-display {
    font-size: 14px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }

  .pi-spin {
    animation: spin 1s linear infinite;
  }

  @keyframes spin {
    from {
      transform: rotate(0deg);
    }
    to {
      transform: rotate(360deg);
    }
  }
</style>
