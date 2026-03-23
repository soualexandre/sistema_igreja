import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { router } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

function roleLabel(role: string) {
  if (role === 'admin') return 'Administrador';
  if (role === 'teacher') return 'Professor';
  return 'Aluno';
}

export default function ProfileScreen() {
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();

  const onSignOut = async () => {
    await signOut();
    router.replace('/sign-in');
  };

  if (!user) {
    return null;
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 12 }]}>
      <ScrollView
        contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 32 }]}
        showsVerticalScrollIndicator={false}>
        <Text style={styles.screenTitle}>Perfil</Text>
        <Text style={styles.screenSub}>Sua conta e sessão no app</Text>

        <View style={styles.card}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{user.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <Text style={styles.name}>{user.name}</Text>
          <Text style={styles.email}>{user.email}</Text>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillText}>{roleLabel(user.role)}</Text>
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.signOutBtn, pressed && { opacity: 0.9 }]}
          onPress={() => void onSignOut()}>
          <MaterialIcons name="logout" size={22} color={AppTheme.dangerTextBright} />
          <Text style={styles.signOutText}>Sair da conta</Text>
        </Pressable>

        <Text style={styles.hint}>O logout encerra a sessão neste aparelho. Use apenas aqui para sair com segurança.</Text>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 20 },
  scroll: { flexGrow: 1 },
  screenTitle: {
    color: AppTheme.text,
    fontSize: 28,
    fontWeight: '900',
    marginBottom: 6,
  },
  screenSub: {
    color: MUTED,
    fontSize: 14,
    marginBottom: 22,
    lineHeight: 20,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
  },
  avatar: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: AppTheme.accentMutedStrong,
    borderWidth: 1,
    borderColor: AppTheme.accentBorder,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  avatarText: {
    color: ACCENT,
    fontSize: 28,
    fontWeight: '900',
  },
  name: {
    color: AppTheme.text,
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  email: {
    color: MUTED,
    fontSize: 14,
    marginTop: 6,
    textAlign: 'center',
  },
  rolePill: {
    marginTop: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rolePillText: {
    color: AppTheme.textSecondary,
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
  },
  signOutBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: AppTheme.dangerMuted,
    borderWidth: 1,
    borderColor: AppTheme.dangerBorder,
    borderRadius: 16,
    minHeight: 52,
    paddingHorizontal: 20,
  },
  signOutText: {
    color: AppTheme.dangerTextBright,
    fontWeight: '800',
    fontSize: 16,
  },
  hint: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    textAlign: 'center',
    marginTop: 16,
    paddingHorizontal: 8,
  },
});
