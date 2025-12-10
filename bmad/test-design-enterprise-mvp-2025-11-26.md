# Test Design: Holokai Desktop Enterprise MVP

**Document Version:** 2.0
**Date:** 2025-11-26
**Status:** Draft
**Test Type:** User Acceptance Testing (UAT)
**Scope:** All Desktop Enterprise MVP features

---

## Executive Summary

This test design document defines user acceptance tests for Holokai Desktop Enterprise MVP, covering all core features:

1. **Thread Management** - Chat interface, thread branching/retry, personal vs project threads
2. **Project Collaboration** - Project creation, member management, shared threads
3. **Workflow Execution** - Workflow creation, execution, forking, scheduling
4. **Chat-to-Workflow Progression** - Progressive automation journey from chat to workflows
5. **MCP Integration Ecosystem** - Organizational MCP server management and tool execution

**Out of Scope:** Backend features (Progressive Governance, Native Integrations, Approval Workflows) are tested separately via Moku API test suites.

---

## 1. Test Strategy

### 1.1 Testing Approach

**Test Levels:**
- **User Acceptance Testing (UAT):** End-to-end user scenarios validating product requirements
- **Integration Testing:** Desktop ↔ Moku API ↔ Holo API interactions
- **UI/UX Testing:** Visual design, interaction patterns, responsiveness

**Test Environment:**
- **Desktop App:** Local Electron build (development mode)
- **Moku API:** Staging environment with test organization data
- **Holo API:** Staging environment with test MCP server registry
- **Test Data:** Synthetic users, chat messages, workflow templates, MCP servers

### 1.2 Success Criteria

**Thread Management:**
- ✅ Threads persist locally without data loss
- ✅ Thread branching supports max 3 branches (original + 2 retries)
- ✅ Auto-generated thread titles accurate 90%+ of the time
- ✅ Thread search returns relevant results in <100ms

**Project Collaboration:**
- ✅ Project members see new threads/messages within 30 seconds (polling)
- ✅ File sharing works for all supported file types (<100MB)
- ✅ Member permissions enforced correctly (admin vs member)

**Workflow Execution:**
- ✅ Workflows execute successfully 99%+ of the time
- ✅ Multi-step workflows complete all steps in sequence
- ✅ Scheduled workflows trigger at correct time (±1 minute)
- ✅ Workflow forking preserves all inputs and steps

**Chat-to-Workflow Progression:**
- ✅ 40%+ of test users create first workflow within 30 days (simulated usage)
- ✅ 80%+ of created workflows executed 20+ times
- ✅ <7 days time-to-value (first workflow creation)
- ✅ 60%+ workflows created from templates
- ✅ 30%+ suggestion acceptance rate

**MCP Integration:**
- ✅ 60%+ test users configure at least 1 MCP integration
- ✅ 5+ average integrations enabled per test organization
- ✅ 30%+ workflows use MCP tools
- ✅ <1 second MCP server initialization per server
- ✅ <500ms tool execution latency (excluding external API calls)

### 1.3 Test Data Requirements

**Threads & Messages:**
- 100+ chat messages covering various topics and patterns
- 20+ test threads (10 personal, 10 project)
- File attachments: PDFs, images, spreadsheets, documents (various sizes: 100KB - 10MB)

**Projects:**
- 5 test projects with varying member counts (2-10 members each)
- Project metadata: names, descriptions, icons, colors
- 10 test users across different roles (admin, member)

**Workflows:**
- 20 pre-built workflows (simple and multi-step)
- 50+ curated workflow templates (10 per category: Marketing, Sales, Operations, Finance, HR)
- Workflow execution history (50+ past executions)

**Chat-to-Workflow:**
- 50+ pre-written chat message sequences (representing repetitive patterns)
- 10 test users with varying usage patterns (light, moderate, heavy)

**MCP Integration:**
- 20 official MCP servers (GitHub, Slack, Jira, Notion, etc.)
- Test credentials for each MCP server (sandbox/test API keys)
- 3 test organizations with different MCP configurations

---

## 2. Thread Management Tests

### 2.1 Basic Chat and Thread Creation

#### Test Case TH-01: Create Personal Thread
**Objective:** Verify user can create a personal thread and send first message

**Preconditions:**
- User logged in to Desktop app
- Dashboard visible

**Test Steps:**
1. Click "New Chat" button
2. Observe empty chat interface opens
3. Type message in prompt input: "Hello, can you help me write an email?"
4. Press Enter or click Send button
5. Observe message sent and assistant response streams

**Expected Results:**
- ✅ Empty chat interface opens with focus on prompt input
- ✅ User message appears immediately after send
- ✅ Assistant response streams in real-time (SSE from Holo API)
- ✅ Thread ID generated (UUID v4) by Desktop
- ✅ Thread saved to ThreadRepository (personal type)
- ✅ Thread appears in sidebar under "Personal" section

**Test Data:**
- User message: "Hello, can you help me write an email?"

---

#### Test Case TH-02: Auto-Generate Thread Title
**Objective:** Verify thread title auto-generated after 2nd exchange

**Preconditions:**
- Test Case TH-01 passed
- Thread has 1 user message and 1 assistant response

**Test Steps:**
1. Send 2nd user message: "I need to write a sales follow-up email to a customer"
2. Wait for assistant response
3. Observe thread title updates in sidebar

**Expected Results:**
- ✅ After assistant's 2nd response, Desktop calls Moku API: `POST /threads/:id/generate-title`
- ✅ Moku API uses LLM to generate title from conversation: "Sales Follow-up Email Assistance"
- ✅ Thread title updates in sidebar (changes from "New Chat" to generated title)
- ✅ Title appears in thread header

**Test Data:**
- 2nd user message: "I need to write a sales follow-up email to a customer"
- Generated title: "Sales Follow-up Email Assistance" (example)

---

#### Test Case TH-03: Thread Persistence and Retrieval
**Objective:** Verify threads persist locally and can be retrieved

**Preconditions:**
- Test Case TH-02 passed
- Thread created with 2 exchanges

**Test Steps:**
1. Close Desktop app
2. Reopen Desktop app
3. Login (if needed)
4. Observe thread list in sidebar

**Expected Results:**
- ✅ ThreadRepository loads threads from local storage (JSON file)
- ✅ Thread appears in sidebar with correct title
- ✅ Clicking thread loads full conversation history
- ✅ All messages (user + assistant) display correctly
- ✅ No data loss

**Test Data:**
- Thread ID from TH-01

---

### 2.2 Thread Branching and Retry

#### Test Case TH-04: Create Retry Branch
**Objective:** Verify user can retry/regenerate assistant response

**Preconditions:**
- Active thread with at least 1 assistant response

**Test Steps:**
1. Hover over assistant response message
2. Click "Retry" button (regenerate icon)
3. Observe new assistant response streams
4. Observe branch indicator appears

**Expected Results:**
- ✅ "Retry" button appears on hover over assistant messages
- ✅ Clicking retry sends same user prompt to Holo API with `branchIndex: 1`
- ✅ New assistant response streams (different from original due to temperature >0)
- ✅ Branch indicator shows "1 of 2" (2 branches exist)
- ✅ User can toggle between branches using arrow buttons
- ✅ Original response preserved (branchIndex: 0)
- ✅ New response saved (branchIndex: 1)

**Test Data:**
- Original assistant response: "Sure! Here's a draft email..."
- Retry response (branchIndex: 1): "Of course! I can help with that..." (different)

---

#### Test Case TH-05: Navigate Between Branches
**Objective:** Verify user can navigate between retry branches

**Preconditions:**
- Test Case TH-04 passed
- Message has 2 branches (original + 1 retry)

**Test Steps:**
1. Observe branch indicator shows "1 of 2" (currently viewing branch 1)
2. Click left arrow to view original branch
3. Observe branch indicator changes to "1 of 2"
4. Click right arrow to view retry branch
5. Observe branch indicator changes to "2 of 2"

**Expected Results:**
- ✅ Branch indicator shows current branch: "X of Y"
- ✅ Left arrow loads previous branch (branchIndex decreases)
- ✅ Right arrow loads next branch (branchIndex increases)
- ✅ Message content updates when switching branches
- ✅ Conversation continues from selected branch (future messages use correct parentMessageId)

