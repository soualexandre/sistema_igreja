/**
 * Cores legadas (ex.: ThemedText). O app usa modo escuro único — alinhado a `app-theme.ts`.
 */
import { Platform } from 'react-native';

import { AppTheme } from './app-theme';

const tintColorLight = AppTheme.accent;
const tintColorDark = AppTheme.accent;

export const Colors = {
  light: {
    text: AppTheme.text,
    background: AppTheme.bg,
    tint: tintColorLight,
    icon: AppTheme.muted,
    tabIconDefault: AppTheme.muted,
    tabIconSelected: tintColorLight,
  },
  dark: {
    text: AppTheme.text,
    background: AppTheme.bg,
    tint: tintColorDark,
    icon: AppTheme.muted,
    tabIconDefault: AppTheme.muted,
    tabIconSelected: tintColorDark,
  },
};

export const Fonts = Platform.select({
  ios: {
    sans: 'system-ui',
    serif: 'ui-serif',
    rounded: 'ui-rounded',
    mono: 'ui-monospace',
  },
  default: {
    sans: 'normal',
    serif: 'serif',
    rounded: 'normal',
    mono: 'monospace',
  },
  web: {
    sans: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    serif: "Georgia, 'Times New Roman', serif",
    rounded: "'SF Pro Rounded', 'Hiragino Maru Gothic ProN', Meiryo, 'MS PGothic', sans-serif",
    mono: "SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace",
  },
});
