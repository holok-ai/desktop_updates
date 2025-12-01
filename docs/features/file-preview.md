# File Preview and Download Architecture

## Overview

The file preview and download system provides secure, token-based access to uploaded files with inline preview support for images and PDFs, comprehensive audit logging, and full accessibility support.

## Story Reference

Implements **[STORY] Preview and Download Uploaded Files in Chat** (issue-73.md)

## Architecture Components

### Backend Services

#### 1. FileTypeDetectorService

**Location:** `src-electron/services/file-type-detector.service.ts`

Detects and categorizes file types to determine preview/download behavior.

**Key Methods:**

- `detectFileType(filename, mimeType?)` - Returns file category, MIME type, and preview capability
- `isPreviewable(filename, mimeType?)` - Returns true for images and PDFs
- `isDownloadOnly(filename, mimeType?)` - Returns true for non-previewable files
- `canInlinePreview(filename, fileSize, mimeType?)` - Returns true for small images (<500KB)

**Supported Categories:**

- **Image** (previewable, inline if <500KB): JPG, PNG, GIF, WebP, SVG, BMP
- **PDF** (previewable, modal only): PDF files
- **Document** (download only): DOC, DOCX, XLS, XLSX, PPT, PPTX, ODF
- **Text** (download only): TXT, MD, JSON, CSV, XML, YAML
- **Archive** (download only): ZIP, TAR, GZ, RAR, 7Z
- **Other** (download only): Unknown types

#### 2. FileAccessTokenService

**Location:** `src-electron/services/file-access-token.service.ts`

Generates and validates time-limited, cryptographically signed tokens for secure file access.

**Security Features:**

- Random 64-character hex tokens (32 bytes)
- HMAC-SHA256 signatures for token integrity
- 15-minute token expiration
- Automatic cleanup of expired tokens
- Action-specific tokens (preview vs download)
- Per-user token validation

**Key Methods:**

- `generateToken(fileId, userId, action)` - Creates a secure access token
- `validateToken(token)` - Validates and returns token payload
- `revokeToken(token)` - Immediately invalidates a token
- `cleanupExpired()` - Removes expired tokens from memory

**Token Payload:**

```typescript
{
  token: string; // Random hex string
  fileId: string; // File identifier
  userId: string; // User who requested access
  action: 'preview' | 'download';
  expiresAt: number; // Unix timestamp
  signature: string; // HMAC signature
}
```

#### 3. FileAuditService

**Location:** `src-electron/services/file-audit.service.ts`

Logs all file access events for audit trail and compliance.

**Logged Events:**

- File preview (successful and failed)
- File download (successful and failed)
- File upload
- File deletion

**Audit Event Structure:**

```typescript
{
  id: string;           // Unique event ID
  userId: string;       // User who performed action
  fileId: string;       // File identifier
  filename: string;     // Original filename
  action: 'preview' | 'download' | 'upload' | 'delete';
  timestamp: number;    // Unix timestamp
  threadId?: string;    // Associated thread
  fileSize?: number;    // File size in bytes
  mimeType?: string;    // MIME type
  success: boolean;     // Action result
  errorMessage?: string; // Error details if failed
  metadata?: Record<string, unknown>;
}
```

**Storage:**

- In-memory log (last 1000 events)
- Persistent file log: `<userData>/holokai/desktop/logs/file-audit.log`

**Query Methods:**

- `queryLog(filters?)` - Query by userId, fileId, action, time range
- `getRecentEvents(limit)` - Get last N events

#### 4. FileStorageService (Enhanced)

**Location:** `src-electron/services/file-storage.service.ts`

Added secure token-based retrieval method.

**New Method:**

- `getFileWithToken(token)` - Retrieves file with token validation
  - Validates token with `FileAccessTokenService`
  - Searches for file across all thread directories
  - Returns file buffer, filename, and MIME type
  - Returns null if token invalid or file not found

### IPC Handlers

**Location:** `src-electron/ipc-handlers/file-handler.ts`

#### New Handlers

1. **`file:preview`**
   - Generates preview token for a file
   - Validates file exists and is previewable
   - Returns token and file info (MIME type, size, preview capability)
   - Logs preview access attempt

2. **`file:download`**
   - Generates download token for a file
   - Validates file exists
   - Returns token and file info
   - Logs download access attempt

