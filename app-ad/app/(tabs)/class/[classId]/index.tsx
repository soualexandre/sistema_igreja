import { useCallback, useEffect, useLayoutEffect, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '@/constants/app-theme';
import { attendanceApi, type AttendanceComboLeaderboardRow } from '@/lib/attendance-api';
import { classesApi, type Classroom } from '@/lib/classes-api';
import { lessonsApi, type LessonDto } from '@/lib/lessons-api';
import { useAuth } from '@/providers/auth-provider';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

const PODIUM_COLORS = ['#EAB308', '#94A3B8', '#EA580C'] as const;

type DashboardSnapshot = {
  className: string;
  classroom: Classroom | null;
  enrolledCount: number;
  pendingCount: number;
  lessonsCount: number;
  focusLesson: LessonDto | null;
  cpadYear: number | null;
  topThree: AttendanceComboLeaderboardRow[];
};

function PodiumRow({ row, rank }: { row: AttendanceComboLeaderboardRow; rank: number }) {
  const medalColor = PODIUM_COLORS[rank - 1] ?? MUTED;
  return (
    <View style={styles.podiumRow}>
      <View style={[styles.podiumRank, { borderColor: medalColor }]}>
        <Text style={[styles.podiumRankText, { color: medalColor }]}>{rank}</Text>
      </View>
      <View style={styles.podiumMid}>
        <Text style={styles.podiumName} numberOfLines={1}>
          {row.name}
        </Text>
      </View>
      <Text style={styles.podiumPoints}>{row.comboScore} combo</Text>
    </View>
  );
}

export default function ClassRoomDashboardScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const raw = useLocalSearchParams<{ classId: string }>().classId;
  const classId = Array.isArray(raw) ? raw[0] : raw;

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);

  const isStaff = user?.role === 'teacher' || user?.role === 'admin';

  const load = useCallback(async () => {
    if (!token || !classId || !user) return;
    try {
      setLoading(true);
      setError(null);

      const [classList, comboBoard] = await Promise.all([
        classesApi.list(token),
        attendanceApi
          .classComboLeaderboard(token, classId)
          .catch(() => [] as AttendanceComboLeaderboardRow[]),
      ]);

      const c = classList.find((x) => x.id === classId) ?? null;
      const className = c?.name ?? 'Turma';
      const topThree = comboBoard.slice(0, 3);

      let enrolledCount = 0;
      let pendingCount = 0;
      let lessonsCount = 0;
      let focusLesson: LessonDto | null = null;
      let cpadYear: number | null = null;

      if (isStaff) {
        const roster = await classesApi.listStudents(token, classId);
        enrolledCount = roster.length;
        if (user.role === 'admin') {
          const reqs = await classesApi.listStaffAccessRequests(token);
          const forClass = reqs.filter((r) => r.classId === classId);
          pendingCount = forClass.filter(
            (r) => r.status === 'PENDING_ADMIN' || r.status === 'PENDING_TEACHER',
          ).length;
        }
      }

      if (isStaff && c) {
        if (c.useCpadSchedule === true) {
          const state = await lessonsApi.cpadState(token, classId);
          lessonsCount = state.lessons.length;
          cpadYear = state.cpadYear;
          focusLesson =
            state.lessons.length > 0 ? state.lessons[state.lessons.length - 1]! : null;
        } else {
          const ls = await lessonsApi.list(token, classId);
          lessonsCount = ls.length;
          focusLesson = ls.length > 0 ? ls[0]! : null;
        }
      }

      setSnap({
        className,
        classroom: c,
        enrolledCount,
        pendingCount,
        lessonsCount,
        focusLesson,
        cpadYear,
        topThree,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, [token, classId, user, isStaff]);

  useEffect(() => {
    void load();
  }, [load]);

  useLayoutEffect(() => {
    navigation.setOptions({
      title: snap?.className ? snap.className : 'Sala',
      headerBackTitleVisible: false,
      headerTitleStyle: {
        fontSize: 17,
        fontWeight: '800',
        color: AppTheme.text,
        maxWidth: Platform.OS === 'ios' ? 200 : undefined,
      },
      headerShadowVisible: false,
    });
  }, [navigation, snap?.className]);

  const scrollBottomPad = Math.max(insets.bottom, 16) + 32;

  const renderRankingBlock = (topThree: AttendanceComboLeaderboardRow[]) => (
    <View style={styles.rankingSection}>
      <View style={styles.rankingHeaderRow}>
        <MaterialIcons name="workspace-premium" size={20} color={ACCENT} />
        <Text style={styles.rankingTitle}>Top 3 presença em aula</Text>
      </View>
      <Text style={styles.rankingHint}>
        Combo por aula: presença + pontualidade + itens de participação (revista, Bíblia, lição, oferta). Não
        inclui pontos de quiz ou competição.
      </Text>
      {topThree.length === 0 ? (
        <View style={styles.rankingEmpty}>
          <Text style={styles.rankingEmptyText}>
            Ainda não há presenças registradas para montar o ranking.
          </Text>
        </View>
      ) : (
        <View style={styles.podiumCard}>
          {topThree.map((row, i) => (
            <PodiumRow key={row.userId} row={row} rank={i + 1} />
          ))}
        </View>
      )}
    </View>
  );

  if (!user || !token || !classId) {
    return null;
  }

  if (user.role === 'student') {
    if (loading) {
      return (
        <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
          <ActivityIndicator color={ACCENT} size="large" />
        </View>
      );
    }
    if (!snap) {
      return (
        <View style={[styles.root, { paddingHorizontal: 20, paddingTop: 24 }]}>
          <Text style={styles.err}>{error ?? 'Turma não encontrada.'}</Text>
        </View>
      );
    }
    return (
      <View style={styles.root}>
        <ScrollView
          style={styles.scroll}
          contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
          showsVerticalScrollIndicator={false}
          contentInsetAdjustmentBehavior="automatic"
          keyboardShouldPersistTaps="handled">
          <View style={styles.compactBar}>
            <View style={styles.modePill}>
              <Text style={styles.modePillText}>Sua turma</Text>
            </View>
          </View>
          <Text style={styles.studentLead}>
            Você está nesta sala. O professor registra presença e acompanha pedidos de acesso.
          </Text>
          {snap ? renderRankingBlock(snap.topThree) : null}
        </ScrollView>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  if (!snap) {
    return (
      <View style={styles.root}>
        <Text style={styles.err}>{error ?? 'Turma não encontrada.'}</Text>
      </View>
    );
  }

  const modeLabel =
    snap.classroom?.useCpadSchedule === true
      ? `CPAD${snap.cpadYear != null ? ` · ${snap.cpadYear}` : ''}`
      : 'Modo livre';

  return (
    <View style={styles.root}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: scrollBottomPad }]}
        showsVerticalScrollIndicator={false}
        contentInsetAdjustmentBehavior="automatic"
        keyboardShouldPersistTaps="handled">
        {error ? <Text style={styles.errBanner}>{error}</Text> : null}

        <View style={styles.compactBar}>
          <View style={styles.modePill}>
            <Text style={styles.modePillText}>{modeLabel}</Text>
          </View>
        </View>

        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <MaterialIcons name="school" size={20} color={MUTED} />
            <Text style={styles.statValue}>{snap.enrolledCount}</Text>
            <Text style={styles.statLabel}>Alunos</Text>
          </View>
          <View style={[styles.statCard, snap.pendingCount > 0 && styles.statCardHighlight]}>
            <MaterialIcons name="mark-email-unread" size={20} color={snap.pendingCount > 0 ? ACCENT : MUTED} />
            <Text style={[styles.statValue, snap.pendingCount > 0 && { color: ACCENT }]}>
              {snap.pendingCount}
            </Text>
            <Text style={styles.statLabel}>Pendentes</Text>
          </View>
        </View>

        {snap.focusLesson ? (
          <View style={styles.insightCard}>
            <Text style={styles.insightLabel}>Lição em foco</Text>
            <Text style={styles.insightTitle} numberOfLines={3}>
              {snap.focusLesson.title}
            </Text>
            <Text style={styles.insightMeta} numberOfLines={2}>
              {(snap.focusLesson.location ? `${snap.focusLesson.location} · ` : '') +
                new Date(snap.focusLesson.startsAt).toLocaleString()}
            </Text>
          </View>
        ) : (
          <View style={styles.insightCardMuted}>
            <MaterialIcons name="event-busy" size={20} color={MUTED} />
            <Text style={styles.insightMutedText}>
              Nenhuma aula disponível ainda. Abra Presença para criar ou liberar lições.
            </Text>
          </View>
        )}

        <Text style={styles.sectionLabel}>Ações</Text>

        <Pressable
          style={({ pressed }) => [styles.primaryCta, pressed && { opacity: 0.92 }]}
          onPress={() => router.push(`/class/${classId}/attendance`)}>
          <View style={styles.primaryCtaIcon}>
            <MaterialIcons name="fact-check" size={24} color={AppTheme.onAccent} />
          </View>
          <View style={styles.primaryCtaTextCol}>
            <Text style={styles.primaryCtaTitle}>Registrar presença</Text>
            <Text style={styles.primaryCtaSub}>
              Lição e alunos · {snap.lessonsCount}{' '}
              {snap.lessonsCount === 1 ? 'lição liberada' : 'lições liberadas'}
            </Text>
          </View>
          <MaterialIcons name="chevron-right" size={26} color={AppTheme.onAccent} />
        </Pressable>

        <Pressable
          style={({ pressed }) => [styles.secondaryCta, pressed && styles.secondaryCtaPressed]}
          onPress={() => router.push(`/class/${classId}/students`)}>
          <View style={styles.secondaryCtaLeft}>
            <MaterialIcons name="group-add" size={22} color={ACCENT} />
            <View style={styles.secondaryCtaTextCol}>
              <Text style={styles.secondaryCtaTitle}>Gerenciar alunos</Text>
              <Text style={styles.secondaryCtaSub} numberOfLines={2}>
                Lista · aceitar ou recusar pedidos
              </Text>
            </View>
          </View>
          <View style={styles.secondaryCtaRight}>
            {snap.pendingCount > 0 ? (
              <View style={styles.badge}>
                <Text style={styles.badgeText}>{snap.pendingCount}</Text>
              </View>
            ) : null}
            <MaterialIcons name="chevron-right" size={22} color={MUTED} />
          </View>
        </Pressable>

        {renderRankingBlock(snap.topThree)}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG },
  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  err: { color: AppTheme.danger, padding: 16 },
  errBanner: {
    color: AppTheme.dangerText,
    backgroundColor: AppTheme.dangerMuted,
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    overflow: 'hidden',
  },
  compactBar: {
    marginBottom: 14,
  },
  studentLead: {
    color: AppTheme.textSecondary,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: 20,
  },
  modePill: {
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: AppTheme.accentMuted,
    borderWidth: 1,
    borderColor: AppTheme.accentBorder,
  },
  modePillText: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  statsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    gap: 4,
  },
  statCardHighlight: {
    borderColor: AppTheme.accentBorder,
    backgroundColor: AppTheme.chipOnBg,
  },
  statValue: {
    color: AppTheme.text,
    fontSize: 24,
    fontWeight: '900',
  },
  statLabel: {
    color: MUTED,
    fontSize: 12,
    fontWeight: '600',
  },
  insightCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 18,
  },
  insightLabel: {
    color: MUTED,
    fontSize: 10,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 6,
  },
  insightTitle: {
    color: AppTheme.text,
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
  },
  insightMeta: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 16,
  },
  insightCardMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: AppTheme.inputBg,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 18,
  },
  insightMutedText: {
    flex: 1,
    color: MUTED,
    fontSize: 13,
    lineHeight: 18,
  },
  sectionLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: 8,
  },
  primaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: ACCENT,
    borderRadius: 16,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 10,
  },
  primaryCtaIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: 'rgba(10, 11, 18, 0.12)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryCtaTextCol: { flex: 1, minWidth: 0 },
  primaryCtaTitle: {
    color: AppTheme.onAccent,
    fontSize: 17,
    fontWeight: '900',
  },
  primaryCtaSub: {
    color: 'rgba(10, 11, 18, 0.72)',
    fontSize: 12,
    marginTop: 3,
    fontWeight: '600',
  },
  secondaryCta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 14,
    marginBottom: 22,
  },
  secondaryCtaPressed: {
    backgroundColor: AppTheme.surfaceMuted,
  },
  secondaryCtaLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    flex: 1,
    minWidth: 0,
  },
  secondaryCtaTextCol: { flex: 1, minWidth: 0 },
  secondaryCtaTitle: {
    color: AppTheme.text,
    fontSize: 15,
    fontWeight: '800',
  },
  secondaryCtaSub: {
    color: MUTED,
    fontSize: 11,
    marginTop: 2,
    fontWeight: '500',
  },
  secondaryCtaRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  badge: {
    minWidth: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 6,
  },
  badgeText: {
    color: AppTheme.onAccent,
    fontSize: 11,
    fontWeight: '900',
  },
  rankingSection: {
    marginTop: 4,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  rankingHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 12,
    marginBottom: 6,
  },
  rankingTitle: {
    color: AppTheme.text,
    fontSize: 16,
    fontWeight: '800',
  },
  rankingHint: {
    color: MUTED,
    fontSize: 11,
    lineHeight: 16,
    marginBottom: 12,
  },
  rankingEmpty: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  rankingEmptyText: {
    color: MUTED,
    fontSize: 13,
    textAlign: 'center',
  },
  podiumCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    gap: 8,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  podiumRank: {
    width: 32,
    height: 32,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.bgElevated,
  },
  podiumRankText: {
    fontSize: 15,
    fontWeight: '900',
  },
  podiumMid: { flex: 1, minWidth: 0 },
  podiumName: {
    color: AppTheme.text,
    fontSize: 15,
    fontWeight: '700',
  },
  podiumPoints: {
    color: ACCENT,
    fontSize: 14,
    fontWeight: '800',
  },
});