**Test Data:**
- Original branch (branchIndex: 0)
- Retry branch (branchIndex: 1)

---

#### Test Case TH-06: Max 2 Retries Limit
**Objective:** Verify Desktop enforces max 2 retries per message

**Preconditions:**
- Test Case TH-04 passed
- Message has 2 branches (original + 1 retry)

**Test Steps:**
1. Click "Retry" button again (attempt 3rd retry)
2. Observe Desktop allows 1 more retry
3. Observe 3 total branches exist (original + 2 retries)
4. Click "Retry" button again (attempt 4th retry)
5. Observe error message or disabled button

**Expected Results:**
- ✅ Desktop allows up to 2 retries (3 total branches: branchIndex 0, 1, 2)
- ✅ After 3 branches exist, "Retry" button becomes disabled
- ✅ Tooltip shows: "Maximum 2 retries reached"
- ✅ User cannot create 4th branch

**Test Data:**
- Branches: 0 (original), 1 (retry 1), 2 (retry 2)

---

#### Test Case TH-07: Branch with Attachments (Shared Reference)
**Objective:** Verify retry branches share file attachments by reference

**Preconditions:**
- Active thread
- User message with 2 file attachments uploaded

**Test Steps:**
1. Send user message with 2 attached files: "report.pdf" (1MB), "data.xlsx" (500KB)
2. Receive assistant response
3. Click "Retry" on assistant response
4. Observe Desktop behavior with attachments

**Expected Results:**
- ✅ Original user message has `attachments: [fileId: "abc-123", fileId: "def-456"]`
- ✅ Retry branch user message references same fileIds (no re-upload)
- ✅ Desktop sends same fileIds to Holo API for retry request
- ✅ Storage quota counts each file once (1.5MB total, not 3MB)
- ✅ Both branches can access same files

**Test Data:**
- File 1: "report.pdf" (fileId: "abc-123", 1MB)
- File 2: "data.xlsx" (fileId: "def-456", 500KB)

---

### 2.3 Thread Organization

#### Test Case TH-08: Archive Thread
**Objective:** Verify user can archive threads to declutter sidebar

**Preconditions:**
- User has 3+ active personal threads

**Test Steps:**
1. Right-click on thread in sidebar
2. Select "Archive" from context menu
3. Observe thread moves to "Archived" section

**Expected Results:**
- ✅ Context menu shows "Archive" option
- ✅ Clicking "Archive" updates thread status: `status: 'archived'`
- ✅ Thread removed from "Personal" section
- ✅ Thread appears in "Archived" section (collapsed by default)
- ✅ Desktop calls Moku API: `PATCH /threads/:id { status: 'archived' }`

**Test Data:**
- Thread ID: "thread-001"

---

#### Test Case TH-09: Delete Thread
**Objective:** Verify user can delete threads permanently

**Preconditions:**
- User has archived thread from TH-08

**Test Steps:**
1. Navigate to "Archived" section in sidebar
2. Right-click on archived thread
3. Select "Delete" from context menu
4. Confirm deletion in modal: "Are you sure? This cannot be undone."
5. Click "Delete Permanently"

**Expected Results:**
- ✅ Confirmation modal appears with warning
- ✅ Clicking "Delete Permanently" updates thread status: `status: 'deleted'`, `deletedAt: timestamp`
- ✅ Thread removed from sidebar
- ✅ Desktop calls Moku API: `DELETE /threads/:id` (soft delete)
- ✅ ThreadRepository evicts thread from cache
- ✅ Thread cannot be accessed again (404 error if user tries to load URL)

**Test Data:**
- Thread ID: "thread-001"

---

#### Test Case TH-10: Move Personal Thread to Project
**Objective:** Verify user can move personal thread to project

**Preconditions:**
- User has personal thread
- User has access to project "Marketing Campaign"

**Test Steps:**
1. Right-click on personal thread in sidebar
2. Select "Move to Project" from context menu
3. Select project "Marketing Campaign" from dropdown
4. Confirm move

**Expected Results:**
- ✅ Modal opens with list of user's projects
- ✅ User selects project and confirms
- ✅ Desktop calls `threads:move` IPC: `move(threadId, { type: 'project', projectId: 'proj-001' })`
- ✅ Thread type changes: `type: 'project'`, `ownerId: 'proj-001'`, `projectId: 'proj-001'`
- ✅ Thread moves from "Personal" to project section in sidebar
- ✅ Local files (if any) migrated to Storage Service
- ✅ Thread visible to all project members

**Test Data:**
- Thread ID: "thread-personal-001"
- Project ID: "proj-001" (Marketing Campaign)

---

### 2.4 Thread Search and Filters

#### Test Case TH-11: Search Threads by Title
**Objective:** Verify user can search threads by title

**Preconditions:**
- User has 20+ threads with various titles

**Test Steps:**
1. Click search bar in sidebar
2. Type search query: "email"
3. Observe filtered thread list

**Expected Results:**
- ✅ Search bar filters threads in real-time (client-side)
- ✅ Only threads with "email" in title shown
- ✅ Search is case-insensitive
- ✅ Clearing search shows all threads again

**Test Data:**
- Search query: "email"
- Expected results: "Sales Follow-up Email Assistance", "Email Marketing Draft", "Email Template Request"

---

#### Test Case TH-12: Filter Threads by Type
**Objective:** Verify user can filter threads by personal vs project

**Preconditions:**
- User has 10 personal threads and 5 project threads

**Test Steps:**
1. Observe sidebar sections: "Personal" (collapsed/expanded) and "Projects" (collapsed/expanded)
2. Collapse "Personal" section
3. Observe only project threads visible
4. Expand "Personal" section again

**Expected Results:**
- ✅ Sidebar groups threads by type: Personal and Projects
- ✅ Each section can be collapsed/expanded independently
- ✅ Collapsed sections hide threads (save vertical space)
- ✅ Section state persists across app restarts

**Test Data:**
- 10 personal threads
- 5 project threads across 2 projects

---

## 3. Project Collaboration Tests

### 3.1 Project Creation and Management

#### Test Case PROJ-01: Create New Project
**Objective:** Verify user can create a new project

**Preconditions:**
- User logged in to Desktop app

**Test Steps:**
1. Click "New Project" button in sidebar
2. Fill in project details:
   - Name: "Q4 Marketing Campaign"
   - Description: "Campaign planning and execution for Q4 2025"
   - Icon: 📢 (emoji picker)
   - Color: Blue
3. Click "Create Project"

**Expected Results:**
- ✅ Project creation modal opens
- ✅ Name field required (validation error if empty)
- ✅ Description optional
- ✅ Icon picker allows emoji selection
- ✅ Color picker shows 10 preset colors
- ✅ Desktop calls Moku API: `POST /projects { name, description, createdBy, organizationId, metadata: { icon, color } }`
- ✅ Project appears in sidebar under "Projects" section
- ✅ Project ID generated by Moku API

**Test Data:**
- Name: "Q4 Marketing Campaign"
- Description: "Campaign planning and execution for Q4 2025"
- Icon: 📢
- Color: #3B82F6 (blue)

---

#### Test Case PROJ-02: View Project Details
**Objective:** Verify user can view project details and settings

**Preconditions:**
- Test Case PROJ-01 passed
- Project "Q4 Marketing Campaign" created

**Test Steps:**
1. Click on project in sidebar
2. Observe project detail page opens
3. Navigate to "Settings" tab

**Expected Results:**
- ✅ Project detail page shows:
   - Project name and description
   - Member list (initially just creator)
   - Thread list (initially empty)
   - File list (initially empty)
   - Activity feed (initially empty)
- ✅ Settings tab shows:
   - Edit name, description, icon, color
   - Default model selection
   - Max storage quota
   - Delete project button

**Test Data:**
- Project: "Q4 Marketing Campaign"

---

#### Test Case PROJ-03: Add Project Member
**Objective:** Verify user can add members to project

**Preconditions:**
- Test Case PROJ-01 passed
- User is project creator (has permission to add members)

**Test Steps:**
1. Navigate to project detail page
2. Click "Add Member" button
3. Search for user: "sarah@company.com"
4. Select user from dropdown
5. Select role: "Member" (not Admin)
6. Click "Add"