3. **`file:getWithToken`**
   - Retrieves file with a valid token
   - Returns file buffer, filename, MIME type
   - Token is validated and optionally revoked after use

### Frontend Components

#### 1. FilePreviewModal

**Location:** `src/lib/components/FilePreviewModal.svelte`

Modal component for previewing images and PDFs.

**Features:**

- Full-screen modal with backdrop
- Image preview with object-contain sizing
- PDF preview with iframe
- Download button
- Keyboard navigation (Escape to close)
- Focus trap management
- Accessibility labels and ARIA attributes

**Props:**

- `fileUrl` - Object URL for preview
- `filename` - Display name
- `mimeType` - File MIME type
- `fileSize` - File size for display
- `isOpen` - Modal visibility state
- `onClose` - Close callback
- `onDownload` - Download callback

#### 2. AttachmentPreview (Enhanced)

**Location:** `src/lib/components/AttachmentPreview.svelte`

Preview component for attachments with inline image support.

**Features:**

- **Inline Preview**: Small images (<500KB) display directly in message
- **Thumbnail**: Icon or small image for compact view
- **Action Buttons**: Preview (eye icon) and Download (download icon)
- **Status Indicators**: Upload progress, success, failure
- **Error Messages**: Validation errors, unavailable files
- **Accessibility**: Full keyboard navigation, ARIA labels

**Modes:**

- `preview` - Upload preview with remove button
- `history` - Message history with preview/download buttons

#### 3. FileErrorBanner

**Location:** `src/lib/components/FileErrorBanner.svelte`

Banner for displaying file-related errors.

**Types:**

- `error` - Critical errors (file not found, expired token)
- `warning` - Non-critical warnings (file may be unavailable)
- `info` - Informational messages

**Features:**

- Dismissible banner
- Icon and color coding by type
- Slide-in animation
- ARIA live region for screen readers

#### 4. ChatPane (Enhanced)

**Location:** `src/lib/components/ChatPane.svelte`

Added preview and secure download functionality.

**New Features:**

- **Inline Preview URLs**: Caches object URLs for small images
- **Preview Handler**: `previewAttachment()` - Gets token and displays modal
- **Secure Download**: `downloadAttachment()` - Token-based download flow
- **Error Handling**: Displays `FileErrorBanner` for file access errors

### Data Flow

#### Preview Flow

```
1. User clicks preview button on attachment
   ↓
2. ChatPane.previewAttachment(threadId, fileId, filename)
   ↓
3. IPC: file:preview → Main Process
   ↓
4. FileHandler validates file exists and is previewable
   ↓
5. FileAccessTokenService.generateToken()
   ↓
6. FileAuditService.logPreview()
   ↓
7. Return { success, token, fileInfo }
   ↓
8. IPC: file:getWithToken → Main Process
   ↓
9. FileStorageService.getFileWithToken(token)
   ↓
10. Return file buffer
   ↓
11. Create Blob and Object URL
   ↓
12. Open FilePreviewModal with URL
```

#### Download Flow

```
1. User clicks download button
   ↓
2. ChatPane.downloadAttachment(threadId, fileId, filename)
   ↓
3. IPC: file:download → Main Process
   ↓
4. FileHandler validates file exists
   ↓
5. FileAccessTokenService.generateToken()
   ↓
6. FileAuditService.logDownload()
   ↓
7. Return { success, token, fileInfo }
   ↓
8. IPC: file:getWithToken → Main Process
   ↓
9. FileStorageService.getFileWithToken(token)
   ↓
10. Return file buffer
   ↓
11. Create Blob and trigger browser download
   ↓
12. Show success toast
```

#### Inline Preview Flow

```
1. Message loads with attachments
   ↓
2. For each attachment, ChatPane.getInlinePreviewUrl()
   ↓
3. Check if file is small image (<500KB)
   ↓
4. If yes, generate preview token and fetch file
   ↓
5. Create Object URL and cache it
   ↓
6. AttachmentPreview renders inline image
   ↓
7. Clicking inline image opens full preview modal
```

## Security

### Token-Based Access

- No direct file paths exposed to renderer
- Time-limited tokens (15 minutes)
- Cryptographic signatures prevent tampering
- Action-specific tokens (preview vs download)
- Per-user token validation

### Audit Trail

