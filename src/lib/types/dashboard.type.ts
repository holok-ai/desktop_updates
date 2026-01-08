/**
 * Dashboard Types
 * Type definitions for dashboard components and data structures
 */

/**
 * Mock invitation data structure
 * Used until the backend invitation API is implemented
 */
export interface MockInvitation {
  id: string;
  projectId: string;
  projectName: string;
  invitedBy: {
    name: string;
    email: string;
  };
  invitedAt: Date;
  status: 'pending';
  message?: string;
}

/**
 * Models grouped by provider
 */
export interface ModelsByProvider {
  [provider: string]: string[];
}

/**
 * Chart data point for metrics
 */
export interface ChartDataPoint {
  label: string;
  value: number;
}

/**
 * Support contact information
 */
export interface SupportContact {
  email: string;
  discord: string;
  phone: string;
}

/**
 * Resource link for documentation/help
 */
export interface ResourceLink {
  title: string;
  url: string;
  description?: string;
}
