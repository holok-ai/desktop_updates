# Story 3.8: Thread Copy Functionality (Bidirectional)

Status: ready-for-dev

## Story

As a desktop application user,
I want to copy threads bidirectionally between personal and project contexts with automatic file migration,
so that I can move my work between personal and collaborative spaces while preserving all content and attachments.

## Acceptance Criteria

1. Right-click thread shows "Copy to Personal" OR "Copy to Project..." option
2. **Copy to Personal:** Permission check (user must be thread owner)
3. **Copy to Personal:** Thread copied with all messages to personal context
4. **Copy to Personal:** Project files in Storage Service downloaded to local filesystem
5. **Copy to Project:** Dialog shows list of user's projects (editor/owner roles only)
6. **Copy to Project:** Permission check (must have edit access to target project)
7. **Copy to Project:** Personal local files uploaded to Storage Service
8. Thread without files copies in <3s
9. Thread with files: file migration (upload or download) before copy completes
10. Thread with files copies in <10s for up to 10MB total attachments
11. File migration failure rolls back thread copy (atomic operation, transactional)
12. Copied thread appears in target context, original thread remains unchanged (copy semantics, not move)
13. Cache invalidation for target project threads (if copying to project)
14. API endpoint: `POST /api/threads/copy` with `{ sourceThreadId, targetContext, projectId? }`

## Tasks / Subtasks

- [ ] **Task 1: Implement Thread Context Menu (AC: 1)**
  - [ ] Add right-click context menu to thread list items
  - [ ] Show "Copy to Personal" option if thread is in project context
  - [ ] Show "Copy to Project..." option if thread is in personal context
  - [ ] Handle menu item selection (open dialog or start copy flow)

- [ ] **Task 2: Implement Copy to Personal Flow (AC: 2-4)**
  - [ ] Check permission: User must be thread owner
  - [ ] If not owner, show error: "Only thread owner can copy to personal"
  - [ ] Call API: POST /api/threads/copy with { sourceThreadId, targetContext: 'personal' }
  - [ ] **File Migration (Project → Personal):**
    - Identify file attachments in thread messages
    - Download files from Storage Service
    - Save files to local filesystem (personal threads use local storage)
    - Update attachment references in copied messages
  - [ ] Create new personal thread with copied messages
  - [ ] Original project thread remains unchanged (copy semantics)
  - [ ] Navigate to new personal thread, show toast: "Thread copied to personal"

- [ ] **Task 3: Implement Copy to Project Flow (AC: 5-7)**
  - [ ] Show project selection dialog
  - [ ] Fetch user's projects: Filter by role (editor/owner only, exclude viewer)
  - [ ] Display project list: Name, color (Moku Web palette), icon
  - [ ] User selects target project, clicks "Copy"
  - [ ] Check permission: Must have edit access to target project
  - [ ] If viewer, show error: "You need editor or owner access to copy threads to this project"
  - [ ] Call API: POST /api/threads/copy with { sourceThreadId, targetContext: 'project', projectId }
  - [ ] **File Migration (Personal → Project):**
    - Identify file attachments in thread messages
    - Upload local files to Storage Service (project threads use cloud storage)
    - Update attachment references in copied messages
  - [ ] Create new project thread with copied messages
  - [ ] Original personal thread remains unchanged (copy semantics)
  - [ ] Invalidate project threads cache: ProjectCache.invalidate(`threads:${projectId}`)
  - [ ] Navigate to new project thread, show toast: "Thread copied to {projectName}"

- [ ] **Task 4: Implement File Migration Service (AC: 4, 7, 9-10)**
  - [ ] Create ThreadCopyService with file migration logic
  - [ ] **Download Files (Storage Service → Local):**
    - Fetch file metadata from Storage Service
    - Download file content (streaming for large files)
    - Save to local filesystem (user data directory)
    - Update attachment references (storage URL → local path)
  - [ ] **Upload Files (Local → Storage Service):**
    - Read local file content
    - Upload to Storage Service (multipart upload for large files)
    - Update attachment references (local path → storage URL)
  - [ ] Benchmark file migration: <3s for threads without files, <10s for up to 10MB attachments
  - [ ] Handle file migration errors (network failure, storage quota exceeded)

