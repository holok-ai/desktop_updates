import type { ROUTE } from '../constants/route.constant';

export type RoutePath = (typeof ROUTE)[keyof typeof ROUTE];
