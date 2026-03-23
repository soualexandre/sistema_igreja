import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { StudentLiveFlow } from '@/components/competition/student-live-flow';
import { TeacherCompetitionsList } from '@/components/competition/teacher-competitions-list';
import { AppTheme } from '@/constants/app-theme';
import { useAuth } from '@/providers/auth-provider';

export default function CompetitionIndexScreen() {
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();

  if (!user || !token) {
    return null;
  }

  if (user.role === 'student' && !user.classId) {
    return (
      <View style={[styles.studentGate, { paddingTop: insets.top + 16 }]}>
        <Text style={styles.emoji}>🎯</Text>
        <Text style={styles.gateTitle}>Competição</Text>
        <Text style={styles.gateBody}>
          Para entrar num jogo ao estilo Kahoot, você precisa estar vinculado a uma turma. Peça acesso na aba{' '}
          <Text style={styles.gateAccent}>Salas</Text> e aguarde a aprovação.
        </Text>
      </View>
    );
  }

  if (user.role === 'student') {
    return <StudentLiveFlow token={token} userId={user.id} name={user.name} />;
  }

  return <TeacherCompetitionsList token={token} topInset={insets.top} />;
}

const styles = StyleSheet.create({
  studentGate: {
    flex: 1,
    backgroundColor: AppTheme.bg,
    paddingHorizontal: 20,
  },
  emoji: { fontSize: 48, marginBottom: 8 },
  gateTitle: { color: AppTheme.text, fontSize: 24, fontWeight: '800', marginBottom: 8 },
  gateBody: { color: AppTheme.muted, lineHeight: 22, fontSize: 15 },
  gateAccent: { fontWeight: '800', color: AppTheme.accent },
});
