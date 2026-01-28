# Thread Panel Message Layout

**Version:** 1.0
**Date:** 2026-01-26
**Status:** Draft

---

## Related Documents

| Document | Description |
|----------|-------------|
| **ui-threadpanel-message-media.md** | Media handling (images, video, audio) |
| **ui-threadpanel-chatview.md** | Chat view and message timeline |
| **system-branching-id.md** | Branch ID format and message data model |
| **system-thread-multiplexing.md** | Streaming status phases |

---

## 1. Overview

This document defines the requirements for message layout, content rendering, and status display in the chat interface.

### Scope

| In Scope | Out of Scope |
|----------|--------------|
| Message content rendering | Message persistence |
| Layout configurations | Branch management |
| Status indicators | Streaming implementation |
| Content type detection | Tool execution |

---

## 2. Requirements

### 2.1 Functional Requirements

| ID | Requirement | Priority |
|----|-------------|----------|
| **FR-1** | Display plain text responses without formatting | CRITICAL |
| **FR-2** | Format and render Markdown content | CRITICAL |
| **FR-3** | Format and render HTML content | HIGH |
| **FR-4** | Format and render SVG content | HIGH |
| **FR-5** | Format and render CSV/TSV as tables | HIGH |
| **FR-6** | Syntax highlight common programming languages | HIGH |
| **FR-7** | Display message completion status (complete, error) | CRITICAL |
| **FR-8** | Support configurable prompt-response layouts | MEDIUM |
| **FR-9** | Display real-time status text during prompt processing | HIGH |

### 2.2 Non-Functional Requirements

| ID | Requirement | Target |
|----|-------------|--------|
| **NFR-1** | Markdown render time | < 50ms for typical message |
| **NFR-2** | Syntax highlighting | < 100ms for 500 lines |
| **NFR-3** | Layout switch | Instant (no re-render) |

---

## 3. Content Rendering

### 3.1 Plain Text (FR-1)

Display unformatted text when no formatting is detected or when user preferences disable formatting.

```typescript
interface PlainTextRenderer {
  render(content: string): string;
  preserveWhitespace: boolean;
  wrapLongLines: boolean;
}
```

**Behavior:**
- Preserve line breaks
- Optionally preserve whitespace (for code-like content)
- Wrap long lines to prevent horizontal scrolling

### 3.2 Markdown (FR-2)

Render Markdown with support for common extensions.

**Supported Elements:**