**Expected Results:**
- ✅ "Add Member" modal opens with user search
- ✅ Search queries Moku API: `GET /users?organizationId={orgId}&search=sarah`
- ✅ User dropdown shows matching users
- ✅ Role dropdown shows: "Admin", "Member"
- ✅ Desktop calls Moku API: `POST /projects/:id/members { userId: 'user-002', role: 'member' }`
- ✅ New member appears in member list
- ✅ Member receives notification: "You've been added to Q4 Marketing Campaign"

**Test Data:**
- User: sarah@company.com (userId: "user-002")
- Role: "member"

---

#### Test Case PROJ-04: Remove Project Member
**Objective:** Verify project admin can remove members

**Preconditions:**
- Test Case PROJ-03 passed
- Project has 2 members (creator + Sarah)

**Test Steps:**
1. Navigate to project detail page
2. Click "..." menu next to Sarah's name in member list
3. Select "Remove from project"
4. Confirm removal in modal

**Expected Results:**
- ✅ Context menu shows "Remove from project" option
- ✅ Confirmation modal appears: "Are you sure you want to remove Sarah from this project?"
- ✅ Desktop calls Moku API: `DELETE /projects/:id/members/:memberId`
- ✅ Member removed from member list
- ✅ Sarah loses access to project threads and files
- ✅ Sarah receives notification: "You've been removed from Q4 Marketing Campaign"

**Test Data:**
- Member ID: "member-002" (Sarah)

---

### 3.2 Project Threads

#### Test Case PROJ-05: Create Thread in Project
**Objective:** Verify user can create thread within project

**Preconditions:**
- User is member of project "Q4 Marketing Campaign"

**Test Steps:**
1. Click on project "Q4 Marketing Campaign" in sidebar
2. Click "New Thread" button within project view
3. Send first message: "Let's brainstorm campaign slogans for Q4"
4. Receive assistant response

**Expected Results:**
- ✅ New thread created with `type: 'project'`, `ownerId: projectId`, `projectId: projectId`
- ✅ Thread appears in project's thread list
- ✅ Desktop calls Moku API: `POST /threads { type: 'project', projectId: 'proj-001', createdBy: 'user-001' }`
- ✅ Thread visible to all project members
- ✅ Thread saved to ThreadRepository (local cache)

**Test Data:**
- Project ID: "proj-001"
- First message: "Let's brainstorm campaign slogans for Q4"

---

#### Test Case PROJ-06: View Project Thread as Another Member
**Objective:** Verify project threads are shared across members

**Preconditions:**
- Test Case PROJ-05 passed
- Thread created by User A
- User B is member of same project

**Test Steps:**
1. Login as User B
2. Navigate to project "Q4 Marketing Campaign"
3. Observe thread list

**Expected Results:**
- ✅ User B sees thread created by User A
- ✅ User B can click thread and view full conversation
- ✅ User B can send messages in thread (collaborative)
- ✅ Desktop calls Moku API: `GET /threads?projectId=proj-001` (returns all project threads)

**Test Data:**
- User A: "user-001" (creator)
- User B: "user-002" (member)
- Thread: "Q4 Campaign Slogans" (project thread)

---

#### Test Case PROJ-07: File Sharing in Project Thread
**Objective:** Verify files in project threads are stored in Storage Service

**Preconditions:**
- User in project thread

**Test Steps:**
1. Attach file to message in project thread: "campaign-brief.pdf" (2MB)
2. Send message
3. Observe file upload process

**Expected Results:**
- ✅ Desktop calls StorageAPI: `POST /files/upload { projectId: 'proj-001', threadId: 'thread-001', file: Blob }`
- ✅ Storage Service returns presigned URL
- ✅ Desktop uploads file to presigned URL (S3/Azure/MinIO)
- ✅ Storage Service returns fileId: "file-abc-123"
- ✅ Message sent with attachment: `attachments: [{ fileId: 'file-abc-123', name: 'campaign-brief.pdf', size: 2097152, mimeType: 'application/pdf' }]`
- ✅ File accessible to all project members
- ✅ File not stored locally (project files are cloud-only)

**Test Data:**
- File: "campaign-brief.pdf" (2MB)
- Project ID: "proj-001"
- Thread ID: "thread-001"

---

### 3.3 Project Activity and Updates

#### Test Case PROJ-08: Poll for Project Updates
**Objective:** Verify Desktop polls for new threads/messages in project

**Preconditions:**
- User A and User B both members of project
- User B viewing project in Desktop

**Test Steps:**
1. User A creates new thread in project (via their Desktop app)
2. Wait for User B's Desktop to poll for updates (30 seconds)
3. Observe User B's UI updates

**Expected Results:**
- ✅ Desktop polls Moku API every 30 seconds: `GET /projects/:id/updates?since={lastPollTimestamp}`
- ✅ Moku API returns new threads/messages since last poll
- ✅ User B's thread list updates to show new thread
- ✅ User B receives notification: "New thread in Q4 Marketing Campaign"

**Test Data:**
- Polling interval: 30 seconds
- Project ID: "proj-001"

---

## 4. Workflow Execution Tests

### 4.1 Basic Workflow Creation and Execution

#### Test Case WF-01: Create Simple Workflow
**Objective:** Verify user can create a basic workflow

**Preconditions:**
- User logged in to Desktop app

**Test Steps:**
1. Navigate to Workflows page
2. Click "Create Workflow" button
3. Fill in workflow details:
   - Name: "Daily Standup Report"
   - Description: "Generate standup report from yesterday's activity"
   - Model: "Claude 3.5 Sonnet"
4. Add input variable: `date` (type: string, default: "yesterday")
5. Add workflow step:
   - Type: "prompt"
   - Prompt: "Generate a standup report for {{date}}. Include: tasks completed, challenges faced, and today's goals."
6. Click "Create Workflow"

**Expected Results:**
- ✅ Workflow creation modal opens
- ✅ User fills all required fields
- ✅ Input variables can be added with name, type, default value
- ✅ Workflow steps can be added (prompt, MCP action, conditional, loop)
- ✅ Desktop calls Moku API: `POST /workflows { name, description, inputs, steps, createdBy }`
- ✅ Workflow appears in workflow list

**Test Data:**
- Workflow name: "Daily Standup Report"
- Input: `date` (string, default: "yesterday")

---

#### Test Case WF-02: Execute Workflow Manually
**Objective:** Verify user can execute workflow with custom inputs

**Preconditions:**
- Test Case WF-01 passed
- Workflow "Daily Standup Report" created

**Test Steps:**
1. Navigate to Workflows page
2. Click "Run" button on "Daily Standup Report" workflow
3. Observe execution modal opens
4. Edit input: `date` = "2025-11-25"
5. Click "Run Workflow"
6. Observe execution progress

**Expected Results:**
- ✅ Execution modal shows input fields with default values
- ✅ User can edit inputs before execution
- ✅ Clicking "Run Workflow" calls Desktop IPC: `workflows.execute(workflowId, { date: "2025-11-25" })`
- ✅ Desktop calls Moku API: `POST /workflows/:id/execute { inputs: { date: "2025-11-25" } }`
- ✅ Execution progress shown: "Step 1 of 1 - Running..."
- ✅ Execution completes successfully
- ✅ Result displayed: standup report text
- ✅ Execution saved to history

**Test Data:**
- Workflow ID: "workflow-001"
- Input: `{ date: "2025-11-25" }`

---

#### Test Case WF-03: View Workflow Execution History
**Objective:** Verify user can view past workflow executions

**Preconditions:**
- Test Case WF-02 passed
- Workflow executed 3 times

**Test Steps:**
1. Navigate to workflow detail page for "Daily Standup Report"
2. Click "History" tab
3. Observe execution history list

**Expected Results:**
- ✅ History tab shows list of past executions
- ✅ Each execution shows: timestamp, status (success/failed), inputs, duration
- ✅ User can click execution to view full result
- ✅ Desktop calls Moku API: `GET /workflows/:id/executions?limit=50`

**Test Data:**
- 3 executions with different dates: "2025-11-25", "2025-11-24", "2025-11-23"

---

#### Test Case WF-04: Fork Workflow
**Objective:** Verify user can fork (copy) workflow for customization

