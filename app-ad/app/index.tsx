import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { Redirect } from 'expo-router';
import { AppTheme } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

export default function EntryScreen() {
  const { isLoading, token } = useAuth();

  if (isLoading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={AppTheme.accent} />
      </View>
    );
  }

  if (!token) {
    return <Redirect href="/sign-in" />;
  }

  return <Redirect href="/(tabs)" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.bg,
  },
});
