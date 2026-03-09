/**
 * Shared sidebar collapsed state.
 *
 * Allows components outside ActivitySidebar (e.g. ThreadChatView)
 * to programmatically collapse/expand the sidebar.
 */
import { writable } from 'svelte/store';

export const sidebarCollapsed = writable(false);
