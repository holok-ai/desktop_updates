# Story 5.4: Storage Service Integration

Status: ready-for-dev

## Story

As a desktop application developer,
I want a StorageServiceClient that handles presigned URL workflows with the Storage Service API,
so that project files can be uploaded and downloaded directly to/from S3/Azure Blob storage with proper authorization and expiration handling.

## Acceptance Criteria

1. StorageServiceClient.getUploadUrl() returns presigned upload URL (expires in 15 min for files <5MB, 1 hour for files >5MB)
2. StorageServiceClient.getDownloadUrl() returns presigned download URL (expires in 1 hour)
3. File uploaded directly to S3/Blob via presigned URL (no proxy through desktop)
4. Presigned URL expiration handled: request new URL if expired
5. Storage Service API calls include JWT token for authorization
6. Presigned URL generation completes in <500ms (P95)
7. File deletion calls Storage Service DELETE endpoint when last reference removed

## Tasks / Subtasks

- [ ] **Task 1: Implement StorageServiceClient Core (AC: 1-2)**
  - [ ] Create StorageServiceClient class with dependency injection (AuthService for JWT)
  - [ ] Implement getUploadUrl() method: POST /api/storage/upload-url
  - [ ] Request body: { fileName, fileSize, mimeType, projectId }
  - [ ] Response: { uploadUrl, fileKey, expiresAt }
  - [ ] Determine expiration: 15 min for files <5MB, 1 hour for files ≥5MB
  - [ ] Implement getDownloadUrl() method: POST /api/storage/download-url
  - [ ] Request body: { fileKey }
  - [ ] Response: { downloadUrl, expiresAt }
  - [ ] Expiration: 1 hour for all download URLs

- [ ] **Task 2: Implement Direct S3/Blob Upload (AC: 3)**
  - [ ] Use presigned upload URL for direct HTTP PUT to S3/Blob
  - [ ] Set Content-Type header to file's MIME type
  - [ ] Upload file blob directly (no multipart in MVP)
  - [ ] Handle CORS: Storage Service must configure S3/Blob bucket for CORS
  - [ ] Track upload progress using XMLHttpRequest or fetch with ReadableStream
  - [ ] On success (HTTP 200): return fileKey to FileService

- [ ] **Task 3: Implement Presigned URL Expiration Handling (AC: 4)**
  - [ ] Check presigned URL expiresAt before use
  - [ ] If expired: request new presigned URL
  - [ ] Retry upload/download with new URL
  - [ ] Cache presigned URLs with expiration metadata (avoid unnecessary requests)
  - [ ] Log expiration events (WARN level)

- [ ] **Task 4: Implement JWT Authorization (AC: 5)**
  - [ ] Integrate with AuthService to get current user's JWT token
  - [ ] Include JWT in Authorization header: `Bearer {token}`
  - [ ] Storage Service validates token and checks user's project access
  - [ ] Handle 401 Unauthorized: refresh token and retry
  - [ ] Handle 403 Forbidden: user lacks access to project

- [ ] **Task 5: Implement File Deletion (AC: 7)**
  - [ ] Implement deleteFile(fileKey) method: DELETE /api/storage/files/{fileKey}
  - [ ] Include JWT token for authorization
  - [ ] Storage Service deletes file from S3/Blob
  - [ ] Handle errors: file not found (404), unauthorized (403)
  - [ ] Log deletion (INFO level)

