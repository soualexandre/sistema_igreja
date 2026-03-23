import { DarkTheme, ThemeProvider } from '@react-navigation/native';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import 'react-native-reanimated';

import { AppTheme } from '@/constants/app-theme';
import { AuthProvider } from '@/providers/auth-provider';

/** Navegação sempre no mesmo dark slate + verde do app */
const NavigationDark = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: AppTheme.accent,
    background: AppTheme.bg,
    card: AppTheme.bgElevated,
    text: AppTheme.text,
    border: AppTheme.border,
    notification: AppTheme.accent,
  },
};

export default function RootLayout() {
  return (
    <AuthProvider>
      <ThemeProvider value={NavigationDark}>
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="sign-in" />
          <Stack.Screen name="sign-up" />
          <Stack.Screen name="(tabs)" />
        </Stack>
        <StatusBar style="light" />
      </ThemeProvider>
    </AuthProvider>
  );
}