- [ ] **Task 5: Implement Transactional Copy with Rollback (AC: 11)**
  - [ ] Wrap thread copy + file migration in transaction-like flow
  - [ ] **Copy Flow:**
    1. Start copy operation (begin transaction)
    2. Migrate files (upload or download)
    3. If file migration succeeds: Create new thread with messages
    4. If file migration fails: Rollback (delete partial uploads, do not create thread)
  - [ ] On success: Commit (finalize thread creation, update cache)
  - [ ] On failure: Rollback (clean up partial files, show error, original thread unchanged)
  - [ ] Show error message: "Copy failed due to file migration error. Original thread unchanged."

- [ ] **Task 6: Implement Copy Semantics (AC: 12)**
  - [ ] Ensure original thread remains unchanged (copy, not move)
  - [ ] Copied thread gets new thread ID
  - [ ] Copied messages get new message IDs (preserve order and content)
  - [ ] Attachment references updated (storage URL or local path)
  - [ ] Copied thread shows in target context (personal list or project threads)
  - [ ] Original thread remains in source context

- [ ] **Task 7: Implement Cache Invalidation (AC: 13)**
  - [ ] If copying to project: Invalidate project threads cache
  - [ ] Call: ProjectCache.invalidate(`threads:${projectId}`)
  - [ ] Re-fetch project threads on next view load (cache miss → API call)
  - [ ] UI updates to show new copied thread in project

- [ ] **Task 8: Testing (AC: 8-14)**
  - [ ] Unit test: Permission checks (owner for copy to personal, editor/owner for copy to project)
  - [ ] Unit test: File migration logic (upload/download, rollback on failure)
  - [ ] E2E test: Copy personal → project with files (upload to Storage Service)
  - [ ] E2E test: Copy project → personal with files (download to local)
  - [ ] E2E test: Copy without files (<3s)
  - [ ] E2E test: Copy with 10MB files (<10s)
  - [ ] E2E test: File migration failure rollback (simulate network failure, verify thread not created)
  - [ ] E2E test: Copy semantics (original thread unchanged, both threads exist)
  - [ ] Integration test: Cache invalidation (verify project threads cache updated)
  - [ ] Performance test: Copy timing benchmarks

## Dev Notes

### Bidirectional Thread Copy (Tech Spec §4.4, Open Question #4)

**DECISION:** YES - Threads can be copied from project to personal (bidirectional)

**Rationale:** Users may want to copy project threads to personal workspace for experimentation or archival

**Implementation:**
- **Copy to Personal**: Project thread → Personal context
  - Permission: Only thread owner can copy
  - File migration: Download Storage Service files to local filesystem
- **Copy to Project**: Personal thread → Project context
  - Permission: Must have edit access (editor/owner role)
  - File migration: Upload local files to Storage Service
- **Copy Semantics**: Original thread remains in source context, copy created in target context

### File Storage Bifurcation (Tech Spec §3, §7)

**Personal Threads:**
- Files stored locally (existing behavior)
- File path: `{user_data_dir}/threads/{threadId}/attachments/{fileId}`

**Project Threads:**
- Files stored in Storage Service (cloud storage)
- File URL: `https://storage.moku.ai/projects/{projectId}/threads/{threadId}/files/{fileId}`

**Migration Direction:**
- **Personal → Project**: Upload local files to Storage Service
- **Project → Personal**: Download Storage Service files to local filesystem

### Thread Copy Flow (Tech Spec §4.4)

**Option A: Copy to Personal**
1. User right-clicks project thread → "Copy to Personal"
2. Permission check: User must be thread owner
3. API call: POST /api/threads/copy with { sourceThreadId, targetContext: 'personal' }
4. **File Migration:**
   - Identify attachments in messages
   - Download files from Storage Service: GET {storage_url}
   - Save to local filesystem: `{user_data_dir}/threads/{newThreadId}/attachments/{fileId}`
5. Create new personal thread with copied messages (new thread ID, new message IDs)
6. Update attachment references: storage URL → local path
7. If file migration fails: Rollback (do not create thread), show error
8. Original project thread remains unchanged
9. Navigate to new personal thread

**Option B: Copy to Project**
1. User right-clicks personal thread → "Copy to Project..."
2. Dialog shows list of user's projects (filter: editor/owner roles only)
3. User selects target project
4. Permission check: Must have edit access to target project
5. API call: POST /api/threads/copy with { sourceThreadId, targetContext: 'project', projectId }
6. **File Migration:**
   - Identify attachments in messages
   - Upload local files to Storage Service: POST /api/storage/upload
   - Update attachment references: local path → storage URL
