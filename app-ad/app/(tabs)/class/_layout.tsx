import { Stack } from 'expo-router';

import { AppTheme } from '@/constants/app-theme';

export default function ClassStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: AppTheme.bg },
        headerStyle: { backgroundColor: AppTheme.bgElevated },
        headerTintColor: AppTheme.accent,
        headerTitleStyle: { fontWeight: '800', color: AppTheme.text },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="[classId]" options={{ headerShown: false }} />
    </Stack>
  );
}
