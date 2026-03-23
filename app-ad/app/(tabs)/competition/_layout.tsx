import { Stack } from 'expo-router';

import { AppTheme } from '@/constants/app-theme';

export default function CompetitionStackLayout() {
  return (
    <Stack
      screenOptions={{
        contentStyle: { backgroundColor: AppTheme.bg },
        headerStyle: { backgroundColor: AppTheme.bgElevated },
        headerTintColor: AppTheme.accent,
        headerTitleStyle: { fontWeight: '800', color: AppTheme.text },
        headerShadowVisible: false,
      }}>
      <Stack.Screen name="index" options={{ headerShown: false }} />
      <Stack.Screen
        name="[competitionId]"
        options={{
          title: 'Competição',
          headerBackTitle: 'Voltar',
        }}
      />
    </Stack>
  );
}