| Element | Syntax | Notes |
|---------|--------|-------|
| Headings | `# H1` to `###### H6` | Anchor links optional |
| Bold | `**text**` | |
| Italic | `*text*` | |
| Strikethrough | `~~text~~` | |
| Links | `[text](url)` | Open in new tab |
| Images | `![alt](url)` | See ui-threadpanel-message-media.md |
| Code inline | `` `code` `` | Monospace font |
| Code blocks | ` ``` ` | See §3.6 for syntax highlighting |
| Blockquotes | `> text` | Styled indentation |
| Lists | `- item` / `1. item` | Nested supported |
| Tables | `| col |` | See §3.5 |
| Horizontal rules | `---` | |
| Task lists | `- [ ] item` | Checkbox display (read-only) |

**Configuration:**
```typescript
interface MarkdownConfig {
  sanitize: boolean;           // Remove dangerous HTML (default: true)
  linkify: boolean;            // Auto-detect URLs (default: true)
  typographer: boolean;        // Smart quotes, dashes (default: false)
  breaks: boolean;             // Convert \n to <br> (default: true)
}
```

### 3.3 HTML (FR-3)

Render safe HTML content with sanitization.

**Allowed Tags:**
- Structural: `div`, `span`, `p`, `section`, `article`
- Text: `h1`-`h6`, `strong`, `em`, `code`, `pre`, `blockquote`
- Lists: `ul`, `ol`, `li`, `dl`, `dt`, `dd`
- Tables: `table`, `thead`, `tbody`, `tr`, `th`, `td`
- Media: `img`, `audio`, `video` (with controls)
- Links: `a` (with `target="_blank"` enforced)

**Blocked:**
- Scripts: `script`, `noscript`
- Frames: `iframe`, `frame`, `frameset`
- Objects: `object`, `embed`, `applet`
- Event handlers: `onclick`, `onerror`, etc.
- External styles: `link`, `@import`

### 3.4 SVG (FR-4)

Render inline SVG with security constraints.

**Allowed:**
- Shape elements: `svg`, `rect`, `circle`, `ellipse`, `line`, `polyline`, `polygon`, `path`
- Text: `text`, `tspan`
- Grouping: `g`, `defs`, `use`, `symbol`
- Gradients: `linearGradient`, `radialGradient`, `stop`
- Filters: `filter` (subset)

**Blocked:**
- Scripts: `script`, `foreignObject`
- External references: `href` to external URLs
- Event handlers

**Display Options:**
```typescript
interface SvgDisplayOptions {
  maxWidth: number;            // Default: 100% container
  maxHeight: number;           // Default: 600px
  allowZoom: boolean;          // Pan/zoom controls
  downloadable: boolean;       // Download as .svg button
}
```

### 3.5 CSV/TSV Tables (FR-5)

Parse and render tabular data as formatted tables.

**Detection:**
- File extension: `.csv`, `.tsv`
- Content heuristic: Consistent delimiter pattern
- Explicit code fence: ` ```csv ` or ` ```tsv `

**Rendering:**
```typescript
interface TableDisplayOptions {
  maxRows: number;             // Default: 100 (show "Load more")
  maxColumns: number;          // Default: 20 (horizontal scroll)
  headerRow: boolean;          // First row as header (default: auto-detect)
  sortable: boolean;           // Click column to sort (default: true)
  filterable: boolean;         // Search/filter box (default: false)
  striped: boolean;            // Alternating row colors (default: true)
}
```

**Features:**
- Auto-detect delimiter (comma, tab, semicolon)
- Handle quoted fields with embedded delimiters
- Display numbers right-aligned
- Truncate long cell content with tooltip

### 3.6 Syntax Highlighting (FR-6)

Highlight code blocks for common programming languages.

**Supported Languages:**

| Category | Languages |
|----------|-----------|
| Web | HTML, CSS, JavaScript, TypeScript, JSON, XML |
| Systems | C, C++, Rust, Go, Java, C# |
| Scripting | Python, Ruby, PHP, Perl, Bash, PowerShell |
| Data | SQL, YAML, TOML, GraphQL |
| Markup | Markdown, LaTeX |
| Config | Dockerfile, Nginx, Apache |
| Other | Regex, Diff, Plain text |

**Features:**
```typescript
interface CodeBlockOptions {
  theme: 'light' | 'dark' | 'auto';  // Match app theme
  lineNumbers: boolean;               // Default: true for >5 lines
  highlightLines?: number[];          // Highlight specific lines
  maxHeight: number;                  // Scroll if exceeded (default: 400px)
  copyButton: boolean;                // Copy to clipboard (default: true)
  wrapLines: boolean;                 // Wrap long lines (default: false)
  collapsible: boolean;               // Collapse long blocks (default: >50 lines)
}
```

**Language Detection:**
1. Explicit fence: ` ```python `
2. Filename hint: `config.yaml`
3. Shebang: `#!/bin/bash`
4. Content heuristic (fallback)

---

## 4. Layout Options

### 4.1 Layout Configurations (FR-8)

Three configurable layouts for prompt-response display:

#### Layout A: Prompt Left, Response Right

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────┐                                    │
│  │                     │                                    │
│  │   User Prompt       │                                    │
│  │                     │                                    │
│  └─────────────────────┘                                    │
│                             ┌─────────────────────────────┐ │
│                             │                             │ │
│                             │   Assistant Response        │ │
│                             │                             │ │
│                             └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

**Use case:** Side-by-side comparison, wide screens

#### Layout B: Prompt Right, Response Left

```
┌────────────────────────────────────────────────────────────┐
│                             ┌────────────────────────────┐ │
│                             │                            │ │
│                             │   User Prompt              │ │
│                             │                            │ │
│                             └────────────────────────────┘ │
│  ┌─────────────────────┐                                   │
│  │                     │                                   │
│  │  Assistant Response │                                   │
│  │                     │                                   │
│  └─────────────────────┘                                   │
└────────────────────────────────────────────────────────────┘
```

**Use case:** Response-focused view, RTL preference

#### Layout C: Prompt Left, Response Indented (Default)

```
┌─────────────────────────────────────────────────────────────┐
│  ┌─────────────────────────────────────────────────────────┐│
│  │ User Prompt                                             ││
│  └─────────────────────────────────────────────────────────┘│
│      ┌─────────────────────────────────────────────────────┐│
│      │ Assistant Response                                  ││
│      │                                                     ││
│      └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Use case:** Traditional chat view, narrow screens, conversation flow

### 4.2 Layout Configuration

```typescript
type LayoutType = 'prompt-left-response-right' | 'prompt-right-response-left' | 'prompt-left-response-indented';

