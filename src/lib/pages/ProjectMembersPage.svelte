<script lang="ts">
  import { onMount as _onMount } from 'svelte';
  import { querystring, push as _push } from 'svelte-spa-router';
  import { ROUTE as _ROUTE } from '$lib/constants/route.constant';
  import type { Project, UserSummaryDTO } from '$lib/types/project.type';
  import type { GUID } from '$lib/types/app.type';
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
      const result = await projectService.getProjectById(id as GUID);
      project = result.success ? result.data : null;
      if (!result.success) {
        error = result.errorText || 'Failed to load project';
      }
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
        const searchResult = await projectService.searchUsers(searchTerm);
        searchResults = searchResult.success ? searchResult.data : [];
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

  function _handleUserCheckboxChange(user: UserSummaryDTO, checked: boolean): void {
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

  async function _handleAddMembers(role: 'viewer' | 'editor'): Promise<void> {
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

  async function handleAddSingleMember(userId: string, role: 'viewer' | 'editor'): Promise<void> {
    if (!project) {
      return;
    }

    console.log(`[ProjectMembersPage] Adding member ${userId} as ${role}`);

    try {
      const results = await projectService.addMembers(project.id, [userId], role);

      if (results[0]?.success) {
        console.log(`[ProjectMembersPage] Successfully added member as ${role}`);

        // Clear search
        searchTerm = '';
        searchResults = [];
        showDropdown = false;

        // Reload project to update members list
        if (projectId) {
          await loadProject(projectId);
        }
      } else {
        console.error('[ProjectMembersPage] Failed to add member:', results[0]);
      }
    } catch (error) {
      console.error('[ProjectMembersPage] Failed to add member:', error);
    }
  }
</script>

<svelte:window onclick={handleClickOutside} />

<div class="page-container">
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
                <span class="role-badge role-{member.memberRole.toLowerCase()}"
                  >{member.memberRole}</span
                >
                <div class="member-info">
                  <div class="member-name">{member.userName}</div>
                  <div class="member-email">{member.email}</div>
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
              <label for="user-search" class="find-user-label">Find user(s):</label>

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
                          <div class="dropdown-item">
                            <div class="user-info">
                              <span class="user-display">{user.displayName} - {user.email}</span>
                            </div>
                            <div class="user-actions">
                              <button
                                class="add-button add-viewer"
                                onclick={() => handleAddSingleMember(user.id, 'viewer')}
                              >
                                Add Viewer
                              </button>
                              <button
                                class="add-button add-editor"
                                onclick={() => handleAddSingleMember(user.id, 'editor')}
                              >
                                Add Editor
                              </button>
                            </div>
                          </div>
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
  .page-container {
    display: flex;
    flex-direction: column;
    height: 100%;
    overflow-y: auto;
    padding: 2rem 1.2rem;
    background: var(--surface-main);
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
    background: color-mix(in srgb, var(--info-color) 12%, var(--surface-card));
    color: var(--info-color);
    border: 1px solid color-mix(in srgb, var(--info-color) 30%, transparent);
  }

  .role-badge.role-editor {
    background: color-mix(in srgb, var(--success-color) 12%, var(--surface-card));
    color: var(--success-color);
    border: 1px solid color-mix(in srgb, var(--success-color) 30%, transparent);
  }

  .role-badge.role-viewer {
    background: color-mix(in srgb, var(--text-secondary) 8%, var(--surface-card));
    color: var(--text-secondary);
    border: 1px solid color-mix(in srgb, var(--text-secondary) 20%, transparent);
  }

  .add-member-section {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--surface-border);
    align-items: flex-start;
  }

  .find-user-label {
    font-size: 14px;
    font-weight: 600;
    color: var(--text-primary);
  }

  .search-container {
    position: relative;
    width: 100%;
  }

  .button-row {
    display: flex;
    gap: 8px;
    align-items: center;
  }

  .search-input {
    width: 100%;
    padding: 10px 14px;
    border: 1px solid var(--input-border, #d1d5db);
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
    justify-content: space-between;
    gap: 12px;
    padding: 12px 16px;
  }

  .dropdown-item .user-info {
    flex: 1;
    min-width: 0;
  }

  .user-actions {
    display: flex;
    gap: 8px;
  }

  .add-button {
    padding: 6px 12px;
    background: var(--surface-card);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: 6px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.2s;
    white-space: nowrap;
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
    color: var(--text-secondary);
  }

  .dropdown-item .user-display {
    font-size: 14px;
    color: var(--text-primary);
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
</style>
