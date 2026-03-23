import { Stack } from 'expo-router';

import { AppTheme } from '@/constants/app-theme';

export default function ClassDetailLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: AppTheme.bg },
        headerStyle: { backgroundColor: AppTheme.bgElevated },
        headerTintColor: AppTheme.accent,
        headerTitleStyle: { fontWeight: '800', color: AppTheme.text },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ title: 'Sala' }} />
      <Stack.Screen name="attendance" options={{ title: 'Presença' }} />
      <Stack.Screen name="access" options={{ title: 'Gerenciar alunos', headerShown: false }} />
      <Stack.Screen name="students" options={{ title: 'Gerenciar alunos' }} />
    </Stack>
  );
}
