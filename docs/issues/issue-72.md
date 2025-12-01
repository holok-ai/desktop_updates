### Upload File or Image in Chat

**Story:**  
As a user, I want to upload a file or image directly into a chat thread, so that I can share documents, screenshots, or datasets with the AI and other participants for better collaboration and richer context.

**Acceptance Criteria (Gherkin):**

- **Given** I am composing a message in the chat  
  **When** I click the attach/drag-and-drop file option and select a supported file or image  
  **Then** the file starts uploading, shows progress, and on completion appears as a thumbnail, preview, or download link inline within the chat  
  **And** the AI and chat participants can open, preview, or download the uploaded file/image  
  **And** the file persists as part of the thread history and is accessible on other devices when the thread is resumed

- **Given** I attempt to upload a file type or size outside of allowed parameters  
  **When** the upload triggers validation  
  **Then** an error message displays and the file is not processed or stored

**NFRs (if applicable):**

- All uploads complete within 2 seconds for files under 5MB on typical connections
- UI provides progress, success, or error states on upload
- Security: only allowed types/extensions; virus scan and audit log where supported
- Accessibility: action and status readable via screenreader

**Technical Implementation Notes:**

- Integrate frontend file picker and drag-drop events
- Backend endpoint receives and streams file to storage with metadata link to message/thread
- Thumbnails/previews for common images (JPG, PNG, PDF); download link for docs/datasets
- Store upload metadata in message history and enable access on thread resume

**Data/Business Rules:**

- Support most common document/image types in initial release (can expand via config)
- File size/extension whitelist enforced server-side plus UI validation
- All uploads tied to authenticated user and thread, retained for audit

**Dependencies/Assumptions:**

- File storage provider/API integrated with backend
- Message model extended to support attachments and file metadata
- Virus scan/type validation in place or explicitly deferred

**Definition of Ready:**

- UI and design specs for attach/upload complete
- File storage/endpoint available in dev or staging

**Definition of Done:**

- Files/images can be reliably uploaded, attached, and retrieved in chat threads, meeting all criteria
- Feature covered by automated and regression tests for upload, preview, and download flows
- Audited and tested for security, UX, and error handling

**Estimate:** 5 points  
**Labels:** `type:story` `priority:P1` `area:conversation-frontend` `status:ready`
