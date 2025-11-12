import { ROUTE } from '../constants/route.constant';

export type RoutePath = (typeof ROUTE)[keyof typeof ROUTE];

// Runtime helpers for tests and consumers
export const DEFAULT_ROUTE: RoutePath = ROUTE.HOME as RoutePath;

export function getAvailableRoutes(): string[] {
  return Object.values(ROUTE);
}
