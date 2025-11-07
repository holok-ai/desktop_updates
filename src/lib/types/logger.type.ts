import { LOG_LEVEL } from '../constants/app.constant.js';

export type LogLevel = (typeof LOG_LEVEL)[keyof typeof LOG_LEVEL];
