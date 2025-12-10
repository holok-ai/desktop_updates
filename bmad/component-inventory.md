# UI Component Inventory

## Overview

Holokai Desktop uses **Svelte 5** components organized into logical categories. The UI follows a dual-sidebar layout with TailwindCSS for styling.

## Component Structure

```
src/lib/components/
├── layout/              # App shell and navigation
├── common/              # Reusable shared components
├── modals/              # Dialog/modal components
├── projects/            # Project-specific components
├── threads/             # Thread-specific components
└── [feature].svelte     # Feature-specific components
```

## Layout Components

| Component | File | Purpose |
|-----------|------|---------|
| AppLayout | `layout/AppLayout.svelte` | Main app shell with sidebars |
| Header | `layout/Header.svelte` | Top navigation bar |
| Sidebar | `layout/Sidebar.svelte` | Primary navigation sidebar |
| ActivitySidebar | `layout/ActivitySidebar.svelte` | Secondary context sidebar |
| ActivityListSidebar | `layout/ActivityListSidebar.svelte` | List view in activity area |

## Common/Shared Components

| Component | File | Purpose |
|-----------|------|---------|
| AccordionSection | `common/AccordionSection.svelte` | Collapsible content section |
| CreatePageLayout | `common/CreatePageLayout.svelte` | Standardized create/edit page |
| ProjectListItem | `common/ProjectListItem.svelte` | Project entry in lists |
| SidebarItem | `common/SidebarItem.svelte` | Navigation item in sidebar |
| ThreadListItem | `common/ThreadListItem.svelte` | Thread entry in lists |

## Modal Components

| Component | File | Purpose |
|-----------|------|---------|
| BaseModal | `modals/BaseModal.svelte` | Base modal wrapper |
| DeleteProjectModal | `modals/DeleteProjectModal.svelte` | Project deletion confirmation |
| MoveThreadModal | `modals/MoveThreadModal.svelte` | Thread move to project |
| ProjectFormModal | `modals/ProjectFormModal.svelte` | Create/edit project form |

## Feature Components

### Chat/Messaging

| Component | File | Purpose |
|-----------|------|---------|
| ChatPane | `ChatPane.svelte` | Main chat conversation view |
| Composer | `Composer.svelte` | Message input with attachments |
| MessageBubble | `MessageBubble.svelte` | Individual message display |
| MessageVersionHistory | `MessageVersionHistory.svelte` | Message edit history |
| MarkdownRenderer | `MarkdownRenderer.svelte` | Markdown content display |

### File Handling

| Component | File | Purpose |
|-----------|------|---------|
| AttachmentPreview | `AttachmentPreview.svelte` | File attachment display |
| FilePreviewModal | `FilePreviewModal.svelte` | Full file preview modal |
| FileErrorBanner | `FileErrorBanner.svelte` | File error notifications |

### Projects & Threads

| Component | File | Purpose |
|-----------|------|---------|
| ProjectCreatePanel | `projects/ProjectCreatePanel.svelte` | New project form |
| ThreadCreatePanel | `threads/ThreadCreatePanel.svelte` | New thread form |
| ThreadTitleEditor | `ThreadTitleEditor.svelte` | Inline title editing |

### Other

| Component | File | Purpose |
|-----------|------|---------|
| ModelChooser | `ModelChooser.svelte` | AI model selection dropdown |
| NotFound | `NotFound.svelte` | 404 error page |

## Route Pages

```
src/routes/
├── +page.svelte           # Home/dashboard
├── login/+page.svelte     # Login/OAuth page
├── threads/+page.svelte   # Thread list & chat
├── projects/+page.svelte  # Project management
└── settings/+page.svelte  # App settings
```

## Component Patterns

### Props Pattern
```svelte
<script lang="ts">
  export let thread: Thread;
  export let isActive = false;
</script>
```

### Event Dispatch Pattern
```svelte
<script lang="ts">
  import { createEventDispatcher } from 'svelte';
  const dispatch = createEventDispatcher<{ select: Thread }>();
</script>

<button onclick={() => dispatch('select', thread)}>
```

### Store Subscription
```svelte
<script lang="ts">
  import { threads } from '$lib/stores/thread.store';
</script>

{#each $threads as thread}
  <ThreadListItem {thread} />
{/each}
```

## Styling Approach

- **TailwindCSS** for utility-first styling
- **Dark mode** via `selector` strategy (`tailwind.config.js`)
- **Theme service** for dynamic theme switching
- Component-scoped styles when needed via `<style>` blocks

## Design System Elements

- **Icons**: PrimeIcons (`primeicons` package)
- **Fonts**: System fonts via Tailwind defaults
- **Colors**: Custom palette (dark theme focused)
- **Spacing**: Tailwind spacing scale

## Component Count Summary

| Category | Count |
|----------|-------|
| Layout | 5 |
| Common | 5 |
| Modals | 4 |
| Chat/Messaging | 5 |
| File Handling | 3 |
| Projects & Threads | 3 |
| Other | 2 |
| **Total** | **27** |
