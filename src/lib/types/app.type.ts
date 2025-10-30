import type { APP_COLOR_MODE } from "../constants/app.constant";

export type AppColorMode = (typeof APP_COLOR_MODE)[keyof typeof APP_COLOR_MODE];