**Preconditions:**
- Test Case WF-01 passed
- Workflow "Daily Standup Report" exists

**Test Steps:**
1. Navigate to workflow detail page
2. Click "Fork" button
3. Observe workflow copy created
4. Edit forked workflow:
   - Name: "Weekly Standup Report"
   - Change prompt to include "for the week of {{week_start}}"
5. Save forked workflow

**Expected Results:**
- ✅ Clicking "Fork" calls Desktop IPC: `workflows.fork(workflowId)`
- ✅ Desktop calls Moku API: `POST /workflows/:id/fork`
- ✅ New workflow created with same inputs/steps but different ID
- ✅ Forked workflow name: "Daily Standup Report (Copy)"
- ✅ User can edit forked workflow independently
- ✅ Original workflow unchanged

**Test Data:**
- Original workflow: "Daily Standup Report" (workflow-001)
- Forked workflow: "Weekly Standup Report" (workflow-002)

---

### 4.2 Advanced Workflow Features

#### Test Case WF-05: Workflow with Multiple Steps
**Objective:** Verify workflow can execute multiple sequential steps

**Preconditions:**
- User logged in

**Test Steps:**
1. Create workflow "Customer Email Responder" with 3 steps:
   - Step 1 (Prompt): "Analyze this customer email: {{email_content}}"
   - Step 2 (Prompt): "Based on analysis: {{step1_output}}, classify sentiment: positive/negative/neutral"
   - Step 3 (Prompt): "Generate response email with tone matching sentiment: {{step2_output}}"
2. Execute workflow with email content input
3. Observe 3-step execution

**Expected Results:**
- ✅ Workflow executes steps sequentially
- ✅ Each step can reference previous step output: `{{step1_output}}`, `{{step2_output}}`
- ✅ Execution progress updates: "Step 1 of 3", "Step 2 of 3", "Step 3 of 3"
- ✅ Final result is output of Step 3
- ✅ Intermediate outputs saved in execution history

**Test Data:**
- Input: `email_content` = "I'm very disappointed with the product quality..."
- Step 2 output: "negative"
- Step 3 output: Email with apologetic tone

---

#### Test Case WF-06: Workflow Scheduling
**Objective:** Verify user can schedule workflow to run automatically

**Preconditions:**
- Test Case WF-01 passed
- Workflow "Daily Standup Report" exists

**Test Steps:**
1. Navigate to workflow detail page
2. Click "Schedule" button
3. Configure schedule:
   - Frequency: "Daily"
   - Time: "9:00 AM"
   - Timezone: "America/Los_Angeles"
   - Start date: "2025-11-27"
4. Save schedule

**Expected Results:**
- ✅ Schedule configuration modal opens
- ✅ User selects frequency: Once, Daily, Weekly, Monthly
- ✅ User sets time and timezone
- ✅ Desktop calls Moku API: `POST /workflows/:id/schedules { frequency: 'daily', time: '09:00', timezone: 'America/Los_Angeles', startDate: '2025-11-27' }`
- ✅ Schedule saved and displayed in workflow details
- ✅ Workflow executes automatically at scheduled time (Moku API handles execution)

**Test Data:**
- Schedule: Daily at 9:00 AM PST

---

#### Test Case WF-07: Workflow with MCP Action Step
**Objective:** Verify workflow can execute MCP tool as step

**Preconditions:**
- GitHub MCP server enabled and configured
- Workflow created with MCP action step

**Test Steps:**
1. Create workflow "Create GitHub Issue from Bug Report" with 2 steps:
   - Step 1 (Prompt): "Extract key details from bug report: {{bug_report_text}}"
   - Step 2 (MCP Action - GitHub `create_issue`):
     - repository: "holokai/desktop"
     - title: "{{step1_output.title}}"
     - body: "{{step1_output.description}}"
2. Execute workflow with bug report input
3. Observe GitHub issue created

**Expected Results:**
- ✅ Step 1 executes as normal prompt
- ✅ Step 2 executes via MCPOrchestrator.executeAction("github", "create_issue", params)
- ✅ GitHub MCP server creates issue via GitHub API
- ✅ Issue URL returned: "https://github.com/holokai/desktop/issues/42"
- ✅ Workflow execution completes successfully
- ✅ Result includes issue URL

**Test Data:**
- Bug report: "App crashes when uploading files larger than 10MB"
- Created issue: holokai/desktop#42

---

## 5. Chat-to-Workflow Progression Tests

### 5.1 Feature #1: "Make This a Workflow" Button

#### Test Case CW-01: Button Visibility
**Objective:** Verify "Make this a workflow" button appears on eligible assistant responses

**Preconditions:**
- User logged in to Desktop app
- Active chat thread with assistant responses

**Test Steps:**
1. Send prompt to assistant: "Summarize this email: [email content]"
2. Wait for assistant response with summary
3. Hover over assistant response message

**Expected Results:**
- ✅ "Make this a workflow" button appears on assistant response
- ✅ Button shows icon 🤖 + text "Make this a workflow"
- ✅ Button is clickable and styled correctly

**Test Data:**
- Email content: "Subject: Q4 Sales Report Request\nBody: Hi team, please send me the Q4 sales report by EOD..."

---

#### Test Case CW-02: Workflow Creation Wizard - Step 1 (Name & Description)
**Objective:** Verify workflow creation wizard opens with auto-generated name and description

**Preconditions:**
- Test Case CW-01 passed
- "Make this a workflow" button visible

**Test Steps:**
1. Click "Make this a workflow" button on assistant response
2. Observe wizard modal opens

**Expected Results:**
- ✅ 3-step wizard modal opens ("Name & Description" → "Input Variables" → "Confirmation")
- ✅ Workflow name auto-generated from prompt (e.g., "Summarize this email")
- ✅ Workflow description auto-generated (e.g., "Summarize email content")
- ✅ User can edit name and description fields
- ✅ "Next" button enabled

**Test Data:**
- Original prompt: "Summarize this email: [email content]"
- Expected name: "Summarize this email" (first 50 chars, trimmed)
- Expected description: "Summarize email content" (auto-generated)

---

#### Test Case CW-03: Workflow Creation Wizard - Step 2 (Variable Detection)
**Objective:** Verify automatic variable detection identifies inputs from prompt

**Preconditions:**
- Test Case CW-02 passed
- User clicked "Next" on Step 1

**Test Steps:**
1. Navigate to Step 2: "Input Variables"
2. Observe detected variables list

**Expected Results:**
- ✅ Email content detected as variable: `email_content` (type: string, default: "[email content]")
- ✅ Variable type correctly identified (string, number, date, etc.)
- ✅ User can edit variable name and default value
- ✅ User can add new variables manually
- ✅ User can delete detected variables
- ✅ "Next" button enabled

**Test Data:**
- Detected variables:
  - `email_content` (string) - from original prompt

---

#### Test Case CW-04: Workflow Creation Wizard - Step 3 (Confirmation)
**Objective:** Verify workflow preview and immediate action options

**Preconditions:**
- Test Case CW-03 passed
- User clicked "Next" on Step 2

**Test Steps:**
1. Navigate to Step 3: "Confirmation"
2. Review workflow summary
3. Select "Create Workflow" action

**Expected Results:**
- ✅ Workflow summary displayed: name, description, input variables, prompt template
- ✅ Three action buttons shown: "Run Now", "Schedule", "View Workflow"
- ✅ Clicking "Create Workflow" creates workflow in Moku API
- ✅ Success toast appears: "Workflow 'Summarize this email' created!"
- ✅ Modal closes automatically

**Test Data:**
- Workflow name: "Summarize this email"
- Input variables: `email_content` (string)
- Prompt template: "Summarize this email: {{email_content}}"

---

#### Test Case CW-05: Run Workflow Immediately
**Objective:** Verify user can run newly created workflow immediately

**Preconditions:**
- Test Case CW-04 passed
- Workflow created successfully

**Test Steps:**
1. On Confirmation step, click "Run Now" button
2. Observe workflow execution

**Expected Results:**
- ✅ Workflow execution modal opens
- ✅ Input fields pre-populated with default values
- ✅ User can edit input values
- ✅ Clicking "Run" executes workflow via Moku API
- ✅ Workflow result displayed in chat or execution history

