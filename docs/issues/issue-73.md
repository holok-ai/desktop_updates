### Preview and Download Uploaded Files in Chat

**Story:**  
As a user, I want to preview and download files or images that have been uploaded in chat, so that I can quickly access, review, or reuse shared materials in the context of my conversation.

**Acceptance Criteria (Gherkin):**

- **Given** I see an uploaded file or image in a chat thread  
  **When** I click on a supported image or document  
  **Then** a preview (inline or modal) displays for images (JPG, PNG) and PDFs  
  **And** for other file types, a download link initiates secure file retrieval  
  **And** previews download securely with audit/log where supported

- **Given** an uploaded file/image is no longer available (deleted or expired)  
  **When** I attempt to preview or download  
  **Then** a clear error banner or message displays, explaining the file is unavailable

**NFRs (if applicable):**

- Previews must load within 1.5s for files under 2MB
- Full accessibility for preview and download icons/actions via keyboard and screenreader
- Secure tokenized access for all downloads; no direct links

**Technical Implementation Notes:**

- Generate link or preview embed for supported types
- Render inline images or launch modal for large/complex files
- Trigger browser download with auth/token for docs, datasets
- File not found/unavailable returns formatted error to UI

**Data/Business Rules:**

- Only files stored via chat upload may be previewed or downloaded
- Download and preview logs include user, time, and file info for audit trail
- Expiry or retention policies clearly displayed on file message if applicable

**Dependencies/Assumptions:**

- File storage backend supports secure temporary URLs or streaming
- Frontend can distinguish file type and trigger appropriate action

**Definition of Ready:**

- Storage and backend handshake for authenticated preview/download URLs complete
- UI pattern for previews and unavailable error state designed

**Definition of Done:**

- Supported files preview inline or in modal, non-preview types download securely
- Robust handling of deleted/expired files with clear user messaging
- UX/accessibility/safety requirements and test automation met

**Estimate:** 3 points  
**Labels:** `type:story` `priority:P1` `area:conversation-frontend` `status:ready`
