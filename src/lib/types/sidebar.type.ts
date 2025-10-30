import type { RoutePath } from "./route.type";

export interface SidebarActivity {
  id: string;
  label: string;
  icon?: string;
  route?: RoutePath;
  badge?: number;
}