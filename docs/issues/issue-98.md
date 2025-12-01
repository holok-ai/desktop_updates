### User Rename Thread Title

**Story:**  
As a user, I want to rename any chat thread to a custom title, so that I can better organize, recognize, and search my conversations in history and project views.

**Acceptance Criteria (Gherkin):**

- **Given** a thread with an auto-generated or existing title  
  **When** I select the “Rename Thread” option or edit the title inline  
  **Then** I can provide a new title, save it, and the update appears instantly everywhere in the UI

- **Given** I rename a thread  
  **When** I view it in the thread list, conversation header, project view, or exports  
  **Then** the new title appears consistently across all views

- **Given** I change my mind about a recent rename  
  **When** I use the undo or history option (if available)  
  **Then** the previous title is restored

**NFRs (if applicable):**

- Rename actions complete and display updates in <1s
- Title field supports accessibility, duplicate checking, and length/content limits

**Technical Implementation Notes:**

- Thread data model stores current and previous titles for audit/history
- UI supports inline title edit, save, and undo actions
- Backend syncs title updates across devices and export logic

**Data/Business Rules:**

- Only authorized users (owner, collaborators) can rename threads
- Renames are tracked for audit, with option to revert recent changes

**Dependencies/Assumptions:**

- UI/UX for inline edit and rename dialogs defined
- Data model supports title update and history

**Definition of Ready:**

- Rename flow and backend endpoints tested for thread title update
- Accessibility and error-handling spec finalized

**Definition of Done:**

- Users can reliably rename threads and see new titles everywhere
- Undo and audit trail available for recent renames
- Automated tests cover rename, display, sync, and export

**Estimate:** 3 points  
**Labels:** `type:story` `priority:P1` `area:conversation-frontend,backend` `status:ready`