**Test Data:**
- Input: `email_content` = "Subject: Q4 Sales Report Request\nBody: Hi team, please send me the Q4 sales report by EOD..."

---

### 2.2 Feature #2: Automatic Workflow Suggestions

#### Test Case CW-06: Pattern Detection Trigger
**Objective:** Verify Desktop fetches workflow suggestions from Moku API

**Preconditions:**
- User logged in to Desktop app
- User has sent 15+ similar chat messages over 7 days (simulated via test data)
- Moku API pattern detection background job completed (created WorkflowSuggestion records)

**Test Steps:**
1. Open Desktop app
2. Wait for Desktop to poll Moku API for suggestions (`GET /workflows/suggestions?userId={id}`)
3. Observe suggestion toast appears

**Expected Results:**
- ✅ Desktop polls Moku API every 24 hours for suggestions
- ✅ Suggestion toast appears in bottom-right corner
- ✅ Toast shows message: "You've summarized emails 15 times. Want me to automate this?"
- ✅ Toast shows two actions: "Create Workflow" and "Dismiss"

**Test Data:**
- 15 chat messages with pattern: "Summarize this email: [varying content]"
- Moku API WorkflowSuggestion: `{ id, userId, pattern: "email summarization", occurrences: 15, status: "pending" }`

---

#### Test Case CW-07: Accept Workflow Suggestion
**Objective:** Verify user can accept workflow suggestion and create workflow

**Preconditions:**
- Test Case CW-06 passed
- Suggestion toast visible

**Test Steps:**
1. Click "Create Workflow" button on suggestion toast
2. Observe workflow creation wizard opens