- [ ] **Task 6: Error Handling and Retry Logic**
  - [ ] Implement retry wrapper for API calls (max 3 attempts, exponential backoff)
  - [ ] Handle transient errors: network failures, 5xx responses
  - [ ] Handle client errors: 4xx responses (don't retry)
  - [ ] Log all API errors with details
  - [ ] User-friendly error messages for UI

- [ ] **Task 7: Performance Optimization (AC: 6)**
  - [ ] Benchmark API call latency to Storage Service
  - [ ] Target: Presigned URL generation <500ms (P95)
  - [ ] Implement connection pooling for HTTP client
  - [ ] Cache presigned URLs when safe (not expired)
  - [ ] Monitor latency metrics

- [ ] **Task 8: Testing**
  - [ ] Unit test: Presigned URL workflow (mock Storage Service)
  - [ ] Unit test: Expiration handling (expired URL, new URL requested)
  - [ ] Unit test: JWT authorization (token included in headers)
  - [ ] Integration test: Actual S3/Blob upload via presigned URL
  - [ ] Integration test: File deletion from Storage Service
  - [ ] E2E test: Upload file to project thread, download file, delete file
  - [ ] Performance test: Presigned URL latency <500ms

## Dev Notes

### Storage Service API Contracts (Tech Spec §4.2)

**Presigned Upload URL Request:**
```typescript
interface PresignedUploadRequest {
  fileName: string;
  fileSize: number;
  mimeType: string;
  projectId: string;
}

interface PresignedUploadResponse {
  uploadUrl: string;        // Presigned S3/Blob URL (expires in 15 min or 1 hour)
  fileKey: string;          // Storage key for future downloads
  expiresAt: Date;          // ISO 8601 timestamp
}
```

**Presigned Download URL Request:**
```typescript
interface PresignedDownloadRequest {
  fileKey: string;
}

interface PresignedDownloadResponse {
  downloadUrl: string;      // Presigned download URL (expires in 1 hour)
  expiresAt: Date;
}
```

### Storage Service Endpoints (Tech Spec §4.3)

```
POST   /api/storage/upload-url      - Get presigned upload URL
POST   /api/storage/download-url    - Get presigned download URL
DELETE /api/storage/files/{key}     - Delete file (when no references)
```

### StorageServiceClient Implementation

```typescript
class StorageServiceClient {
  constructor(
    private authService: AuthService,
    private baseUrl: string = 'https://api.moku.ai'
  ) {}

  async getUploadUrl(request: PresignedUploadRequest): Promise<PresignedUploadResponse> {
    const token = await this.authService.getToken();

    // Determine expiration based on file size
    const expirationMinutes = request.fileSize >= 5 * 1024 * 1024 ? 60 : 15;

    const response = await fetch(`${this.baseUrl}/api/storage/upload-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({
        ...request,
        expirationMinutes
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to get upload URL: ${response.statusText}`);
    }

    return await response.json();
  }

  async getDownloadUrl(fileKey: string): Promise<PresignedDownloadResponse> {
    const token = await this.authService.getToken();

    const response = await fetch(`${this.baseUrl}/api/storage/download-url`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ fileKey })
    });

    if (!response.ok) {
      throw new Error(`Failed to get download URL: ${response.statusText}`);
    }

    return await response.json();
  }

  async uploadToPresignedUrl(presignedUrl: string, file: Blob, mimeType: string): Promise<void> {
    const response = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': mimeType
      },
      body: file
    });

    if (!response.ok) {
      throw new Error(`Failed to upload file: ${response.statusText}`);
    }
  }

  async deleteFile(fileKey: string): Promise<void> {
    const token = await this.authService.getToken();

    const response = await fetch(`${this.baseUrl}/api/storage/files/${fileKey}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });

    if (!response.ok && response.status !== 404) {
      throw new Error(`Failed to delete file: ${response.statusText}`);
    }
  }
}
```

### Direct S3/Blob Upload Flow (Tech Spec §4.4)

1. User uploads file to project thread
2. FileService detects project context
3. FileService calls StorageServiceClient.getUploadUrl()
4. Storage Service generates presigned S3/Blob URL (expires in 15 min or 1 hour)
5. Desktop receives presigned URL + fileKey
6. Desktop uploads file directly to S3/Blob via HTTP PUT
7. **No proxy through backend** - file goes straight to cloud storage
8. On success: Desktop saves attachment record with fileKey
9. FileKey used for future downloads

### Presigned URL Expiration Handling

```typescript
interface PresignedUrlCache {
  url: string;
  expiresAt: Date;
  fileKey: string;
}

class PresignedUrlManager {
  private cache = new Map<string, PresignedUrlCache>();

  async getUploadUrl(request: PresignedUploadRequest): Promise<string> {
    const cacheKey = `upload:${request.projectId}:${request.fileName}`;
    const cached = this.cache.get(cacheKey);

    // Check if cached URL is still valid
    if (cached && new Date() < new Date(cached.expiresAt)) {
      return cached.url;
    }

    // Request new presigned URL
    const response = await this.storageService.getUploadUrl(request);

    // Cache with expiration
    this.cache.set(cacheKey, {
      url: response.uploadUrl,
      expiresAt: response.expiresAt,
      fileKey: response.fileKey
    });

    return response.uploadUrl;
  }

