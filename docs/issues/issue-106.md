### Highlight and Comment on Response Section

**Story:**  
As a user, I want to add a single comment to a response.

**Acceptance Criteria (Gherkin):**

- **Given** I am viewing an AI response  
  **When** I choose “Add Comment”  
  **Then** a comment input box appears linked to the highlighted section  
  **And** I can submit my comment which is saved and visible under the response.

- **Given** a response has been commented on  
  **When** I can view the response  
  **Then** a comment indicator is shown and I can hover over the indicator to see the comment.

- **Given** comments exist on different responses
  **When** I click on a "Show Comments" button
  **Then** the UI shows the comment under the applicable response, for each response that has a comment

**Data/Business Rules:**

- A comment is tied to a specific response
- Backend supports annotation persistence and real-time sync

**Definition of Ready:**

- Highlight/comment UX approved
- Backend annotation data model tested

**Definition of Done:**

- Users can add a comment
- Comments persist and sync across sessions/devices
- Tested for accuracy, performance, and security

**Estimate:** 5 points  
**Labels:** `type:story` `priority:P1` `area:conversation-frontend` `status:ready`
