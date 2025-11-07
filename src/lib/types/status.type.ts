import { THREAD_STATUS, MESSAGE_STATUS } from "../constants/status.constant.js";

export type ThreadStatus = typeof THREAD_STATUS[keyof typeof THREAD_STATUS];
export type MessageStatus = (typeof MESSAGE_STATUS)[keyof typeof MESSAGE_STATUS];
