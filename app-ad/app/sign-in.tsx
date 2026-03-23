import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { Link, Redirect, router } from 'expo-router';
import { AppTheme } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

export default function SignInScreen() {
  const { signIn, token, isLoading } = useAuth();
  const [email, setEmail] = useState('prof@ebd.local');
  const [password, setPassword] = useState('123456');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  if (isLoading) {
    return (
      <View style={styles.boot}>
        <ActivityIndicator size="large" color={AppTheme.accent} />
      </View>
    );
  }

  if (token) {
    return <Redirect href="/(tabs)" />;
  }

  const onSubmit = async () => {
    try {
      setLoading(true);
      setError(null);
      await signIn(email.trim(), password);
      router.replace('/(tabs)');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao entrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.badge}>EBD Gamificado</Text>
        <Text style={styles.title}>Entrar</Text>
        <Text style={styles.subtitle}>Uma experiência premium para sua igreja</Text>

        <TextInput
          style={styles.input}
          placeholder="Email"
          placeholderTextColor={AppTheme.placeholder}
          autoCapitalize="none"
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
        />
        <View style={styles.passwordWrap}>
          <TextInput
            style={styles.inputPassword}
            placeholder="Senha"
            placeholderTextColor={AppTheme.placeholder}
            secureTextEntry={!showPassword}
            value={password}
            onChangeText={setPassword}
            autoCapitalize="none"
            autoCorrect={false}
          />
          <Pressable
            style={styles.eyeBtn}
            onPress={() => setShowPassword((v) => !v)}
            hitSlop={12}
            accessibilityLabel={showPassword ? 'Ocultar senha' : 'Mostrar senha'}
            accessibilityRole="button">
            <MaterialIcons
              name={showPassword ? 'visibility-off' : 'visibility'}
              size={22}
              color={AppTheme.muted}
            />
          </Pressable>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable style={styles.button} onPress={onSubmit} disabled={loading}>
          {loading ? (
            <ActivityIndicator color={AppTheme.onAccent} />
          ) : (
            <Text style={styles.buttonText}>Continuar</Text>
          )}
        </Pressable>

        <Link href="/sign-up" asChild>
          <Pressable>
            <Text style={styles.link}>Criar uma conta</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: AppTheme.bg,
  },
  screen: {
    flex: 1,
    backgroundColor: AppTheme.bg,
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: AppTheme.card,
    borderRadius: 28,
    padding: 24,
    borderWidth: 1,
    borderColor: AppTheme.border,
    gap: 12,
  },
  badge: {
    alignSelf: 'flex-start',
    color: AppTheme.accent,
    backgroundColor: AppTheme.chipOnBg,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AppTheme.accentBorder,
    fontWeight: '700',
  },
  title: {
    color: AppTheme.text,
    fontSize: 34,
    fontWeight: '800',
  },
  subtitle: {
    color: AppTheme.muted,
    marginBottom: 8,
  },
  input: {
    backgroundColor: AppTheme.inputBg,
    borderColor: AppTheme.inputBorder,
    borderWidth: 1,
    borderRadius: 14,
    color: AppTheme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  passwordWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: AppTheme.inputBg,
    borderColor: AppTheme.inputBorder,
    borderWidth: 1,
    borderRadius: 14,
    paddingRight: 6,
  },
  inputPassword: {
    flex: 1,
    color: AppTheme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    minHeight: 48,
  },
  eyeBtn: {
    padding: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  button: {
    marginTop: 6,
    backgroundColor: AppTheme.accent,
    borderRadius: 14,
    minHeight: 48,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonText: {
    color: AppTheme.onAccent,
    fontWeight: '800',
    fontSize: 16,
  },
  error: {
    color: AppTheme.danger,
    fontSize: 13,
  },
  link: {
    color: AppTheme.link,
    textAlign: 'center',
    marginTop: 4,
    fontWeight: '600',
  },
});
