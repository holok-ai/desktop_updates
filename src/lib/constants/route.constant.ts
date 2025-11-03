export const ROUTE = {
  HOME: '/',
  THREADS: '/threads',
  SETTINGS: '/settings',
  GUIDE: '/guide',
} as const;

export type RoutePath = (typeof ROUTE)[keyof typeof ROUTE];