7. Create new project thread with copied messages (new thread ID, new message IDs)
8. If file migration fails: Rollback (delete partial uploads, do not create thread), show error
9. Original personal thread remains unchanged
10. Invalidate project threads cache: ProjectCache.invalidate(`threads:${projectId}`)
11. Navigate to new project thread

### API Endpoint (Tech Spec §4.3)

```
POST /api/threads/copy

Request Body:
{
  "sourceThreadId": "string (UUID)",
  "targetContext": "personal" | "project",
  "projectId": "string (UUID, required if targetContext=project)"
}

Response:
{
  "newThreadId": "string (UUID)",
  "messageCount": number,
  "fileCount": number,
  "fileMigrationStatus": "success" | "failed"
}
```

### IPC Handler (Tech Spec §4.3)

```typescript
const result = await ipcRenderer.invoke('threads:copy', threadId, {
  targetContext: 'personal' | 'project',
  projectId: projectId  // Optional, required if targetContext=project
});
```

### Transactional File Migration

```typescript
async function copyThreadWithFiles(
  sourceThreadId: string,
  targetContext: 'personal' | 'project',
  projectId?: string
): Promise<ThreadCopyResult> {
  const transaction = new ThreadCopyTransaction();

  try {
    // 1. Fetch source thread and messages
    const sourceThread = await fetchThread(sourceThreadId);

    // 2. Migrate files (upload or download)
    const migratedFiles = await transaction.migrateFiles(
      sourceThread.attachments,
      targetContext,
      projectId
    );

    // 3. Create new thread with updated attachment references
    const newThread = await transaction.createThread(
      targetContext,
      projectId,
      sourceThread,
      migratedFiles
    );

    // 4. Commit transaction
    await transaction.commit();

    return { success: true, newThreadId: newThread.id };
  } catch (error) {
    // 5. Rollback on failure (delete partial uploads, clean up)
    await transaction.rollback();
    throw new Error(`Thread copy failed: ${error.message}`);
  }
}
```

### Performance Targets (Tech Spec §6.1)

- **Copy without files**: <3s
- **Copy with files**: <10s for up to 10MB total attachments
- **File migration**: Streaming for large files (no memory overflow)
- **Rollback**: <1s (clean up partial files)

### Testing Strategy

- **Unit Tests**: Permission checks, file migration logic, rollback on failure
- **E2E Tests**: Full copy flows (personal ↔ project, with/without files), permission errors
- **Integration Tests**: Cache invalidation, file migration (upload/download)
- **Performance Tests**: Copy timing with 1MB/5MB/10MB files
- **Reliability Tests**: File migration failures (simulate network errors, verify rollback)

### Dependencies

- **BLOCKER: E5-S1 (File Service Desktop)** - Required for file migration logic
  - **Mitigation**: Implement thread copy WITHOUT files first, add file migration when E5 complete
  - Thread copy API can be implemented now, file migration added in E5 sprint
- **Requires: E3-S1 (ProjectService)** - Cache invalidation for project threads
- **Requires: E3-S2 (ProjectCache)** - Cache integration

### Edge Cases

1. **Thread with no files**: Copy completes immediately (<3s), no file migration
2. **Large file attachments (>10MB)**: Show progress indicator, warn user if exceeding performance target
3. **Storage quota exceeded**: File upload fails, rollback thread copy, show error: "Storage quota exceeded"
4. **Network failure during migration**: Retry file upload/download (max 3 attempts), rollback on final failure
5. **Permission changes mid-operation**: Re-check permissions before committing thread creation
6. **Duplicate copy**: Allow users to copy same thread multiple times (each gets new thread ID)

### References

- [Tech Spec: Epic 3 Project Collaboration](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md)
- [Tech Spec §4.1: Services (ThreadCopyService)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#services-and-modules)
- [Tech Spec §4.3: APIs (Thread copy endpoint)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#apis-and-interfaces)
- [Tech Spec §4.4: Thread Copy Flow](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#workflows-and-sequencing)
- [Tech Spec §6.1: Performance (Copy timing)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#performance)
- [Tech Spec §7: Dependencies (E5 File Service blocker)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#dependencies-and-integrations)
- [Tech Spec §9: Open Question #4 (Bidirectional copy decision)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-3.md#open-questions)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e3-s8-thread-move-functionality.context.xml

### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
