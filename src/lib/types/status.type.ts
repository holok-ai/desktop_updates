import { THREAD_STATUS } from '../constants/status.constant.js';

export type ThreadStatus = (typeof THREAD_STATUS)[keyof typeof THREAD_STATUS];
