import { useEffect, useLayoutEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { TeacherCompetitionHistory } from '@/components/competition/teacher-competition-history';
import { TeacherLiveHost } from '@/components/competition/teacher-live-host';
import { TeacherQuestionManager } from '@/components/competition/teacher-question-manager';
import { AppTheme } from '@/constants/app-theme';
import { classesApi } from '@/lib/classes-api';
import { competitionsApi } from '@/lib/competitions-api';
import { useAuth } from '@/providers/auth-provider';

type TabKey = 'live' | 'questions' | 'history';

export default function CompetitionDetailScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { user, token } = useAuth();
  const raw = useLocalSearchParams<{ competitionId: string }>().competitionId;
  const competitionId = Array.isArray(raw) ? raw[0] : raw;

  const [tab, setTab] = useState<TabKey>('live');
  const [competitionName, setCompetitionName] = useState('');
  const [refreshHost, setRefreshHost] = useState(0);
  const [pickableClasses, setPickableClasses] = useState<{ id: string; name: string }[]>([]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: competitionName || 'Competição' });
  }, [navigation, competitionName]);

  useEffect(() => {
    if (!token || !competitionId) return;
    void competitionsApi.list(token).then((list) => {
      const c = list.find((x) => x.id === competitionId);
      setCompetitionName(c?.name ?? 'Competição');
    });
  }, [token, competitionId]);

  useEffect(() => {
    if (!token || !user) return;
    void classesApi.list(token).then((list) => {
      if (user.role === 'admin') {
        setPickableClasses(list.map((c) => ({ id: c.id, name: c.name })));
      } else {
        setPickableClasses(
          list
            .filter((c) => user.teacherClassIds.includes(c.id))
            .map((c) => ({ id: c.id, name: c.name })),
        );
      }
    });
  }, [token, user]);

  const contentTopInset = 12;

  const liveKey = useMemo(
    () => `${refreshHost}-${competitionId ?? ''}`,
    [refreshHost, competitionId],
  );

  if (!user || !token || !competitionId) {
    return null;
  }

  if (user.role === 'student') {
    return (
      <View style={styles.denied}>
        <Text style={styles.deniedText}>Esta área é só para professores e administradores.</Text>
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <View style={[styles.segmentWrap, { marginTop: insets.top > 0 ? 4 : 12 }]}>
        <Pressable
          onPress={() => setTab('live')}
          style={[styles.segmentBtn, tab === 'live' && styles.segmentBtnOn]}>
          <Text style={[styles.segmentLabel, tab === 'live' && styles.segmentLabelOn]}>Ao vivo</Text>
          <Text style={styles.segmentHint}>PIN e rodada</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('questions')}
          style={[styles.segmentBtn, tab === 'questions' && styles.segmentBtnOn]}>
          <Text style={[styles.segmentLabel, tab === 'questions' && styles.segmentLabelOn]}>Perguntas</Text>
          <Text style={styles.segmentHint}>Criar e editar</Text>
        </Pressable>
        <Pressable
          onPress={() => setTab('history')}
          style={[styles.segmentBtn, tab === 'history' && styles.segmentBtnOn]}>
          <Text style={[styles.segmentLabel, tab === 'history' && styles.segmentLabelOn]}>Histórico</Text>
          <Text style={styles.segmentHint}>Rodadas</Text>
        </Pressable>
      </View>

      {tab === 'live' ? (
        <TeacherLiveHost
          key={liveKey}
          token={token}
          competitionId={competitionId}
          competitionName={competitionName}
          pickableClasses={pickableClasses}
          topInset={contentTopInset}
          onSessionEnded={() => setRefreshHost((n) => n + 1)}
        />
      ) : tab === 'questions' ? (
        <TeacherQuestionManager
          token={token}
          competitionId={competitionId}
          competitionName={competitionName}
          topInset={contentTopInset}
          onQuestionsChanged={() => setRefreshHost((n) => n + 1)}
        />
      ) : (
        <TeacherCompetitionHistory
          token={token}
          competitionId={competitionId}
          topInset={contentTopInset}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: AppTheme.bg },
  denied: { flex: 1, justifyContent: 'center', padding: 24, backgroundColor: AppTheme.bg },
  deniedText: { color: AppTheme.muted, textAlign: 'center', lineHeight: 22 },
  segmentWrap: {
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingBottom: 12,
  },
  segmentBtn: {
    flex: 1,
    backgroundColor: AppTheme.card,
    borderRadius: 14,
    paddingVertical: 10,
    paddingHorizontal: 8,
    borderWidth: 1,
    borderColor: AppTheme.border,
  },
  segmentBtnOn: {
    borderColor: AppTheme.accentBorder,
    backgroundColor: AppTheme.chipOnBg,
  },
  segmentLabel: { color: AppTheme.muted, fontWeight: '800', fontSize: 13, textAlign: 'center' },
  segmentLabelOn: { color: AppTheme.accent },
  segmentHint: {
    color: AppTheme.mutedDark,
    fontSize: 10,
    marginTop: 4,
    fontWeight: '600',
    textAlign: 'center',
  },
});
