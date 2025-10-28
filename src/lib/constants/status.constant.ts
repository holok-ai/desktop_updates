export const THREAD_STATUS = {
  ACTIVE: 'active',
  ARCHIVED: 'archived'
} as const;

export type ThreadStatus = typeof THREAD_STATUS[keyof typeof THREAD_STATUS];


