# Dual Sidebar Implementation Guide

## Holokai Desktop Application

### Table of Contents

1. [Design Goals & Objectives](#design-goals--objectives)
2. [Architecture Overview](#architecture-overview)
3. [Component Structure](#component-structure)
4. [Styling Strategy](#styling-strategy)
5. [Implementation Details](#implementation-details)
6. [Code Samples](#code-samples)
7. [Integration Notes](#integration-notes)

---

## Design Goals & Objectives

### Primary Objectives

The Holokai Desktop application extends the existing Moku web application with a desktop-optimized dual sidebar layout that provides:

1. **Enhanced Navigation Hierarchy**
   - Primary sidebar for high-level activities (Agents, Projects, Threads)
   - Secondary sidebar for activity-specific content lists
   - Main content area for detailed views

2. **Desktop-Optimized UX**
   - Leverage larger screen real estate effectively
   - Persistent navigation state across sessions
   - Keyboard shortcuts and desktop-specific interactions

3. **Design Consistency**
   - Maintain visual consistency with existing Moku web application
   - Reuse design tokens, color schemes, and component patterns
   - Dark theme optimized for extended desktop use

### User Experience Goals

- **Efficient Navigation**: Users can quickly switch between different activities and their sub-items
- **Contextual Organization**: Related content is grouped and easily accessible
- **Progressive Disclosure**: Collapsible sidebars allow users to focus on content when needed
- **Visual Hierarchy**: Clear distinction between activity types, active states, and content levels

---

## Architecture Overview

### Layout Structure

```
┌─────────────────────────────────────────────────────┐
│                    App Container                      │
├──────┬──────────────┬────────────────────────────────┤
│      │              │                                │
│  A   │      B       │            C                   │
│  C   │              │                                │
│  T   │   Activity   │                                │
│  I   │     List     │      Main Content Area         │
│  V   │   Sidebar    │                                │
│  I   │              │                                │
│  T   │  (Secondary) │                                │
│  Y   │              │                                │
│      │              │                                │
│ (Pri)│              │                                │
└──────┴──────────────┴────────────────────────────────┘

A: Primary Activity Sidebar (64px collapsed / 240px expanded)
B: Secondary Activity List Sidebar (48px collapsed / 280px expanded)
C: Main Content Area (flexible width)
```

### Component Hierarchy

```typescript
AppLayout
├── ActivitySidebar (Primary)
│   ├── OrganizationSelector
│   ├── PrimaryActions
│   │   ├── NewThreadButton
│   │   └── SearchInput
│   ├── NavigationItems
│   │   └── ActivityItem[]
│   └── SidebarFooter
│       └── CollapseToggle
│
├── ActivityListSidebar (Secondary)
│   ├── ListHeader
│   │   ├── ActivityTitle
│   │   └── CollapseToggle
│   └── ThreadAccordion
│       └── ThreadGroup[]
│           └── ThreadItem[]
│
└── MainContent
    └── <router-outlet>
```

---

## Component Structure

### Core Components

#### 1. AppLayout Component

The root layout component that orchestrates the dual sidebar structure.

**Responsibilities:**

- Manages overall layout grid
- Coordinates sidebar state
- Handles responsive behavior
- Routes navigation events

#### 2. ActivitySidebar Component (Primary)

Left-most sidebar showing high-level activities.

**Features:**

- Organization/workspace selector
- Global actions (New Thread, Search)
- Activity navigation items with badges
- Collapsible with icon-only mode
- Persistent state storage

#### 3. ActivityListSidebar Component (Secondary)

Context-specific content list based on selected activity.

**Features:**

- Dynamic content based on selected activity
- Grouped/accordion view for content organization
- Thread/item preview information
- Quick access to recent items
- Collapsible to save space

#### 4. State Management Service

Centralized state management for sidebar coordination.

**Manages:**

- Collapse/expand states
- Selected activity and thread
- Navigation history
- Local storage persistence

---

## Styling Strategy

### Design System Integration

The implementation leverages the existing Moku design system with desktop-specific enhancements:

#### Color Palette (Dark Theme)

```css
/* Core surfaces - matching Figma dark mode */
--surface-sidebar-primary: #111827; /* gray-900 */
--surface-sidebar-secondary: #0f172a; /* gray-900/95 */
--surface-main: #030712; /* gray-950 */
--surface-card: #1f2937; /* gray-800 */
--surface-hover: rgba(59, 130, 246, 0.1);
--border-sidebar: #1f2937; /* gray-800 */
--border-active: #3b82f6; /* blue-500 */

/* Text colors */
--text-primary: #f9fafb; /* gray-50 */
--text-secondary: #9ca3af; /* gray-400 */
--text-muted: #6b7280; /* gray-500 */
```

#### Spacing & Dimensions

```css
/* Sidebar dimensions */
--sidebar-primary-width: 64px;
--sidebar-primary-expanded: 240px;
--sidebar-secondary-width: 280px;
--sidebar-secondary-collapsed: 48px;

/* Consistent spacing using Tailwind/PrimeNG patterns */
--spacing-xs: 0.25rem; /* 4px */
--spacing-sm: 0.5rem; /* 8px */
--spacing-md: 1rem; /* 16px */
--spacing-lg: 1.5rem; /* 24px */
--spacing-xl: 2rem; /* 32px */
```

### PrimeNG Component Customization

#### Components Used

- **p-accordion**: Thread grouping in secondary sidebar
- **p-button**: Action buttons and toggles
- **p-inputtext**: Search functionality
- **p-tooltip**: Collapsed state hints
- **p-avatar**: User profile display
- **pRipple**: Material Design interactions
- **p-badge**: Notification counts

#### Tailwind CSS Integration

- Utility-first approach for layout and spacing
- Custom classes for complex component states
- Responsive modifiers for breakpoint handling
- Dark mode variants using Tailwind's dark: prefix

---

## Implementation Details

### State Management Pattern

```typescript
// Centralized sidebar state management
interface SidebarState {
  primaryCollapsed: boolean;
  secondaryCollapsed: boolean;
  selectedActivity: ActivityItem | null;
  selectedThread: Thread | null;
  searchQuery: string;
  threadGroups: ThreadGroup[];
}
```

### Navigation Flow

1. User clicks activity in primary sidebar
2. Secondary sidebar loads relevant content
3. Thread selection updates main content area
4. State persists to localStorage
5. Deep linking support for direct navigation

### Responsive Behavior

```typescript
// Window size thresholds
const BREAKPOINTS = {
  minimum: 800, // Below this, switch to mobile layout
  comfortable: 1280, // Both sidebars expanded
  optimal: 1920, // Full desktop experience
};
```

---

## Code Samples

### 1. Main Layout Component

```typescript
// app-layout.component.ts
import { Component, OnInit } from '@angular/core';
import { SidebarStateService } from './services/sidebar-state.service';

@Component({
  selector: 'app-layout',
  template: `
    <div class="flex h-screen w-[100vw] overflow-hidden bg-gray-950">
      <!-- Primary Activity Sidebar (Left) -->
      <div class="activity-sidebar bg-gray-900 border-r border-gray-800">
        <app-activity-sidebar
          [collapsed]="primarySidebarCollapsed"
          (activitySelected)="onActivitySelected($event)"
          (toggle)="togglePrimarySidebar()"
        >
        </app-activity-sidebar>
      </div>

      <!-- Secondary Activity List Sidebar (Middle) -->
      <div
        class="activity-list-sidebar bg-gray-900/95 border-r border-gray-800"
        [class.hidden]="!selectedActivity"
      >
        <app-activity-list
          [activity]="selectedActivity"
          [collapsed]="secondarySidebarCollapsed"
          (itemSelected)="onItemSelected($event)"
          (toggle)="toggleSecondarySidebar()"
        >
        </app-activity-list>
      </div>

      <!-- Main Content Area -->
      <div class="flex-1 flex flex-col bg-gray-950">
        <main class="flex-1 overflow-y-auto">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styleUrls: ['./app-layout.component.css'],
})
export class AppLayoutComponent implements OnInit {
  primarySidebarCollapsed = false;
  secondarySidebarCollapsed = false;
  selectedActivity: ActivityItem | null = null;

  constructor(private sidebarState: SidebarStateService) {}

  ngOnInit() {
    this.sidebarState.loadState();
    this.subscribeToStateChanges();
  }

  onActivitySelected(activity: ActivityItem) {
    this.selectedActivity = activity;
    this.sidebarState.setSelectedActivity(activity);
    // Load activity-specific content
    this.loadActivityContent(activity);
  }

  onItemSelected(item: any) {
    // Navigate to item detail view
    this.router.navigate(['/activity', this.selectedActivity.id, 'item', item.id]);
  }

  togglePrimarySidebar() {
    this.primarySidebarCollapsed = !this.primarySidebarCollapsed;
    this.sidebarState.setPrimaryCollapsed(this.primarySidebarCollapsed);
  }

  toggleSecondarySidebar() {
    this.secondarySidebarCollapsed = !this.secondarySidebarCollapsed;
    this.sidebarState.setSecondaryCollapsed(this.secondarySidebarCollapsed);
  }

  private loadActivityContent(activity: ActivityItem) {
    // Implementation depends on activity type
    // Load threads, agents, projects, etc.
  }

  private subscribeToStateChanges() {
    // Subscribe to state changes from service
  }
}
```

### 2. Activity Sidebar Component (Primary)

```typescript
// activity-sidebar.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

interface ActivityItem {
  id: string;
  label: string;
  icon: string;
  route?: string;
  badge?: number;
  children?: ThreadGroup[];
}

interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
}

@Component({
  selector: 'app-activity-sidebar',
  template: `
    <nav class="activity-nav" [class.collapsed]="collapsed">
      <!-- Header with Logo/Org -->
      <div class="sidebar-header">
        <div class="org-selector" (click)="toggleOrgMenu()">
          <span class="org-icon">
            <i class="pi pi-building"></i>
          </span>
          <span class="org-name" *ngIf="!collapsed">
            {{ organizationName }}
          </span>
          <i class="pi pi-chevron-down ml-auto" *ngIf="!collapsed"></i>
        </div>
      </div>

      <!-- Primary Actions -->
      <div class="primary-actions">
        <button
          pButton
          class="p-button-text action-button"
          icon="pi pi-plus"
          [pTooltip]="'New Thread'"
          tooltipPosition="right"
          (click)="createNewThread()"
        >
          <span *ngIf="!collapsed">New Thread</span>
        </button>

        <div class="search-container" *ngIf="!collapsed">
          <span class="p-input-icon-left w-full">
            <i class="pi pi-search"></i>
            <input
              pInputText
              type="text"
              placeholder="Search Threads"
              class="w-full search-input"
              [(ngModel)]="searchQuery"
            />
          </span>
        </div>
      </div>

      <!-- Navigation Items with Badges -->
      <div class="nav-items">
        <div
          *ngFor="let item of activities"
          class="nav-item"
          [class.active]="item.id === selectedActivity?.id"
          (click)="selectActivity(item)"
          pRipple
        >
          <i [class]="item.icon + ' nav-icon'"></i>
          <span class="nav-label" *ngIf="!collapsed">{{ item.label }}</span>
          <span class="badge" *ngIf="item.badge && !collapsed">
            {{ item.badge }}
          </span>
        </div>
      </div>

      <!-- Collapse Toggle -->
      <div class="sidebar-footer">
        <button
          pButton
          class="p-button-text collapse-btn"
          [icon]="collapsed ? 'pi pi-angle-double-right' : 'pi pi-angle-double-left'"
          (click)="toggleCollapse()"
        ></button>
      </div>
    </nav>
  `,
  styleUrls: ['./activity-sidebar.component.css'],
})
export class ActivitySidebarComponent {
  @Input() collapsed = false;
  @Input() selectedActivity: ActivityItem | null = null;
  @Output() activitySelected = new EventEmitter<ActivityItem>();
  @Output() toggle = new EventEmitter<void>();

  organizationName = 'Holokai Organization';
  searchQuery = '';

  activities: ActivityItem[] = [
    {
      id: 'home',
      label: 'Home',
      icon: 'pi pi-home',
      route: '/home',
    },
    {
      id: 'threads',
      label: 'Threads',
      icon: 'pi pi-comments',
      route: '/threads',
      badge: 12,
    },
    {
      id: 'agents',
      label: 'Agents',
      icon: 'pi pi-robot',
      route: '/agents',
      badge: 3,
    },
    {
      id: 'projects',
      label: 'Projects',
      icon: 'pi pi-folder',
      route: '/projects',
    },
    {
      id: 'activity',
      label: 'Activity',
      icon: 'pi pi-chart-line',
      route: '/activity',
    },
    {
      id: 'profile',
      label: 'Profile',
      icon: 'pi pi-user',
      route: '/profile',
    },
  ];

  selectActivity(activity: ActivityItem) {
    this.activitySelected.emit(activity);
  }

  toggleCollapse() {
    this.toggle.emit();
  }

  createNewThread() {
    // Implement new thread creation
    console.log('Creating new thread...');
  }

  toggleOrgMenu() {
    // Implement organization menu toggle
    console.log('Toggling organization menu...');
  }
}
```

### 3. Activity Sidebar Styles

```css
/* activity-sidebar.component.css */
.activity-nav {
  width: var(--sidebar-primary-expanded);
  height: 100vh;
  display: flex;
  flex-direction: column;
  background: var(--surface-sidebar-primary);
  transition: width 0.3s ease;
  padding: 1rem;
}

.activity-nav.collapsed {
  width: var(--sidebar-primary-width);
  padding: 0.5rem;
}

/* Organization Selector */
.org-selector {
  @apply flex items-center gap-3 p-3 rounded-lg cursor-pointer;
  @apply hover:bg-gray-800 transition-colors;
  border: 1px solid transparent;
}

.org-selector:hover {
  border-color: var(--border-active);
}

.org-icon {
  @apply text-blue-500 text-xl;
}

.org-name {
  @apply text-white font-medium text-sm;
  @apply truncate flex-1;
}

/* Primary Actions */
.primary-actions {
  @apply mt-4 space-y-2;
}

.action-button {
  @apply w-full justify-start text-left;
  @apply bg-blue-600 hover:bg-blue-700 text-white;
  @apply rounded-lg px-3 py-2;
}

.collapsed .action-button {
  @apply justify-center px-2;
}

/* Search Input */
.search-input {
  @apply bg-gray-800 border-gray-700 text-gray-100;
  @apply placeholder-gray-500 focus:border-blue-500;
  @apply rounded-lg text-sm;
}

/* Navigation Items */
.nav-items {
  @apply flex-1 mt-4 space-y-1 overflow-y-auto;
}

.nav-item {
  @apply flex items-center gap-3 px-3 py-2 rounded-lg;
  @apply cursor-pointer transition-all duration-200;
  @apply hover:bg-gray-800/50 text-gray-400;
  position: relative;
}

.nav-item.active {
  @apply bg-gray-800 text-white;
  border-left: 3px solid var(--border-active);
}

.nav-icon {
  @apply text-xl min-w-[1.25rem];
}

.nav-label {
  @apply text-sm font-normal truncate;
}

.badge {
  @apply ml-auto bg-blue-600 text-white text-xs;
  @apply px-2 py-0.5 rounded-full font-medium;
}

/* Collapsed State Adjustments */
.collapsed .nav-label,
.collapsed .org-name,
.collapsed .search-container,
.collapsed .badge {
  display: none;
}

.collapsed .nav-item {
  @apply justify-center px-2;
}

.collapsed .nav-item.active {
  border-left: none;
  border-bottom: 2px solid var(--border-active);
}

/* Sidebar Footer */
.sidebar-footer {
  @apply mt-auto pt-4 border-t border-gray-800;
}

.collapse-btn {
  @apply w-full text-gray-400 hover:text-white;
  @apply justify-center;
}

/* Custom Scrollbar */
.nav-items::-webkit-scrollbar {
  width: 6px;
}

.nav-items::-webkit-scrollbar-track {
  background: transparent;
}

.nav-items::-webkit-scrollbar-thumb {
  @apply bg-gray-700 rounded-full;
}

.nav-items::-webkit-scrollbar-thumb:hover {
  @apply bg-gray-600;
}
```

### 4. Activity List Sidebar Component (Secondary)

```typescript
// activity-list-sidebar.component.ts
import { Component, Input, Output, EventEmitter } from '@angular/core';

interface Thread {
  id: string;
  title: string;
  lastMessage: string;
  timestamp: Date;
  unread?: boolean;
}

interface ThreadGroup {
  id: string;
  label: string;
  threads: Thread[];
  expanded?: boolean;
}

@Component({
  selector: 'app-activity-list',
  template: `
    <div class="list-sidebar" [class.collapsed]="collapsed">
      <!-- Header -->
      <div class="list-header">
        <h3 class="header-title" *ngIf="!collapsed">
          {{ activity?.label }}
        </h3>
        <button
          pButton
          class="p-button-text p-button-sm collapse-toggle"
          [icon]="collapsed ? 'pi pi-angle-right' : 'pi pi-angle-left'"
          (click)="toggleCollapse()"
        ></button>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions" *ngIf="!collapsed">
        <button
          pButton
          class="p-button-text p-button-sm"
          icon="pi pi-filter"
          label="Filter"
        ></button>
        <button
          pButton
          class="p-button-text p-button-sm"
          icon="pi pi-sort-alt"
          label="Sort"
        ></button>
      </div>

      <!-- Grouped Thread List -->
      <p-accordion
        [multiple]="true"
        [activeIndex]="activeIndices"
        styleClass="thread-accordion"
        *ngIf="!collapsed"
      >
        <p-accordionTab *ngFor="let group of threadGroups; let i = index">
          <ng-template pTemplate="header">
            <span class="group-header">
              <i class="pi pi-folder text-sm"></i>
              <span class="group-label">{{ group.label }}</span>
              <span class="thread-count">{{ group.threads.length }}</span>
            </span>
          </ng-template>

          <div class="thread-list">
            <div
              *ngFor="let thread of group.threads"
              class="thread-item"
              [class.active]="thread.id === selectedThreadId"
              [class.unread]="thread.unread"
              (click)="selectThread(thread)"
              pRipple
            >
              <div class="thread-content">
                <span class="thread-title">{{ thread.title }}</span>
                <span class="thread-preview">{{ thread.lastMessage }}</span>
                <span class="thread-meta">
                  {{ thread.timestamp | date: 'short' }}
                </span>
              </div>
              <div class="thread-indicator" *ngIf="thread.unread"></div>
            </div>
          </div>
        </p-accordionTab>
      </p-accordion>

      <!-- Collapsed State - Icon Grid -->
      <div class="collapsed-content" *ngIf="collapsed">
        <div
          *ngFor="let group of threadGroups"
          class="collapsed-group"
          [pTooltip]="group.label"
          tooltipPosition="right"
        >
          <i class="pi pi-folder"></i>
          <span class="collapsed-count">{{ group.threads.length }}</span>
        </div>
      </div>
    </div>
  `,
  styleUrls: ['./activity-list-sidebar.component.css'],
})
export class ActivityListSidebarComponent {
  @Input() activity: ActivityItem | null = null;
  @Input() collapsed = false;
  @Output() itemSelected = new EventEmitter<Thread>();
  @Output() toggle = new EventEmitter<void>();

  selectedThreadId: string | null = null;
  activeIndices: number[] = [0, 1]; // Expand first two groups by default

  threadGroups: ThreadGroup[] = [
    {
      id: 'recent',
      label: 'Recent',
      threads: [
        {
          id: 't1',
          title: 'How to improve team collaboration',
          lastMessage: 'Here are some strategies for better team communication...',
          timestamp: new Date(),
          unread: true,
        },
        {
          id: 't2',
          title: 'Effective remote work strategies',
          lastMessage: 'Working from home can be challenging but...',
          timestamp: new Date(Date.now() - 3600000),
        },
      ],
    },
    {
      id: 'pinned',
      label: 'Pinned',
      threads: [
        {
          id: 't3',
          title: 'Best practices for project management',
          lastMessage: 'Project management requires careful planning...',
          timestamp: new Date(Date.now() - 86400000),
        },
      ],
    },
    {
      id: 'archived',
      label: 'Archived',
      threads: [],
    },
  ];

  selectThread(thread: Thread) {
    this.selectedThreadId = thread.id;
    this.itemSelected.emit(thread);
  }

  toggleCollapse() {
    this.toggle.emit();
  }
}
```

### 5. Activity List Sidebar Styles

```css
/* activity-list-sidebar.component.css */
.list-sidebar {
  width: var(--sidebar-secondary-width);
  height: 100vh;
  background: var(--surface-sidebar-secondary);
  display: flex;
  flex-direction: column;
  transition: width 0.3s ease;
  overflow: hidden;
}

.list-sidebar.collapsed {
  width: var(--sidebar-secondary-collapsed);
}

/* Header */
.list-header {
  @apply flex items-center justify-between p-4;
  @apply border-b border-gray-800;
  min-height: 60px;
}

.header-title {
  @apply text-lg font-medium text-white;
}

.collapse-toggle {
  @apply text-gray-400 hover:text-white;
}

/* Quick Actions */
.quick-actions {
  @apply flex gap-2 px-4 py-2;
  @apply border-b border-gray-800/50;
}

.quick-actions button {
  @apply text-xs text-gray-400 hover:text-white;
}

/* PrimeNG Accordion Customization */
::ng-deep .thread-accordion {
  @apply flex-1 overflow-y-auto;

  .p-accordion-header {
    @apply bg-transparent border-0;

    .p-accordion-header-link {
      @apply bg-gray-800/30 hover:bg-gray-800/50;
      @apply text-gray-300 border-0 rounded-lg;
      @apply px-3 py-2 mx-2 my-1;
    }

    .p-accordion-header-link:focus {
      box-shadow: 0 0 0 2px var(--border-active);
    }
  }

  .p-accordion-content {
    @apply bg-transparent border-0 p-0;
  }

  .p-accordion-toggle-icon {
    @apply text-gray-500;
  }
}

/* Group Header */
.group-header {
  @apply flex items-center gap-2 w-full text-sm;
}

.group-label {
  @apply flex-1 font-medium;
}

.thread-count {
  @apply text-xs text-gray-500;
  @apply bg-gray-800 px-1.5 py-0.5 rounded-full;
}

/* Thread List */
.thread-list {
  @apply py-1 px-2;
}

.thread-item {
  @apply relative px-3 py-2.5 mx-1 my-1 rounded-lg cursor-pointer;
  @apply hover:bg-gray-800/50 transition-colors;
  @apply border-l-2 border-transparent;
}

.thread-item.active {
  @apply bg-blue-600/20;
  border-left-color: var(--border-active);
}

.thread-item.unread {
  @apply bg-gray-800/30;
}

/* Thread Content */
.thread-content {
  @apply flex flex-col gap-1;
}

.thread-title {
  @apply text-sm font-medium text-gray-200;
  @apply truncate;
}

.thread-preview {
  @apply text-xs text-gray-500;
  @apply truncate;
}

.thread-meta {
  @apply text-xs text-gray-600;
  @apply mt-1;
}

/* Unread Indicator */
.thread-indicator {
  @apply absolute right-3 top-3;
  @apply w-2 h-2 bg-blue-500 rounded-full;
}

/* Collapsed State */
.collapsed-content {
  @apply flex flex-col items-center py-4 gap-4;
  @apply overflow-y-auto;
}

.collapsed-group {
  @apply relative cursor-pointer;
  @apply text-gray-400 hover:text-white;
  @apply p-2 rounded-lg hover:bg-gray-800/50;
}

.collapsed-count {
  @apply absolute -top-1 -right-1;
  @apply bg-blue-600 text-white text-xs;
  @apply w-5 h-5 rounded-full;
  @apply flex items-center justify-center;
  font-size: 10px;
}

/* Scrollbar Styling */
.thread-accordion::-webkit-scrollbar,
.collapsed-content::-webkit-scrollbar {
  width: 6px;
}

.thread-accordion::-webkit-scrollbar-thumb,
.collapsed-content::-webkit-scrollbar-thumb {
  @apply bg-gray-700 rounded-full;
}
```

### 6. State Management Service

```typescript
// services/sidebar-state.service.ts
import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';

interface SidebarState {
  primaryCollapsed: boolean;
  secondaryCollapsed: boolean;
  selectedActivityId: string | null;
  selectedThreadId: string | null;
  searchQuery: string;
}

@Injectable({ providedIn: 'root' })
export class SidebarStateService {
  private readonly STORAGE_KEY = 'holokai-sidebar-state';

  private state$ = new BehaviorSubject<SidebarState>({
    primaryCollapsed: false,
    secondaryCollapsed: false,
    selectedActivityId: null,
    selectedThreadId: null,
    searchQuery: '',
  });

  constructor() {
    this.loadState();
    this.setupAutoSave();
  }

  // Observable getters
  get primaryCollapsed$(): Observable<boolean> {
    return new Observable((observer) => {
      this.state$.subscribe((state) => observer.next(state.primaryCollapsed));
    });
  }

  get secondaryCollapsed$(): Observable<boolean> {
    return new Observable((observer) => {
      this.state$.subscribe((state) => observer.next(state.secondaryCollapsed));
    });
  }

  // Setters
  setPrimaryCollapsed(collapsed: boolean): void {
    this.updateState({ primaryCollapsed: collapsed });
  }

  setSecondaryCollapsed(collapsed: boolean): void {
    this.updateState({ secondaryCollapsed: collapsed });
  }

  setSelectedActivity(activityId: string | null): void {
    this.updateState({
      selectedActivityId: activityId,
      selectedThreadId: null, // Reset thread when activity changes
    });
  }

  setSelectedThread(threadId: string | null): void {
    this.updateState({ selectedThreadId: threadId });
  }

  setSearchQuery(query: string): void {
    this.updateState({ searchQuery: query });
  }

  // State management
  private updateState(partial: Partial<SidebarState>): void {
    const currentState = this.state$.value;
    const newState = { ...currentState, ...partial };
    this.state$.next(newState);
  }

  private loadState(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const state = JSON.parse(stored) as SidebarState;
        this.state$.next(state);
      }
    } catch (error) {
      console.error('Failed to load sidebar state:', error);
    }
  }

  private saveState(): void {
    try {
      const state = this.state$.value;
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.error('Failed to save sidebar state:', error);
    }
  }

  private setupAutoSave(): void {
    // Auto-save state changes with debouncing
    this.state$.pipe(debounceTime(500)).subscribe(() => {
      this.saveState();
    });
  }

  // Reset state
  resetState(): void {
    const defaultState: SidebarState = {
      primaryCollapsed: false,
      secondaryCollapsed: false,
      selectedActivityId: null,
      selectedThreadId: null,
      searchQuery: '',
    };
    this.state$.next(defaultState);
    localStorage.removeItem(this.STORAGE_KEY);
  }
}
```

### 7. Design Tokens Extension

```css
/* styles/tokens-desktop.css */
/* Desktop-specific design tokens extending the base Moku tokens */

:root {
  /* Sidebar Dimensions */
  --sidebar-primary-width: 64px;
  --sidebar-primary-expanded: 240px;
  --sidebar-secondary-width: 280px;
  --sidebar-secondary-collapsed: 48px;

  /* Dark Theme Surfaces */
  --surface-sidebar-primary: #111827; /* gray-900 */
  --surface-sidebar-secondary: #0f172af2; /* gray-900 with 95% opacity */
  --surface-main: #030712; /* gray-950 */
  --surface-card: #1f2937; /* gray-800 */
  --surface-hover: rgba(59, 130, 246, 0.1);

  /* Borders */
  --border-sidebar: #1f2937; /* gray-800 */
  --border-active: #3b82f6; /* blue-500 */
  --border-focus: #60a5fa; /* blue-400 */

  /* Text Colors */
  --text-primary: #f9fafb; /* gray-50 */
  --text-secondary: #9ca3af; /* gray-400 */
  --text-muted: #6b7280; /* gray-500 */
  --text-disabled: #4b5563; /* gray-600 */

  /* Accent Colors */
  --accent-primary: #3b82f6; /* blue-500 */
  --accent-hover: #2563eb; /* blue-600 */
  --accent-active: #1d4ed8; /* blue-700 */

  /* Spacing Scale */
  --spacing-xs: 0.25rem; /* 4px */
  --spacing-sm: 0.5rem; /* 8px */
  --spacing-md: 1rem; /* 16px */
  --spacing-lg: 1.5rem; /* 24px */
  --spacing-xl: 2rem; /* 32px */

  /* Animation */
  --transition-fast: 150ms;
  --transition-base: 300ms;
  --transition-slow: 500ms;

  /* Z-Index Layers */
  --z-dropdown: 100;
  --z-sidebar: 200;
  --z-modal: 300;
  --z-tooltip: 400;
}

/* Dark mode adjustments */
.dark {
  color-scheme: dark;
}
```

---

## Integration Notes

### PrimeNG Configuration

Ensure these PrimeNG modules are imported in your module:

```typescript
import { AccordionModule } from 'primeng/accordion';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TooltipModule } from 'primeng/tooltip';
import { AvatarModule } from 'primeng/avatar';
import { RippleModule } from 'primeng/ripple';
import { BadgeModule } from 'primeng/badge';
```

### Tailwind Configuration

Add to your `tailwind.config.js`:

```javascript
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Import your existing color tokens
      },
      animation: {
        'slide-in': 'slideIn 300ms ease-out',
        'slide-out': 'slideOut 300ms ease-in',
      },
    },
  },
  plugins: [require('tailwindcss-primeui')],
};
```

### Electron Integration

For Electron main process window configuration:

```javascript
// main.js
const { BrowserWindow } = require('electron');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1400, // Comfortable width for dual sidebars
    height: 900,
    minWidth: 800, // Minimum to maintain usability
    minHeight: 600,
    webPreferences: {
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  // Handle window state persistence
  mainWindow.on('resize', () => {
    mainWindow.webContents.send('window-resized', mainWindow.getSize());
  });
}
```

### Keyboard Shortcuts

Implement desktop-specific keyboard shortcuts:

```typescript
// keyboard-shortcuts.service.ts
@Injectable({ providedIn: 'root' })
export class KeyboardShortcutsService {
  shortcuts = {
    'cmd+k': () => this.openCommandPalette(),
    'cmd+b': () => this.togglePrimarySidebar(),
    'cmd+shift+b': () => this.toggleSecondarySidebar(),
    'cmd+n': () => this.createNewThread(),
    'cmd+/': () => this.focusSearch(),
    'cmd+1-9': (num: number) => this.navigateToActivity(num),
  };
}
```

---

## Testing Checklist

- [ ] Primary sidebar collapse/expand animation
- [ ] Secondary sidebar conditional display
- [ ] Activity selection and content loading
- [ ] Thread/item selection and navigation
- [ ] Search functionality
- [ ] Badge updates for notifications
- [ ] Keyboard navigation
- [ ] State persistence across sessions
- [ ] Window resize handling
- [ ] Dark theme consistency
- [ ] PrimeNG component theming
- [ ] Scrollbar styling
- [ ] Focus states for accessibility
- [ ] Tooltip display in collapsed states
- [ ] Organization/workspace switching

---

## Performance Considerations

1. **Virtual Scrolling**: For large thread lists, implement virtual scrolling
2. **Lazy Loading**: Load activity content on-demand
3. **State Debouncing**: Debounce state saves to localStorage
4. **Animation Performance**: Use CSS transforms for smooth animations
5. **Memory Management**: Clear unused activity data when switching contexts

---

## Accessibility Requirements

- ARIA labels for all interactive elements
- Keyboard navigation support (Tab, Arrow keys)
- Focus management when toggling sidebars
- Screen reader announcements for state changes
- High contrast mode support
- Reduced motion preferences

---

## Next Steps

1. Implement base components following this guide
2. Add activity-specific content loaders
3. Integrate with existing Moku API services
4. Add keyboard shortcut system
5. Implement notification/badge system
6. Add user preference persistence
7. Create unit and integration tests
8. Document API interfaces for consultants