- All file access logged with user, timestamp, action
- Persistent file log for compliance
- Failed access attempts logged
- Query capability for security analysis

### File Validation

- Size limits enforced
- MIME type validation
- Filename sanitization (prevents path traversal)
- Secure file storage in userData directory

## Performance

### Inline Preview Optimization

- Only small images (<500KB) render inline
- Object URLs cached to avoid redundant fetches
- Lazy loading with `loading="lazy"` attribute

### Token Management

- In-memory token store for fast validation
- Automatic cleanup prevents memory leaks
- 1000-event limit for audit log in memory

### File Retrieval

- Direct file system access (no network overhead)
- Efficient buffer-to-blob conversion
- Object URL management (revoke after use)

## Accessibility

### Keyboard Navigation

- Tab navigation through all interactive elements
- Enter/Space to activate buttons
- Escape to close modals and dismiss errors
- Context menu key support

### Screen Reader Support

- ARIA labels for all buttons and regions
- ARIA live regions for dynamic content (errors, status)
- Role attributes (dialog, alert, button, etc.)
- Descriptive alt text for images

### Focus Management

- Modal focus trap
- Focus restoration on close
- Visible focus indicators
- Logical tab order

## Error Handling

### File Unavailable

- Token validation failure → "File unavailable or expired"
- File not found → "File has been deleted"
- Display `FileErrorBanner` with clear message
- Offer download as fallback for preview failures

### Network/System Errors

- IPC call failures caught and logged
- User-friendly error messages
- Toast notifications for quick feedback
- Persistent error banners for critical issues

### Token Expiration

- Expired tokens automatically cleaned up
- New token generated on retry
- User notified if action fails due to expiration

## Testing

### Unit Tests (83 tests)

- **FileAccessTokenService** (22 tests): Token generation, validation, expiration, security
- **FileTypeDetectorService** (39 tests): File type detection, preview capability
- **FileAuditService** (22 tests): Event logging, querying, persistence

**Location:** `tests/unit/services/`

**Run:** `npm test tests/unit/services/`

### Integration Tests

TODO: IPC handler tests for token flow

### E2E Tests

TODO: Preview modal, download flow, error handling, accessibility

## Configuration

### Token Expiry

Default: 15 minutes
Location: `FileAccessTokenService.TOKEN_EXPIRY_MS`

### Inline Preview Size Limit

Default: 500KB
Location: `FileTypeDetectorService.canInlinePreview()` and `AttachmentPreview.svelte`

### Audit Log Size

Default: 1000 events in-memory
Location: `FileAuditService.MAX_IN_MEMORY_EVENTS`

### File Storage Location

Path: `<userData>/holokai/desktop/attachments/<threadId>/<fileId>.<ext>`

### Audit Log Location

Path: `<userData>/holokai/desktop/logs/file-audit.log`

## Future Enhancements

1. **PDF Viewer**: Replace iframe with custom PDF renderer (e.g., PDF.js)
2. **Image Zoom**: Add pinch-to-zoom for images in preview modal
3. **Thumbnails**: Generate and cache thumbnails for faster loading
4. **File Expiry**: Implement automatic file deletion after retention period
5. **Download Progress**: Show progress bar for large file downloads
6. **Batch Operations**: Preview/download multiple files at once
7. **File Search**: Search files by name, type, or date across threads
8. **External Sharing**: Generate secure public links for file sharing

## Dependencies

- **Electron**: File system access, IPC, secure storage
- **Crypto (Node.js)**: Token generation, HMAC signatures
- **Svelte 5**: Reactive UI components
- **Tailwind CSS**: Component styling

## Maintenance

### Monitoring

- Check audit log for unusual access patterns
- Monitor token generation rate
- Track file storage usage

### Cleanup

- Implement file retention policy
- Archive old audit logs
- Clean up orphaned files (deleted threads)

### Updates

- Review token expiry time based on usage
- Adjust inline preview size limit based on performance
- Update supported file types as needed

## Related Documentation

- **Story Definition**: `docs/issues/issue-73.md`
- **File Upload**: `docs/features/file-upload.md` (if exists)
- **Security**: `docs/security/` (if exists)
- **Testing**: `tests/` directory

---

**Last Updated:** 2025-11-10
**Status:** ✅ Implemented and Tested
**Coverage:** 83/83 unit tests passing
