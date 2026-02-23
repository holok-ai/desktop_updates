/**
 * User API Type Definitions
 * These types match the Moku API backend DTOs for user operations
 */

/**
 * User Summary DTO from Moku API
 */
export interface UserSummaryDTO {
  id: string;
  email: string;
  displayName: string;
  active: boolean;
  roles: string[];
  provider: string;
  lastLogin: string | null; // ISO-8601 timestamp
  createdAt: string; // ISO-8601 timestamp
}

/**
 * Request parameters for searching users
 */
export interface UserSearchParams {
  page?: number;
  size?: number;
  sort?: string;
  search?: string | null;
  status?: 'active' | 'inactive';
}