**Expected Results:**
- ✅ Workflow creation wizard opens (same as Feature #1)
- ✅ Workflow name pre-filled: "Summarize email"
- ✅ Workflow description pre-filled: "Automatically summarize email content based on your pattern"
- ✅ Input variables detected from pattern: `email_content`
- ✅ User completes wizard and creates workflow
- ✅ Moku API suggestion status updated: `accepted`

**Test Data:**
- Suggestion ID: "suggestion-001"
- Pattern: "email summarization"

---

#### Test Case CW-08: Dismiss Workflow Suggestion
**Objective:** Verify user can dismiss workflow suggestion

**Preconditions:**
- Test Case CW-06 passed
- Suggestion toast visible

**Test Steps:**
1. Click "Dismiss" button on suggestion toast
2. Observe toast disappears

**Expected Results:**
- ✅ Toast disappears immediately
- ✅ Desktop calls Moku API: `PATCH /workflows/suggestions/:id { status: "dismissed" }`
- ✅ Suggestion not shown again for 30 days

**Test Data:**
- Suggestion ID: "suggestion-001"

---

#### Test Case CW-09: Never Suggest Pattern (Context Menu)
**Objective:** Verify user can permanently block a suggestion pattern

**Preconditions:**
- Test Case CW-06 passed
- Suggestion toast visible

**Test Steps:**
1. Right-click on suggestion toast
2. Select "Never suggest this pattern" from context menu
3. Confirm action in modal

**Expected Results:**
- ✅ Context menu appears with "Never suggest this pattern" option
- ✅ Confirmation modal appears: "Are you sure? This pattern will never be suggested again."
- ✅ Clicking "Confirm" calls Moku API: `PATCH /workflows/suggestions/:id { status: "blacklisted" }`
- ✅ Toast disappears
- ✅ Pattern never suggested again (verified by no future suggestions with same pattern)

**Test Data:**
- Suggestion ID: "suggestion-001"
- Pattern: "email summarization"

---

#### Test Case CW-10: Suggestion Frequency Limit
**Objective:** Verify Desktop shows max 1 suggestion toast per day

**Preconditions:**
- User has 3+ pending workflow suggestions in Moku API

**Test Steps:**
1. Open Desktop app (Day 1)
2. Observe 1 suggestion toast appears
3. Dismiss toast
4. Close and reopen Desktop app (same day)
5. Observe no new suggestion toast appears
6. Wait 24 hours
7. Open Desktop app (Day 2)
8. Observe next suggestion toast appears

**Expected Results:**
- ✅ Day 1: 1 suggestion toast appears
- ✅ Day 1 (after dismiss): No additional toasts appear
- ✅ Day 2: Next suggestion toast appears (different pattern)
- ✅ Desktop tracks last suggestion timestamp locally

**Test Data:**
- 3 pending suggestions: "email summarization", "report generation", "meeting prep"

---

### 2.3 Feature #3: Template Marketplace

#### Test Case CW-11: Browse Template Marketplace
**Objective:** Verify user can browse workflow templates by category

**Preconditions:**
- User logged in to Desktop app
- 50+ templates available in Moku API

**Test Steps:**
1. Navigate to Workflows → Templates page
2. Observe template categories and templates

**Expected Results:**
- ✅ 5 categories displayed: Marketing, Sales, Operations, Finance, HR
- ✅ Each category shows 10 templates
- ✅ Each template card shows: name, description, category tag, popularity score
- ✅ User can click category to filter templates
- ✅ User can search templates with search bar

**Test Data:**
- 50 templates (10 per category)
- Example template: "Weekly Sales Report" (category: Sales, description: "Generate weekly sales summary from CRM data")

---

#### Test Case CW-12: Template Fuzzy Search
**Objective:** Verify fuzzy search returns relevant templates

**Preconditions:**
- Test Case CW-11 passed
- Template marketplace page open

**Test Steps:**
1. Type "sales reprt" (intentional typo) in search bar
2. Observe search results

**Expected Results:**
- ✅ Fuzzy search matches "sales report" templates despite typo
- ✅ Top 5 relevant templates displayed
- ✅ Results ranked by relevance (fuse.js threshold: 0.4)
- ✅ Search query highlighted in results

**Test Data:**
- Search query: "sales reprt" (typo)
- Expected results: "Weekly Sales Report", "Monthly Sales Summary", "Sales Pipeline Report"

---

#### Test Case CW-13: Activate Template via UI
**Objective:** Verify user can activate template and configure inputs

**Preconditions:**
- Test Case CW-11 passed
- User viewing template card

**Test Steps:**
1. Click "Use Template" button on "Weekly Sales Report" template
2. Observe template activation modal opens
3. Fill in required inputs: `report_period` = "2025-11-01 to 2025-11-07", `crm_data_source` = "Salesforce"
4. Click "Create Workflow"

**Expected Results:**
- ✅ Template activation modal opens with input collection form
- ✅ Required inputs marked with asterisk (*)
- ✅ Input validation prevents submission with missing required fields
- ✅ Clicking "Create Workflow" calls Moku API: `POST /workflow-templates/:id/activate { userId, inputs }`
- ✅ Success toast: "Workflow 'Weekly Sales Report' created from template!"
- ✅ User redirected to workflow detail page

**Test Data:**
- Template ID: "template-sales-001"
- Inputs: `{ report_period: "2025-11-01 to 2025-11-07", crm_data_source: "Salesforce" }`

---

#### Test Case CW-14: Activate Template via Chat
**Objective:** Verify user can activate template through chat interaction

**Preconditions:**
- User logged in to Desktop app
- Active chat thread

**Test Steps:**
1. Send chat message: "Set up weekly sales report"
2. Observe Desktop detects template intent
3. Observe Desktop suggests "Weekly Sales Report" template
4. Confirm template activation in chat

**Expected Results:**
- ✅ Desktop calls `IntentDetectionService.detectTemplateIntent("Set up weekly sales report")`
- ✅ Intent detection matches "weekly sales report" pattern
- ✅ Desktop calls `TemplateMarketplaceService.searchTemplates("weekly sales report")`
- ✅ Chat response: "I found a template for 'Weekly Sales Report'. Would you like to set it up?"
- ✅ User clicks "Yes, set it up" → Template activation modal opens (same as Test Case CW-13)

**Test Data:**
- Chat message: "Set up weekly sales report"
- Matched template: "Weekly Sales Report" (ID: "template-sales-001")

---

#### Test Case CW-15: Featured Templates
**Objective:** Verify featured templates displayed on homepage

**Preconditions:**
- User logged in to Desktop app
- Homepage/Dashboard visible

**Test Steps:**
1. Navigate to Dashboard
2. Observe "Featured Templates" section

**Expected Results:**
- ✅ "Featured Templates" section displays 5 most popular templates
- ✅ Each template shows: name, description, category, "Use Template" button
- ✅ Templates ranked by popularity score (usage count)
- ✅ Clicking "Use Template" opens activation modal (same as Test Case CW-13)

**Test Data:**
- Featured templates (sorted by popularity):
  1. "Weekly Sales Report" (150 uses)
  2. "Meeting Summary" (120 uses)
  3. "Email Campaign Creator" (100 uses)
  4. "Expense Report Generator" (90 uses)
  5. "Customer Onboarding Checklist" (85 uses)

---

## 6. MCP Integration Tests

### 6.1 MCP Server Lifecycle Management

#### Test Case MCP-01: MCP Server Discovery on Login
**Objective:** Verify Desktop fetches enabled MCP servers from Moku API on login

**Preconditions:**
- User account with organization that has 5 MCP servers enabled (GitHub, Slack, Jira, Notion, Google Drive)
- Moku API database has `organization_mcp_servers` records

**Test Steps:**
1. Launch Desktop app
2. Log in with test user credentials
3. Observe Desktop initialization process

**Expected Results:**
- ✅ Desktop calls Moku API: `GET /mcp/servers?organizationId={orgId}`
- ✅ Moku API returns 5 enabled servers: `[{ serverId: "github", version: "1.0.0", config: {} }, ...]`
- ✅ Desktop logs: "Initializing 5 MCP servers..."
- ✅ Desktop spawns 5 child processes (1 per server)
- ✅ Initialization completes within 5 seconds (<1 second per server)

**Test Data:**
- Organization ID: "org-001"
- Enabled servers: GitHub, Slack, Jira, Notion, Google Drive

---

#### Test Case MCP-02: MCP Server Process Spawning
**Objective:** Verify Desktop spawns MCP server as sandboxed child process

**Preconditions:**
- Test Case MCP-01 passed
- Desktop initializing GitHub MCP server

**Test Steps:**
1. Observe Desktop spawning GitHub MCP server process
2. Check process details (PID, resource limits, environment variables)

**Expected Results:**
- ✅ Desktop fetches GitHub server manifest from Holo registry
- ✅ Desktop fetches GitHub credentials from Moku API: `GET /mcp/credentials/github?userId={userId}`
- ✅ Desktop spawns child process: `spawn("npx", ["-y", "@modelcontextprotocol/server-github"], { env: { GITHUB_TOKEN: "ghp_..." }, stdio: ["pipe", "pipe", "pipe"] })`
- ✅ Resource limits applied (Unix): 512MB RAM, 1 CPU, 60s timeout
- ✅ Process ID (PID) logged: "GitHub MCP server started (PID: 12345)"
- ✅ Credentials injected as environment variables, not stored locally

**Test Data:**
- Server ID: "github"
- Manifest: `{ executable: "npx", args: ["-y", "@modelcontextprotocol/server-github"], resourceLimits: { maxMemoryMB: 512, maxCPU: 1, timeoutSeconds: 60 } }`
- Credentials: `{ GITHUB_TOKEN: "ghp_test123..." }`

---

#### Test Case MCP-03: MCP Protocol Handshake
**Objective:** Verify Desktop establishes JSON-RPC connection with MCP server

**Preconditions:**
- Test Case MCP-02 passed
- GitHub MCP server process spawned

**Test Steps:**
1. Observe Desktop connecting to GitHub MCP server via stdio
2. Observe JSON-RPC handshake

**Expected Results:**
- ✅ Desktop creates JSON-RPC client: `new JSONRPCClient((request) => process.stdin.write(JSON.stringify(request) + '\n'))`
- ✅ Desktop listens to stdout: `process.stdout.on('data', (data) => { ... })`
- ✅ Desktop sends `initialize` request: `{ jsonrpc: "2.0", method: "initialize", id: 1, params: { protocolVersion: "2024-11-05", clientInfo: { name: "holokai-desktop", version: "1.0.0" } } }`
- ✅ Server responds with `initialize` result: `{ jsonrpc: "2.0", id: 1, result: { protocolVersion: "2024-11-05", serverInfo: { name: "github", version: "1.0.0" }, capabilities: { tools: {} } } }`
- ✅ Connection marked as "healthy" in Desktop logs

**Test Data:**
- Server: GitHub MCP server
- Protocol version: "2024-11-05"

---

#### Test Case MCP-04: Tool Discovery
**Objective:** Verify Desktop discovers available tools from MCP server

**Preconditions:**
- Test Case MCP-03 passed
- GitHub MCP server connected

**Test Steps:**
1. Observe Desktop calling `tools/list` JSON-RPC method
2. Observe tools registered in MCPActionRegistry

**Expected Results:**
- ✅ Desktop sends `tools/list` request: `{ jsonrpc: "2.0", method: "tools/list", id: 2 }`
- ✅ Server responds with tools: `{ jsonrpc: "2.0", id: 2, result: { tools: [{ name: "create_issue", description: "Create GitHub issue", inputSchema: { ... } }, ...] } }`
- ✅ Desktop registers 10+ tools in MCPActionRegistry: `create_issue`, `list_repos`, `create_pr`, `get_commits`, etc.
- ✅ Desktop logs: "Discovered 12 tools from GitHub MCP server"

**Test Data:**
- Server: GitHub MCP server
- Expected tools: `create_issue`, `list_repos`, `create_pr`, `get_commits`, `search_issues`, etc.

---

#### Test Case MCP-05: MCP Server Health Monitoring
**Objective:** Verify Desktop monitors MCP server health and auto-restarts on crash

**Preconditions:**
- Test Case MCP-04 passed
- GitHub MCP server running

**Test Steps:**
1. Simulate GitHub MCP server crash (kill process manually)
2. Observe Desktop detects crash
3. Observe Desktop auto-restart

**Expected Results:**
- ✅ Desktop detects process exit: `process.on('exit', (code) => { ... })`
- ✅ Desktop logs: "GitHub MCP server crashed (exit code: 1). Restarting..."
- ✅ Desktop restarts server (attempt 1/3) after 1 second delay
- ✅ If crash repeats, Desktop retries with exponential backoff: 2s, 4s
- ✅ After 3 failed attempts, Desktop logs: "GitHub MCP server failed to start after 3 attempts. Manual intervention required."
- ✅ Desktop shows error toast to user: "GitHub integration is currently unavailable. Please contact support."

**Test Data:**
- Server: GitHub MCP server
- Simulated crash: `kill -9 <PID>`
- Restart policy: Max 3 attempts, exponential backoff (1s, 2s, 4s)

---

### 6.2 MCP Tool Execution

#### Test Case MCP-06: Execute MCP Tool from Workflow
**Objective:** Verify workflow can execute MCP tool and receive result

**Preconditions:**
- Test Case MCP-04 passed
- User has workflow with MCP action step

**Test Steps:**
1. Create workflow with step:
   ```yaml
   - name: "Create GitHub Issue"
     type: "mcp_action"
     server_id: "github"
     tool_name: "create_issue"
     inputs:
       repository: "holokai/desktop"
       title: "Test issue from workflow"
       body: "This is a test issue created by workflow automation"
   ```
2. Execute workflow
3. Observe MCP tool execution

**Expected Results:**
- ✅ Workflow engine calls `MCPOrchestrator.executeAction("github", "create_issue", { repository: "holokai/desktop", title: "...", body: "..." })`
- ✅ MCPOrchestrator sends `tools/call` request to GitHub MCP server:
   ```json
   {
     "jsonrpc": "2.0",
     "method": "tools/call",
     "id": 3,
     "params": {
       "name": "create_issue",
       "arguments": {
         "repository": "holokai/desktop",
         "title": "Test issue from workflow",
         "body": "This is a test issue created by workflow automation"
       }
     }
   }
   ```
- ✅ Server responds with result: `{ jsonrpc: "2.0", id: 3, result: { content: [{ type: "text", text: "Issue created: https://github.com/holokai/desktop/issues/42" }] } }`
- ✅ Workflow step completes successfully
- ✅ Result stored in workflow execution history

**Test Data:**
- Workflow ID: "workflow-001"
- MCP Tool: `create_issue` (GitHub)
- Inputs: `{ repository: "holokai/desktop", title: "Test issue", body: "..." }`

---

#### Test Case MCP-07: MCP Tool Execution Timeout
**Objective:** Verify Desktop enforces 60-second timeout per tool execution

**Preconditions:**
- Test Case MCP-04 passed
- Simulate slow MCP server response (>60 seconds)

**Test Steps:**
1. Execute MCP tool that takes >60 seconds (simulated delay)
2. Observe Desktop timeout handling

**Expected Results:**
- ✅ Desktop starts timer on `tools/call` request
- ✅ After 60 seconds without response, Desktop kills MCP server process
- ✅ Desktop logs: "GitHub MCP server timed out after 60 seconds. Killing process..."
- ✅ Workflow step fails with error: "Tool execution timed out (60s limit exceeded)"
- ✅ Desktop restarts MCP server for future requests

**Test Data:**
- Tool: `create_issue` (GitHub)
- Simulated delay: 65 seconds

---

#### Test Case MCP-08: MCP Tool Execution Error Handling
**Objective:** Verify Desktop handles MCP tool errors gracefully

**Preconditions:**
- Test Case MCP-04 passed
- Simulate MCP tool error (invalid inputs)

**Test Steps:**
1. Execute MCP tool with invalid inputs:
   ```yaml
   - name: "Create GitHub Issue"
     type: "mcp_action"
     server_id: "github"
     tool_name: "create_issue"
     inputs:
       repository: "invalid/repo"  # Repository doesn't exist
       title: "Test issue"
       body: "..."
   ```
2. Observe error handling

**Expected Results:**
- ✅ MCP server responds with JSON-RPC error: `{ jsonrpc: "2.0", id: 3, error: { code: -32602, message: "Repository not found: invalid/repo" } }`
- ✅ Desktop logs error: "GitHub MCP tool 'create_issue' failed: Repository not found: invalid/repo"
- ✅ Workflow step fails with error message
- ✅ Error displayed to user in workflow execution history
- ✅ MCP server remains running (error doesn't trigger restart)

**Test Data:**
- Tool: `create_issue` (GitHub)
- Invalid input: `repository: "invalid/repo"`

---

### 6.3 MCP Settings UI

#### Test Case MCP-09: View Available MCP Servers
**Objective:** Verify user can view all available MCP servers for their organization

**Preconditions:**
- User logged in to Desktop app
- Organization has 20 official MCP servers available

**Test Steps:**
1. Navigate to Settings → Integrations
2. Observe MCP servers list

**Expected Results:**
- ✅ Integrations page displays 20 MCP servers in categorized sections:
   - Version Control: GitHub, GitLab
   - Communication: Slack, Discord
   - Project Management: Jira, Linear, Asana
   - Documentation: Notion, Confluence
   - Cloud Storage: Google Drive, Dropbox, OneDrive
   - Productivity: Google Calendar, Google Sheets, Airtable
   - CRM: Salesforce, HubSpot
   - DevOps: AWS, Kubernetes
   - Databases: PostgreSQL
- ✅ Each server shows: logo, name, description, status (Enabled/Disabled), "Configure" button

**Test Data:**
- 20 official MCP servers from Moku API

---

#### Test Case MCP-10: Configure MCP Server Credentials
**Objective:** Verify user can configure credentials for MCP server

**Preconditions:**
- Test Case MCP-09 passed
- User viewing GitHub MCP server card

**Test Steps:**
1. Click "Configure" button on GitHub MCP server
2. Observe credential configuration modal
3. Enter GitHub Personal Access Token: "ghp_test123..."
4. Click "Save & Test Connection"

**Expected Results:**
- ✅ Credential configuration modal opens with password field labeled "GitHub Personal Access Token"
- ✅ Password field is masked (shows dots instead of characters)
- ✅ Clicking "Save & Test Connection" triggers:
   - Desktop sends credentials to Moku API: `POST /mcp/credentials { serverId: "github", userId: "user-001", credentials: { GITHUB_TOKEN: "ghp_test123..." } }`
   - Moku API encrypts credentials (AES-256-GCM) and stores in database
   - Desktop spawns GitHub MCP server with credentials
   - Desktop calls `tools/list` to verify connection
- ✅ Success toast: "GitHub integration configured successfully!"
- ✅ GitHub server status updated to "Enabled"

**Test Data:**
- Server: GitHub
- Credential: `GITHUB_TOKEN: "ghp_test123..."`

---

#### Test Case MCP-11: Test MCP Server Connection
**Objective:** Verify "Test Connection" feature validates MCP server is working

**Preconditions:**
- Test Case MCP-10 passed
- GitHub MCP server configured with credentials

**Test Steps:**
1. On Settings → Integrations page, click "Test Connection" button for GitHub server
2. Observe connection test

**Expected Results:**
- ✅ Desktop spawns temporary GitHub MCP server process
- ✅ Desktop calls `tools/list` to verify server responds
- ✅ If successful: Green checkmark icon + "Connected" status
- ✅ If failed: Red X icon + "Connection failed" status + error message
- ✅ Desktop kills temporary process after test completes

**Test Data:**
- Server: GitHub
- Expected result: Success (tools list returned)

---

#### Test Case MCP-12: View Available Tools per Server
**Objective:** Verify user can view all tools provided by MCP server

**Preconditions:**
- Test Case MCP-10 passed
- GitHub MCP server enabled and connected

**Test Steps:**
1. On Settings → Integrations page, click "View Tools" on GitHub server card
2. Observe tools list modal

**Expected Results:**
- ✅ Tools list modal opens showing 12+ GitHub tools:
   - `create_issue` - Create GitHub issue
   - `list_repos` - List repositories
   - `create_pr` - Create pull request
   - `get_commits` - Get commit history
   - `search_issues` - Search issues
   - ... (12+ total)
- ✅ Each tool shows: name, description, input parameters

**Test Data:**
- Server: GitHub
- Expected tools count: 12+

---

### 6.4 MCP Organizational Control

#### Test Case MCP-13: Organization Admin Enables MCP Server (Moku API)
**Objective:** Verify organization admin can enable/disable MCP servers via Moku dashboard

**Preconditions:**
- User is organization admin
- Logged in to Moku dashboard (web)

**Test Steps:**
1. Navigate to Moku dashboard → Organization Settings → Integrations
2. Enable "Notion" MCP server for organization
3. Save settings
4. Open Desktop app
5. Navigate to Settings → Integrations

**Expected Results:**
- ✅ Moku dashboard shows toggle switch for each MCP server
- ✅ Admin enables "Notion" server → Moku API creates `organization_mcp_servers` record: `{ organizationId: "org-001", serverId: "notion", enabled: true, version: "1.0.0" }`
- ✅ Desktop app polls Moku API and detects new enabled server
- ✅ Desktop auto-initializes Notion MCP server on next login
- ✅ Notion server appears in Settings → Integrations with "Enabled" status

**Test Data:**
- Organization: "org-001"
- Server: Notion (newly enabled)

---

#### Test Case MCP-14: Desktop Respects Organization MCP Configuration
**Objective:** Verify Desktop only initializes MCP servers enabled by organization admin

**Preconditions:**
- Organization has 3/20 MCP servers enabled: GitHub, Slack, Jira
- Organization has 17/20 MCP servers disabled

**Test Steps:**
1. Login to Desktop app
2. Observe MCP initialization

**Expected Results:**
- ✅ Desktop fetches enabled servers from Moku API: `GET /mcp/servers?organizationId=org-001`
- ✅ Moku API returns only 3 servers: GitHub, Slack, Jira
- ✅ Desktop initializes only 3 MCP servers (not 20)
- ✅ Settings → Integrations page shows:
   - 3 servers "Enabled": GitHub, Slack, Jira
   - 17 servers "Available (disabled by organization)": Notion, Google Drive, etc.
- ✅ User cannot configure credentials for disabled servers (message: "This integration has been disabled by your organization administrator")

**Test Data:**
- Organization: "org-001"
- Enabled servers: GitHub, Slack, Jira
- Disabled servers: 17 others

---

## 7. End-to-End User Journey Tests

### Test Case E2E-01: Knowledge Worker - Chat to First Workflow (7-Day Journey)
**Objective:** Validate complete user journey from first login to first workflow creation within 7 days

**User Persona:** Sarah (Marketing Coordinator)

**Day 1: First Login**
1. Sarah logs in to Desktop app for first time
2. Sees onboarding tooltip: "Start chatting naturally—ask me to help with any task"
3. Sends first prompt: "Summarize this email: [sales inquiry email]"
4. Receives summary, notices "Make this a workflow" button
5. Ignores button for now (exploring)

**Day 3: Repetitive Pattern**
6. Sarah summarizes 5 more emails over 3 days using chat
7. No suggestion yet (pattern detection requires 3+ similar messages over 7 days)

**Day 7: Workflow Suggestion**
8. Sarah logs in on Day 7
9. Suggestion toast appears: "You've summarized emails 6 times. Want me to automate this?"
10. Sarah clicks "Create Workflow"
11. Completes 3-step wizard:
    - Step 1: Name "Email Summary", Description "Summarize sales inquiry emails"
    - Step 2: Variable `email_content` auto-detected
    - Step 3: Click "Create Workflow"
12. Success! First workflow created within 7 days

**Expected Results:**
- ✅ Time to first workflow: 7 days (meets <7 day target)
- ✅ Progression triggered by suggestion (not manual button click)
- ✅ Workflow saved to Moku API
- ✅ Sarah can now run "Email Summary" workflow anytime

**Test Data:**
- User: Sarah (Marketing Coordinator)
- Pattern: Email summarization (6 occurrences over 7 days)

---

### Test Case E2E-02: Knowledge Worker - Template Marketplace to Workflow
**Objective:** Validate user discovers and activates workflow template via chat

**User Persona:** John (Sales Rep)

**Day 1:**
1. John logs in to Desktop app
2. Sends chat message: "I need to create weekly sales reports"
3. Desktop detects template intent and responds: "I found a template for 'Weekly Sales Report'. Would you like to set it up?"
4. John clicks "Yes, set it up"
5. Template activation modal opens
6. John fills inputs:
   - `report_period`: "Last 7 days"
   - `crm_data_source`: "Salesforce"
7. Clicks "Create Workflow"
8. Workflow "Weekly Sales Report" created

**Day 2-7:**
9. John runs workflow 5 times
10. Shares workflow with sales team

**Expected Results:**
- ✅ Time to first workflow: <1 day (instant via template)
- ✅ Template discovered via chat (not manual browse)
- ✅ Workflow created from template (60%+ template usage target)
- ✅ Workflow executed 5+ times (demonstrates value)
- ✅ Workflow shared with team (collaboration)

**Test Data:**
- User: John (Sales Rep)
- Template: "Weekly Sales Report"
- Executions: 5 runs over 7 days

---

### Test Case E2E-03: IT Leader - MCP Integration Configuration
**Objective:** Validate IT admin configures MCP integrations for organization

**User Persona:** Lisa (IT Leader)

**Pre-deployment:**
1. Lisa logs in to Moku dashboard (web) as organization admin
2. Navigates to Organization Settings → Integrations
3. Enables 10 MCP servers for organization: GitHub, Slack, Jira, Notion, Google Drive, Salesforce, HubSpot, Google Calendar, AWS, PostgreSQL
4. Saves settings

**Day 1: User Onboarding**
5. Lisa logs in to Desktop app
6. Navigates to Settings → Integrations
7. Sees 10 enabled MCP servers
8. Configures credentials for each:
   - GitHub: Personal Access Token
   - Slack: Workspace Token
   - Jira: API Key
   - ... (8 more)
9. Tests each connection (all successful)

**Day 7: Monitoring**
10. Lisa reviews Holo Platform health dashboard
11. Sees all 10 MCP servers healthy across organization
12. Monitors usage: 50 employees configured at least 1 integration (60%+ target met)

**Expected Results:**
- ✅ Organization admin can enable MCP servers via Moku dashboard
- ✅ Desktop respects organization configuration (only shows enabled servers)
- ✅ IT leader can configure all integrations in one session
- ✅ Health monitoring shows all servers operational
- ✅ 60%+ employee adoption of MCP integrations

**Test Data:**
- User: Lisa (IT Leader)
- Organization: 100 employees
- Enabled servers: 10/20
- Adoption: 50/100 employees (50%)

---

## 8. Test Execution Plan

### 8.1 Test Schedule

**Week 1: Core Features (Threads & Projects)**
- Day 1: Thread Management - Basic (TH-01 to TH-03)
- Day 2: Thread Management - Branching (TH-04 to TH-07)
- Day 3: Thread Management - Organization (TH-08 to TH-12)
- Day 4: Project Collaboration - Creation & Management (PROJ-01 to PROJ-04)
- Day 5: Project Collaboration - Threads & Activity (PROJ-05 to PROJ-08)

**Week 2: Workflows & Chat-to-Workflow**
- Day 1: Workflow Execution - Basic (WF-01 to WF-04)
- Day 2: Workflow Execution - Advanced (WF-05 to WF-07)
- Day 3: Chat-to-Workflow - Feature #1 ("Make this a workflow" button) - Test Cases CW-01 to CW-05
- Day 4: Chat-to-Workflow - Feature #2 (Automatic suggestions) - Test Cases CW-06 to CW-10
- Day 5: Chat-to-Workflow - Feature #3 (Template marketplace) - Test Cases CW-11 to CW-15

**Week 3: MCP Integration**
- Day 1-2: MCP Server Lifecycle - Test Cases MCP-01 to MCP-05
- Day 3: MCP Tool Execution - Test Cases MCP-06 to MCP-08
- Day 4: MCP Settings UI - Test Cases MCP-09 to MCP-12
- Day 5: MCP Organizational Control - Test Cases MCP-13 to MCP-14

**Week 4: End-to-End & Regression**
- Day 1-2: E2E User Journeys - Test Cases E2E-01 to E2E-03
- Day 3-4: Regression testing (all critical paths)
- Day 5: Bug fixes and retesting

### 8.2 Test Metrics

**Defect Tracking:**
- **Critical:** Prevents core functionality (workflow creation fails, MCP servers won't start)
- **High:** Degrades user experience (suggestion toast not dismissing, credential save fails)
- **Medium:** Minor UI/UX issues (typos, styling inconsistencies)
- **Low:** Nice-to-have improvements

**Success Criteria:**
- ✅ 0 critical defects remaining
- ✅ <5 high-priority defects remaining
- ✅ 100% of P0 test cases pass
- ✅ 95%+ of all test cases pass

### 8.3 Test Environment Cleanup

After each test cycle:
1. Reset test user accounts (delete created workflows, clear chat history)
2. Reset Moku API test database (delete WorkflowSuggestion records, workflow templates)
3. Clear Desktop local storage (thread cache, state persistence)
4. Kill all running MCP server processes

---

## 9. Appendix

### 9.1 Test Data Repository

**Location:** `tests/fixtures/`

**Files:**
- `chat-messages.json` - 100+ pre-written chat messages for pattern detection
- `workflow-templates.json` - 50+ workflow templates (10 per category)
- `mcp-servers.json` - 20 official MCP server manifests
- `test-credentials.json` - Sandbox API keys for MCP servers (GitHub, Slack, etc.)
- `test-users.json` - 10 test user accounts with varying roles

### 9.2 Automation Recommendations

**Automatable Tests (80%):**
- API integration tests (Desktop ↔ Moku API calls)
- MCP protocol tests (JSON-RPC handshake, tool discovery)
- Workflow execution tests (MCP tool invocation)
- Credential storage/fetch tests

**Manual Tests (20%):**
- UI/UX validation (button placement, toast appearance, modal flows)
- Fuzzy search relevance (subjective "Are these results good?")
- End-to-end user journeys (realistic usage patterns)

**Recommended Tools:**
- **Playwright** - UI automation (Electron app testing)
- **Jest** - Unit tests for services (MCPOrchestrator, ThreadService)
- **Supertest** - API integration tests (Moku API endpoints)
- **Electron Spectron** - End-to-end Electron app testing

---

_Test Design Document - 2025-11-26_