  async getDownloadUrl(fileKey: string): Promise<string> {
    const cacheKey = `download:${fileKey}`;
    const cached = this.cache.get(cacheKey);

    if (cached && new Date() < new Date(cached.expiresAt)) {
      return cached.url;
    }

    const response = await this.storageService.getDownloadUrl(fileKey);

    this.cache.set(cacheKey, {
      url: response.downloadUrl,
      expiresAt: response.expiresAt,
      fileKey
    });

    return response.downloadUrl;
  }
}
```

### CORS Configuration (Tech Spec §7)

**S3 Bucket CORS Policy:**
```json
{
  "CORSRules": [
    {
      "AllowedOrigins": ["https://desktop.holokai.app", "https://app.moku.ai"],
      "AllowedMethods": ["PUT", "GET"],
      "AllowedHeaders": ["Content-Type"],
      "MaxAgeSeconds": 3000
    }
  ]
}
```

**Azure Blob CORS Policy:**
```xml
<CorsRule>
  <AllowedOrigins>https://desktop.holokai.app,https://app.moku.ai</AllowedOrigins>
  <AllowedMethods>PUT,GET</AllowedMethods>
  <AllowedHeaders>Content-Type</AllowedHeaders>
  <MaxAgeInSeconds>3000</MaxAgeInSeconds>
</CorsRule>
```

### JWT Authorization

```typescript
async makeAuthorizedRequest(url: string, options: RequestInit): Promise<Response> {
  const token = await this.authService.getToken();

  const response = await fetch(url, {
    ...options,
    headers: {
      ...options.headers,
      'Authorization': `Bearer ${token}`
    }
  });

  // Handle 401 Unauthorized - refresh token and retry
  if (response.status === 401) {
    await this.authService.refreshToken();
    const newToken = await this.authService.getToken();

    return await fetch(url, {
      ...options,
      headers: {
        ...options.headers,
        'Authorization': `Bearer ${newToken}`
      }
    });
  }

  return response;
}
```

### Performance Targets (Tech Spec §6.1)

- **Presigned URL Generation**: <500ms (P95)
- **Direct S3/Blob Upload**: <5s for 10MB file (network dependent)
- **Download URL Generation**: <500ms (P95)
- **File Deletion**: <1s

### Error Handling

**Common Errors:**
- **401 Unauthorized**: JWT expired → Refresh token, retry
- **403 Forbidden**: User lacks project access → Show error, don't retry
- **404 Not Found**: File doesn't exist → Log, return null
- **500 Server Error**: Transient → Retry with exponential backoff
- **Network Timeout**: Transient → Retry

### Testing Strategy

- **Unit Tests**: Presigned URL workflow, expiration handling, JWT auth
- **Integration Tests**: Actual S3/Blob upload/download, file deletion
- **E2E Tests**: Full file upload flow (project thread → presigned URL → S3 → metadata save)
- **Performance Tests**: Presigned URL latency, upload speed
- **Security Tests**: JWT validation, expired URL rejection, unauthorized access

### Dependencies

- **External: Storage Service API** - Presigned URL endpoints must be deployed
- **External: S3/Azure Blob Storage** - CORS must be configured for browser uploads
- **Requires: E1 (AuthService)** - JWT token management
- **Used by: E5-S1 (FileService)** - Storage Service integration for project files

### References

- [Tech Spec: Epic 5 File Attachments](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md)
- [Tech Spec §4.1: Services (StorageServiceClient)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#services-and-modules)
- [Tech Spec §4.2: Data Models (Presigned URL contracts)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#data-models-and-contracts)
- [Tech Spec §4.3: APIs (Storage Service endpoints)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#apis-and-interfaces)
- [Tech Spec §4.4: Workflows (Upload/download flows)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#workflows-and-sequencing)
- [Tech Spec §6: Non-Functional Requirements](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#non-functional-requirements)
- [Tech Spec §7: Dependencies (Storage Service, S3/Blob)](C:\Projects\repos\holokai\bmad\desktop-project\docs\sprint-artifacts\tech-spec-epic-5.md#dependencies-and-integrations)

## Dev Agent Record

### Context Reference

- docs/sprint-artifacts/e5-s4-storage-service-integration.context.xml

- docs/sprint-artifacts/e5-s4-storage-service-integration.context.xml



### Agent Model Used

### Debug Log References

### Completion Notes List

### File List
