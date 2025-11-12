import type { RoutePath } from './route.type';
import { ROUTE } from '../constants/route.constant.js';

export interface SidebarActivity {
  id: string;
  label: string;
  shortLabel?: string;
  icon?: string;
  route?: RoutePath;
  badge?: number;
  onClick?: () => void;
}

// Runtime helpers
export const DEFAULT_SIDEBAR_ACTIVITY: SidebarActivity = {
  id: 'home',
  label: 'Home',
  route: ROUTE.HOME as unknown as RoutePath,
};

export function createSidebarActivity(overrides: Partial<SidebarActivity>): SidebarActivity {
  return { ...DEFAULT_SIDEBAR_ACTIVITY, ...overrides };
}
