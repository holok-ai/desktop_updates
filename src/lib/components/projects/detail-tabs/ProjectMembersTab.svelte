<script lang="ts">
  import { selectedProjectStore } from '$lib/stores/selected-project.store';
  import type { Project, UserSummaryDTO } from '$lib/types/project.type';
  import { projectService } from '$lib/services/project.service';

  const project = $derived($selectedProjectStore as Project);
  // Type assertion is safe because parent only renders this when project exists

  let searchTerm = $state('');
  let searchResults = $state<UserSummaryDTO[]>([]);
  let isSearching = $state(false);
  let showDropdown = $state(false);

  // Track selected users and their roles
  let selectedUsers = $state<Map<string, 'viewer' | 'editor'>>(new Map());

  // Search users when input changes
  async function handleSearchInput(event: Event): Promise<void> {
    const target = event.target as HTMLInputElement;
    searchTerm = target.value;

    if (searchTerm.length > 0) {
      isSearching = true;
      showDropdown = true;
      try {
        searchResults = await projectService.searchUsers(searchTerm);
        console.log('[ProjectMembersTab] Found users:', searchResults);
      } catch (error) {
        console.error('[ProjectMembersTab] Failed to search users:', error);
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
      // Add user with default viewer role
      selectedUsers.set(user.id, 'viewer');
    } else {
      // Remove user
      selectedUsers.delete(user.id);
    }
    selectedUsers = new Map(selectedUsers); // Trigger reactivity
  }

  function _handleRoleChange(userId: string, role: 'viewer' | 'editor'): void {
    selectedUsers.set(userId, role);
    selectedUsers = new Map(selectedUsers); // Trigger reactivity
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

    // Get user IDs of selected users
    const selectedUserIds = Array.from(selectedUsers.keys());

    if (selectedUserIds.length === 0) {
      console.warn('[ProjectMembersTab] No users selected');
      return;
    }

    console.log(`[ProjectMembersTab] Adding ${selectedUserIds.length} members as ${role}`);

    try {
      const results = await projectService.addMembers(project.id, selectedUserIds, role);

      // Log results
      const successes = results.filter((r) => r.success);
      const failures = results.filter((r) => !r.success);

      console.log(`[ProjectMembersTab] Successfully added ${successes.length} members`);
      if (failures.length > 0) {
        console.error('[ProjectMembersTab] Failed to add:', failures);
      }

      // Clear selection and search
      selectedUsers.clear();
      selectedUsers = new Map(selectedUsers); // Trigger reactivity
      searchTerm = '';
      searchResults = [];
      showDropdown = false;

      // Reload project to update members list
      await projectService.getProjectById(project.id);
    } catch (error) {
      console.error('[ProjectMembersTab] Failed to add members:', error);
    }
  }

  async function handleRemoveMember(memberId: string, memberName: string): Promise<void> {
    if (!project) {
      return;
    }

    console.log(`[ProjectMembersTab] Removing member ${memberName} (${memberId})`);

    try {
      await projectService.removeMember(project.id, memberId);
      console.log(`[ProjectMembersTab] Successfully removed member ${memberName}`);

      // Reload project to update members list
      await projectService.getProjectById(project.id);
    } catch (error) {
      console.error('[ProjectMembersTab] Failed to remove member:', error);
    }
  }
</script>

<svelte:window on:click={handleClickOutside} />

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

<style>
  .members-section {
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

  .add-member-section {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 12px;
    margin-top: 24px;
    padding-top: 24px;
    border-top: 1px solid var(--border-color);
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
    border: 1px solid var(--border-color);
    border-radius: 6px;
    background: var(--background-secondary);
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
    background: var(--background-secondary);
    border: 1px solid var(--border-color);
    border-radius: 8px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
    z-index: 1000;
  }

  .dropdown-item-wrapper {
    border-bottom: 1px solid var(--border-color);
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
    background: var(--background-hover);
  }

  .add-button {
    display: flex;
    align-items: center;
    gap: var(--inline-spacing);
    padding: var(--inline-spacing) var(--content-padding);
    background: var(--surface-overlay);
    color: var(--text-primary);
    border: 1px solid var(--surface-border);
    border-radius: var(--border-radius);
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
    border: 1px solid var(--border-color);
    border-radius: 8px;
    background: var(--background-secondary);
    transition: all 0.2s;
  }

  .member-card:hover {
    border-color: var(--border-color-hover);
    background: var(--background-hover);
  }

  .member-avatar {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: var(--primary-color);
    color: var(--text-on-primary);
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
    background: var(--error-background);
    color: var(--error-text);
  }

  .role-badge.role-editor {
    background: var(--warning-background);
    color: var(--warning-text);
  }

  .role-badge.role-viewer {
    background: var(--info-background);
    color: var(--info-text);
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
    font-size: 24px;
    opacity: 0.3;
  }

  .empty-state h3 {
    font-size: 20px;
    font-weight: 600;
    margin: 0 0 8px 0;
    color: var(--text-primary);
  }

  .empty-state p {
    font-size: 14px;
    margin: 0 0 24px 0;
    max-width: 4000px;
  }
</style>


