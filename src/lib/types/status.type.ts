import type { THREAD_STATUS } from "../constants/status.constant";

export type ThreadStatus = typeof THREAD_STATUS[keyof typeof THREAD_STATUS];