interface LayoutConfig {
  layout: LayoutType;
  promptWidth?: string;        // CSS width (Layout A/B only)
  responseWidth?: string;      // CSS width (Layout A/B only)
  indentSize?: string;         // CSS margin (Layout C only, default: '2rem')
  gap?: string;                // Space between prompt/response
}
```

### 4.3 Responsive Behavior

| Screen Width | Default Behavior |
|--------------|------------------|
| ≥ 1200px | Use configured layout |
| 768px - 1199px | Side-by-side → Indented |
| < 768px | Always indented, full width |

---

## 5. Status Display

### 5.1 Completion Status (FR-7)

Display message status indicators based on `MessageStatus`.

| Status | Visual | Description |
|--------|--------|-------------|
| `pending` | ○ (empty circle) | Message created, not yet processing |
| `streaming` | ● (pulsing) | Actively receiving tokens |
| `complete` | ✓ (checkmark) | Successfully completed |
| `error` | ✕ (error icon) | Failed with error |

**Error Display:**
```
┌─────────────────────────────────────────────────────────────┐
│  ✕ Error                                                    │
│  ┌─────────────────────────────────────────────────────────┐│
│  │ Rate limit exceeded. Please try again in 30 seconds.   ││
│  └─────────────────────────────────────────────────────────┘│
│                                          [Retry] [Dismiss]  │
└─────────────────────────────────────────────────────────────┘
```

### 5.2 Real-Time Status Text (FR-9)

Display processing status during prompt execution.

**Status Flow (from StreamPhase):**

| Phase | Default Text | Example Custom |
|-------|--------------|----------------|
| `initializing` | "Initializing..." | — |
| `sending` | "Sending..." | — |
| `tool_call` | "Processing..." | "List folders", "Found 6 files" |
| `receiving` | "Receiving..." | — |
| `finalizing` | "Finalizing..." | — |
| `complete` | "Complete" | — |
| `error` | "Error" | "Rate limit exceeded" |

**Display:**
```
┌─────────────────────────────────────────────────────────────┐
│  User: "Read the config file and summarize it"              │
│                                                             │
│      ┌─────────────────────────────────────────────────────┐│
│      │ ○ Reading file...                                   ││
│      │ ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━ (spinner)            ││
│      └─────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

**Configuration:**
```typescript
interface StatusDisplayOptions {
  showSpinner: boolean;        // Animated spinner (default: true)
  showPhaseText: boolean;      // Show status message (default: true)
  position: 'top' | 'bottom' | 'inline';  // Where to show (default: 'top')
  hideOnComplete: boolean;     // Hide after completion (default: true)
  hideDelay: number;           // ms to wait before hiding (default: 1000)
}
```

---

## 6. Component Structure

### 6.1 Component Hierarchy

`ChatMessageDisplay` handles the layout of a prompt-response pair. `MessageDisplay` renders a single message (either prompt or response).

```
ChatMessageDisplay                    // Handles layout (FR-8)
├── layout: LayoutType                // Controls arrangement
├── MessageDisplay (prompt)           // User message
│   ├── MessageHeader
│   │   ├── RoleIndicator (user)
│   │   └── Timestamp
│   ├── MessageContent
│   │   └── PlainTextRenderer         // Prompts typically plain text
│   └── AttachmentList                // User-attached files
│       └── AttachmentThumbnail[]
│
└── MessageDisplay (response)         // Assistant message
    ├── MessageHeader
    │   ├── RoleIndicator (assistant)
    │   ├── ModelBadge
    │   ├── Timestamp
    │   └── StatusIndicator           // FR-7
    ├── MessageContent
    │   ├── PlainTextRenderer
    │   ├── MarkdownRenderer          // FR-2
    │   │   ├── CodeBlock             // FR-6
    │   │   ├── Table
    │   │   └── ImageEmbed
    │   ├── HtmlRenderer              // FR-3
    │   ├── SvgRenderer               // FR-4
    │   └── TableRenderer             // FR-5 (CSV/TSV)
    ├── MediaPlayers                  // See ui-threadpanel-message-media.md
    │   ├── ImageViewer
    │   ├── AudioPlayer
    │   └── VideoPlayer
    ├── StatusBar                     // FR-9
    │   ├── PhaseIndicator
    │   └── StatusMessage
    └── MessageActions
        ├── CopyButton
        ├── RegenerateButton
        └── FeedbackButtons
```

### 6.2 ChatMessageDisplay

Handles layout configuration and renders prompt-response pairs.

```typescript
interface ChatMessageDisplayProps {
  prompt: Message;
  response: Message | null;           // null if still streaming
  layout: LayoutConfig;
  
  // Shared options passed to both MessageDisplay components
  renderOptions?: RenderOptions;
  mediaOptions?: MediaOptions;
  
  // Response-specific
  streamPhase?: StreamPhase;
  statusMessage?: string;
  statusOptions?: StatusDisplayOptions;
  
  // Callbacks
  onRetry?: () => void;
  onRegenerate?: () => void;
}
```

