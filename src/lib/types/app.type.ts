import type { APP_THEME_MODE } from "../constants/app.constant";

export type AppThemeMode = (typeof APP_THEME_MODE)[keyof typeof APP_THEME_MODE];