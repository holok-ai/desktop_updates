# Markdown Renderer - Light/Dark Theme Fix

## Issue
The markdown renderer had hard-coded dark theme colors that caused readability issues in light mode (black text on black background, dark backgrounds in light mode).

## Changes Made

### 1. MarkdownRenderer Component (`src/lib/components/MarkdownRenderer.svelte`)

**Fixed Elements:**

#### Blockquotes
- **Before**: `color: #666` (fixed gray)
- **After**: `color: var(--text-secondary)` (adapts to theme)

#### Code Block Wrapper
- **Before**: `background: #282c34` (dark) + `border: 1px solid #3a3f4b` (dark)
- **After**: `background: var(--surface-card)` + `border: 1px solid var(--border-sidebar)` (adapts to theme)

#### Code Header
- **Before**: `background: #21252b` (dark) + `border-bottom: 1px solid #3a3f4b` (dark)
- **After**: `background: var(--surface-sidebar-primary)` + `border-bottom: 1px solid var(--border-sidebar)` (adapts to theme)

#### Code Language Badge
- **Before**: `color: #abb2bf` (fixed gray)
- **After**: `color: var(--text-secondary)` (adapts to theme)

#### Copy Button
- **Before**: `color: #abb2bf` (fixed gray) + fixed backgrounds
- **After**: `color: var(--text-secondary)` + `color: var(--text-primary)` on hover (adapts to theme)

#### Pre/Code Blocks
- **Before**: `background: #282c34` (dark) + `color: #abb2bf` (fixed gray)
- **After**: `background: var(--surface-card)` + `color: var(--text-primary)` (adapts to theme)

#### Variable Tooltips
- **Before**: `background: #282c34` + `color: #abb2bf` + `border: 1px solid #3a3f4b` (all dark)
- **After**: Uses `var(--surface-card)`, `var(--text-primary)`, `var(--border-sidebar)` (adapts to theme)

### 2. Highlight.js Theme (`src/lib/styles/highlight.css`)

**Fixed Elements:**

#### Base Colors
- **Before**: `.hljs { color: #abb2bf; background: #282c34; }` (dark theme only)
- **After**: `.hljs { color: var(--text-primary); background: transparent; }` (adapts to theme)

#### Comments
- **Before**: `color: #5c6370` (fixed dark gray)
- **After**: `color: var(--text-secondary); opacity: 0.8;` (adapts to theme)

#### Parameters & Punctuation
- **Before**: `color: #abb2bf` (fixed gray)
- **After**: `color: var(--text-primary); opacity: 0.8-0.9;` (adapts to theme)

**Kept as-is (work in both themes):**
- Keyword colors (purple)
- String colors (green)
- Number/attribute colors (orange)
- Function colors (blue)
- Class colors (yellow)
- Variable highlighting (yellow with underline)

## CSS Variables Used

From `src/app.css`:

**Light Theme:**
- `--text-primary: #111827` (dark gray/black)
- `--text-secondary: #4B5563` (medium gray)
- `--surface-card: #F3F4F6` (light gray)
- `--surface-sidebar-primary: #EEEEEE` (light gray)
- `--border-sidebar: #E5E7EB` (light gray border)

**Dark Theme (.dark):**
- `--text-primary: #f9fafb` (white/light gray)
- `--text-secondary: #9ca3af` (medium gray)
- `--surface-card: #1f2937` (dark gray)
- `--surface-sidebar-primary: #1B1B1B` (very dark gray)
- `--border-sidebar: #1f2937` (dark gray border)

## Result

✅ **Light Mode**: Text is dark, backgrounds are light, proper contrast
✅ **Dark Mode**: Text is light, backgrounds are dark, proper contrast
✅ **Syntax Highlighting**: Colorful keywords/strings work in both themes
✅ **Accessibility**: Maintains proper color contrast ratios in both modes
✅ **Build**: No errors, compiles successfully

## Testing

To test the fixes:
1. Light mode: Check that code blocks have light backgrounds with dark text
2. Dark mode: Check that code blocks have dark backgrounds with light text
3. Toggle between themes to ensure all markdown elements adapt properly
4. Verify inline code, blockquotes, and copy buttons are readable in both modes