### 6.3 Streaming Integration

`ChatMessageDisplay` receives real-time updates from `StreamManager` via IPC. See **system-thread-multiplexing.md** for full streaming architecture.

**StreamMessage Types Handled:**

| Type | Action | UI Update |
|------|--------|----------|
| `token` | Append to response content | Re-render MessageContent |
| `status` | Update phase and message | Update StatusBar |
| `tool_use` | Show tool activity | Display tool status in StatusBar |
| `complete` | Mark response complete | Hide spinner, show checkmark |
| `error` | Show error state | Display error message, show Retry |

**Tool Use Status Display:**

The `tool_use` message contains a `ToolNotification` with two stages:

| Stage | Payload | UI Display |
|-------|---------|------------|
| `start` | `{ title: "List folders" }` | ○ List folders (with spinner) |
| `complete` | `{ title: "List folders", result: "Found 6 folders and 12 files" }` | ○ Found 6 folders and 12 files |

```typescript
interface ToolNotification {
  stage: 'start' | 'complete';
  toolCallId: string;
  title?: string;     // Display name (e.g., "List folders")
  result?: string;    // Formatted result (e.g., "Found 6 files")
}
```

**Update Flow:**

```
StreamManager (main process)
    │
    │ IPC: 'chat:stream' { type, branchId, payload }
    ▼
ChatStreamService (renderer)
    │
    │ onUpdate(branchId, state)
    ▼
ChatMessageDisplay
    ├── Updates streamPhase, statusMessage
    ├── Appends tokens to response.content
    └── Re-renders MessageDisplay (response)
```

### 6.4 MessageDisplay

Renders a single message (prompt or response).

```typescript
interface MessageDisplayProps {
  message: Message;
  role: 'user' | 'assistant';
  
  // Content rendering
  renderOptions?: {
    markdown?: MarkdownConfig;
    codeBlock?: CodeBlockOptions;
    table?: TableDisplayOptions;
    svg?: SvgDisplayOptions;
  };
  
  // Status (for assistant messages)
  status?: MessageStatus;
  streamPhase?: StreamPhase;
  statusMessage?: string;
  statusOptions?: StatusDisplayOptions;
  
  // Callbacks
  onCopy?: (content: string) => void;
}
```

### 6.5 Role-Specific Rendering

| Feature | User (prompt) | Assistant (response) |
|---------|---------------|----------------------|
| Content rendering | Plain text | Markdown, HTML, SVG, Tables, Code |
| Attachments | ✓ Thumbnails | — |
| Media players | — | ✓ Image, Audio, Video |
| Status indicator | — | ✓ Complete/Error |
| Streaming status | — | ✓ Phase + message |
| Actions | — | ✓ Copy, Regenerate, Feedback |

### 6.6 State Management

```typescript
// ChatMessageDisplay state
interface ChatMessageDisplayState {
  layout: LayoutType;
}

// MessageDisplay state
interface MessageDisplayState {
  // Rendering
  renderedContent: string | null;
  renderError: string | null;
  
  // Status (response only)
  isStreaming: boolean;
  currentPhase: StreamPhase;
  currentStatusMessage: string;
}
```

---

## Appendix A: Content Type Detection

```typescript
function detectContentType(content: string, filename?: string): ContentType {
  // 1. Check filename extension
  if (filename) {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (['md', 'markdown'].includes(ext)) return 'markdown';
    if (['html', 'htm'].includes(ext)) return 'html';
    if (ext === 'svg') return 'svg';
    if (['csv', 'tsv'].includes(ext)) return 'table';
    // ... more extensions
  }
  
  // 2. Check content patterns
  if (content.trim().startsWith('<!DOCTYPE html') || content.trim().startsWith('<html')) {
    return 'html';
  }
  if (content.trim().startsWith('<svg')) {
    return 'svg';
  }
  if (looksLikeMarkdown(content)) {
    return 'markdown';
  }
  if (looksLikeTable(content)) {
    return 'table';
  }
  
  // 3. Default to plain text
  return 'plaintext';
}

type ContentType = 'plaintext' | 'markdown' | 'html' | 'svg' | 'table' | 'code';
```

---

## Appendix B: Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl+C` / `Cmd+C` | Copy selected text |
| `Ctrl+A` / `Cmd+A` | Select all in message |
| `Escape` | Close lightbox / fullscreen |

---

**End of Document**
