import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AppTheme } from '@/constants/app-theme';
import {
  attendanceApi,
  type AttendanceComboLeaderboardRow,
  type MyAttendanceSummary,
} from '@/lib/attendance-api';
import {
  classesApi,
  type ClassAccessRequest,
  type Classroom,
} from '@/lib/classes-api';
import { useAuth } from '@/providers/auth-provider';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

const PODIUM_COLORS = ['#EAB308', '#94A3B8', '#EA580C'] as const;

type StudentDashData = {
  className: string;
  topThree: AttendanceComboLeaderboardRow[];
  summary: MyAttendanceSummary | null;
};

function PodiumRowHome({ row, rank }: { row: AttendanceComboLeaderboardRow; rank: number }) {
  const c = PODIUM_COLORS[rank - 1] ?? MUTED;
  return (
    <View style={dashStyles.podiumRow}>
      <View style={[dashStyles.podiumRank, { borderColor: c }]}>
        <Text style={[dashStyles.podiumRankText, { color: c }]}>{rank}</Text>
      </View>
      <Text style={dashStyles.podiumName} numberOfLines={1}>
        {row.name}
      </Text>
      <Text style={dashStyles.podiumPts}>{row.comboScore} combo</Text>
    </View>
  );
}

export default function HomeScreen() {
  const insets = useSafeAreaInsets();
  const { user, token, refreshUser } = useAuth();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [requests, setRequests] = useState<ClassAccessRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [requestingClassId, setRequestingClassId] = useState<string | null>(null);

  const [studentDash, setStudentDash] = useState<StudentDashData | null>(null);
  const [dashLoading, setDashLoading] = useState(false);
  const [showExplorer, setShowExplorer] = useState(false);

  const needsClassSelection = user?.role === 'student' && !user.classId;
  const needsTeacherClassSelection =
    user?.role === 'teacher' && (user.teacherClassIds?.length ?? 0) === 0;
  const needsMyRequests = needsClassSelection || needsTeacherClassSelection;
  const hasStudentHome =
    user?.role === 'student' && !!user.classId && !!token;

  const teacherOneClassId =
    user?.role === 'teacher' && user.teacherClassIds.length === 1
      ? user.teacherClassIds[0]
      : null;

  const loadAccessData = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [classesResult, requestsResult] = await Promise.all([
        classesApi.list(token),
        needsMyRequests ? classesApi.listMyRequests(token) : Promise.resolve([] as ClassAccessRequest[]),
      ]);
      setClasses(classesResult);
      setRequests(requestsResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao carregar salas');
    } finally {
      setLoading(false);
    }
  }, [token, needsMyRequests]);

  const loadStudentDashboard = useCallback(async () => {
    if (!token || user?.role !== 'student' || !user.classId) return;
    try {
      setDashLoading(true);
      const classList = await classesApi.list(token);
      const myClass = classList.find((c) => c.id === user.classId);
      const [comboBoard, summary] = await Promise.all([
        attendanceApi
          .classComboLeaderboard(token, user.classId)
          .catch(() => [] as AttendanceComboLeaderboardRow[]),
        attendanceApi.mySummary(token).catch(() => null),
      ]);
      setStudentDash({
        className: myClass?.name ?? 'Minha turma',
        topThree: comboBoard.slice(0, 3),
        summary,
      });
    } catch {
      setStudentDash({
        className: 'Minha turma',
        topThree: [],
        summary: null,
      });
    } finally {
      setDashLoading(false);
    }
  }, [token, user?.classId, user?.role]);

  useEffect(() => {
    if (!token) return;
    void loadAccessData();
  }, [token, loadAccessData]);

  useEffect(() => {
    if (hasStudentHome) void loadStudentDashboard();
    else setStudentDash(null);
  }, [hasStudentHome, loadStudentDashboard]);

  useEffect(() => {
    if (!teacherOneClassId || !token) return;
    router.replace(`/class/${teacherOneClassId}`);
  }, [teacherOneClassId, token]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    try {
      setRefreshing(true);
      setError(null);
      await refreshUser();
      const [classesResult, requestsResult] = await Promise.all([
        classesApi.list(token),
        needsMyRequests ? classesApi.listMyRequests(token) : Promise.resolve([] as ClassAccessRequest[]),
      ]);
      setClasses(classesResult);
      setRequests(requestsResult);
      if (hasStudentHome) await loadStudentDashboard();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao atualizar');
    } finally {
      setRefreshing(false);
    }
  }, [token, needsMyRequests, hasStudentHome, loadStudentDashboard, refreshUser]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, query]);

  const onRequestAccess = async (classId: string) => {
    if (!token || !user) return;
    try {
      setRequestingClassId(classId);
      setError(null);
      const requestKind: 'student' | 'teacher' =
        user.role === 'teacher' ? 'teacher' : 'student';
      await classesApi.requestAccess(
        token,
        classId,
        'Solicitação via app',
        requestKind,
      );
      await loadAccessData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao solicitar acesso');
    } finally {
      setRequestingClassId(null);
    }
  };

  const subtitle = useMemo(() => {
    if (!user) return '';
    if (user.role === 'student' && !user.classId) {
      return 'Salas da sua igreja: peça acesso ao administrador para participar da EBD nesta turma.';
    }
    if (user.role === 'student') {
      return 'Sua turma, top de presença em aula e histórico em um só lugar.';
    }
    if (user.role === 'teacher' && user.teacherClassIds.length === 0) {
      return 'Salas da sua igreja: peça acesso ao administrador para ser vinculado como professor desta turma.';
    }
    if (user.role === 'teacher') {
      return 'Abra uma sala para marcar presença, pontualidade e participação dos alunos.';
    }
    return 'Turmas da igreja: visão geral para gestão e acesso.';
  }, [user]);

  const renderItem = ({ item }: { item: Classroom }) => {
    const ownRequest = requests.find((r) => r.classId === item.id);
    const isPending =
      ownRequest?.status === 'PENDING_ADMIN' || ownRequest?.status === 'PENDING_TEACHER';
    const isApproved = ownRequest?.status === 'APPROVED';
    const isRejected = ownRequest?.status === 'REJECTED';
    const isMyClass = user?.classId === item.id;
    const isMyTeachingClass =
      user?.role === 'teacher' && user.teacherClassIds.includes(item.id);

    return (
      <View style={[styles.card, (isMyClass || isMyTeachingClass) && styles.cardHighlight]}>
        <View style={styles.cardTop}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
          </View>
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle}>{item.name}</Text>
            <Text style={styles.cardMeta} numberOfLines={1}>
              ID turma · {item.id.slice(0, 8)}…
            </Text>
            <View style={styles.badgeRow}>
              {isMyClass || isMyTeachingClass ? (
                <View style={[styles.badge, styles.badgeOk]}>
                  <Text style={styles.badgeText}>Sua sala</Text>
                </View>
              ) : null}
              {needsMyRequests && isPending ? (
                <View style={[styles.badge, styles.badgeWarn]}>
                  <Text style={styles.badgeText}>Pendente</Text>
                </View>
              ) : null}
              {needsMyRequests && isApproved ? (
                <View style={[styles.badge, styles.badgeOk]}>
                  <Text style={styles.badgeText}>Aprovada</Text>
                </View>
              ) : null}
              {needsMyRequests && isRejected ? (
                <View style={[styles.badge, styles.badgeBad]}>
                  <Text style={styles.badgeText}>Rejeitada</Text>
                </View>
              ) : null}
            </View>
          </View>
        </View>

        {needsMyRequests ? (
          <Pressable
            style={[styles.cta, isPending ? styles.ctaDisabled : null]}
            onPress={() => onRequestAccess(item.id)}
            disabled={isPending || requestingClassId === item.id}>
            {requestingClassId === item.id ? (
              <ActivityIndicator color={AppTheme.onAccent} />
            ) : (
              <Text style={styles.ctaText}>
                {isPending
                  ? 'Aguardando aprovação'
                  : needsTeacherClassSelection
                    ? 'Pedir acesso como professor'
                    : 'Pedir acesso'}
              </Text>
            )}
          </Pressable>
        ) : null}

        {(user?.role === 'admin' ||
          (user?.role === 'teacher' && user.teacherClassIds.includes(item.id))) && (
          <Pressable style={styles.cta} onPress={() => router.push(`/class/${item.id}`)}>
            <Text style={styles.ctaText}>Abrir sala · Presença</Text>
          </Pressable>
        )}
      </View>
    );
  };

  if (!user || !token) {
    return null;
  }

  if (teacherOneClassId) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + 60, alignItems: 'center' }]}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={[styles.loadingText, { marginTop: 16 }]}>Abrindo sua sala…</Text>
      </View>
    );
  }

  const scrollPadBottom = Math.max(insets.bottom, 12) + 24;

  if (hasStudentHome) {
    const dash = studentDash;
    const summary = dash?.summary;

    return (
      <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={[dashStyles.scrollPad, { paddingBottom: scrollPadBottom }]}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
          keyboardShouldPersistTaps="handled">
          <View style={styles.hero}>
            <Text style={styles.heroKicker}>Minha EBD</Text>
            <Text style={styles.heroTitle}>Olá, {user.name.split(' ')[0]} 👋</Text>
            <Text style={styles.heroSub}>{subtitle}</Text>
          </View>

          {dashLoading && !dash ? (
            <View style={dashStyles.loadingInline}>
              <ActivityIndicator color={ACCENT} />
            </View>
          ) : null}

          {dash ? (
            <>
              <View style={dashStyles.classCard}>
                <MaterialIcons name="class" size={28} color={ACCENT} />
                <View style={dashStyles.classCardText}>
                  <Text style={dashStyles.classCardLabel}>Sua turma</Text>
                  <Text style={dashStyles.classCardName} numberOfLines={2}>
                    {dash.className}
                  </Text>
                </View>
              </View>

              <View style={dashStyles.section}>
                <View style={dashStyles.sectionHead}>
                  <MaterialIcons name="workspace-premium" size={20} color={ACCENT} />
                  <Text style={dashStyles.sectionTitle}>Top 3 presença em aula</Text>
                </View>
                <Text style={dashStyles.sectionHint}>
                  Soma do combo em cada aula: presença + pontualidade + revista, bíblia, participação na lição e
                  oferta (não inclui pontos de quiz ou competição).
                </Text>
                {dash.topThree.length === 0 ? (
                  <View style={dashStyles.emptyBox}>
                    <Text style={dashStyles.emptyText}>
                      Ainda não há presenças registradas na turma para montar o ranking.
                    </Text>
                  </View>
                ) : (
                  <View style={dashStyles.podiumCard}>
                    {dash.topThree.map((row, i) => (
                      <PodiumRowHome key={row.userId} row={row} rank={i + 1} />
                    ))}
                  </View>
                )}
              </View>

              <View style={dashStyles.section}>
                <View style={dashStyles.sectionHead}>
                  <MaterialIcons name="event-available" size={20} color={ACCENT} />
                  <Text style={dashStyles.sectionTitle}>Suas presenças</Text>
                </View>
                {!summary ? (
                  <View style={dashStyles.emptyBox}>
                    <Text style={dashStyles.emptyText}>Não foi possível carregar o histórico agora.</Text>
                  </View>
                ) : (
                  <>
                    <View style={dashStyles.statsGrid}>
                      <View style={dashStyles.statMini}>
                        <Text style={dashStyles.statMiniVal}>{summary.presentCount}</Text>
                        <Text style={dashStyles.statMiniLbl}>Presente</Text>
                      </View>
                      <View style={dashStyles.statMini}>
                        <Text style={dashStyles.statMiniVal}>{summary.absentCount}</Text>
                        <Text style={dashStyles.statMiniLbl}>Ausente</Text>
                      </View>
                      <View style={dashStyles.statMini}>
                        <Text style={dashStyles.statMiniVal}>{summary.punctualCount}</Text>
                        <Text style={dashStyles.statMiniLbl}>Pontual</Text>
                      </View>
                      <View style={dashStyles.statMini}>
                        <Text style={dashStyles.statMiniVal}>{summary.totalRecorded}</Text>
                        <Text style={dashStyles.statMiniLbl}>Aulas registradas</Text>
                      </View>
                    </View>
                    {summary.totalRecorded > 0 ? (
                      <Text style={dashStyles.rateText}>
                        Taxa de presença:{' '}
                        {Math.round((summary.presentCount / summary.totalRecorded) * 100)}% nas aulas já
                        lançadas pelo professor.
                      </Text>
                    ) : (
                      <Text style={dashStyles.rateTextMuted}>
                        Quando o professor registrar sua presença nas aulas, os números aparecerão aqui.
                      </Text>
                    )}
                    {summary.lastRecords.length > 0 ? (
                      <View style={dashStyles.recentBlock}>
                        <Text style={dashStyles.recentLabel}>Últimas aulas</Text>
                        {summary.lastRecords.slice(0, 5).map((r, idx) => (
                          <View key={`${idx}-${r.recordedAt}`} style={dashStyles.recentRow}>
                            <View style={dashStyles.recentLeft}>
                              <Text style={dashStyles.recentTitle} numberOfLines={1}>
                                {r.lessonTitle}
                              </Text>
                              <Text style={dashStyles.recentSub}>
                                {new Date(r.startsAt).toLocaleDateString()} · Registro:{' '}
                                {new Date(r.recordedAt).toLocaleString()}
                              </Text>
                            </View>
                            <View
                              style={[
                                dashStyles.pillStatus,
                                r.present ? dashStyles.pillOk : dashStyles.pillBad,
                              ]}>
                              <Text style={dashStyles.pillStatusText}>{r.present ? 'Presente' : 'Ausente'}</Text>
                            </View>
                          </View>
                        ))}
                      </View>
                    ) : null}
                  </>
                )}
              </View>

              <Pressable
                style={styles.cta}
                onPress={() => user.classId && router.push(`/class/${user.classId}`)}>
                <Text style={styles.ctaText}>Abrir minha sala</Text>
              </Pressable>

              <Pressable
                style={[styles.ctaGhost, { marginTop: 10 }]}
                onPress={() => setShowExplorer((v) => !v)}>
                <Text style={styles.ctaGhostText}>
                  {showExplorer ? 'Ocultar salas da igreja' : 'Explorar outras salas da igreja'}
                </Text>
              </Pressable>
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          {showExplorer && hasStudentHome ? (
            <View style={{ marginTop: 16 }}>
              <View style={styles.searchWrap}>
                <IconSymbol name="magnifyingglass" size={20} color={MUTED} />
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Buscar sala por nome..."
                  placeholderTextColor={AppTheme.placeholder}
                  style={styles.searchInput}
                />
              </View>
              {filtered.map((item) => (
                <View key={item.id} style={[styles.card, { marginBottom: 12 }]}>
                  <View style={styles.cardTop}>
                    <View style={styles.avatar}>
                      <Text style={styles.avatarText}>{item.name.slice(0, 2).toUpperCase()}</Text>
                    </View>
                    <View style={styles.cardBody}>
                      <Text style={styles.cardTitle}>{item.name}</Text>
                      {item.id === user.classId ? (
                        <View style={[styles.badge, styles.badgeOk, { marginTop: 8 }]}>
                          <Text style={styles.badgeText}>Sua turma</Text>
                        </View>
                      ) : null}
                    </View>
                  </View>
                </View>
              ))}
              {filtered.length === 0 ? (
                <Text style={dashStyles.emptyText}>Nenhuma sala encontrada.</Text>
              ) : null}
            </View>
          ) : null}
        </ScrollView>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>EBD gamificado</Text>
        <Text style={styles.heroTitle}>Olá, {user.name.split(' ')[0]} 👋</Text>
        <Text style={styles.heroSub}>{subtitle}</Text>
        {user.role === 'student' && user.classId ? (
          <View style={[styles.heroChipMuted, { marginTop: 14, alignSelf: 'flex-start' }]}>
            <Text style={styles.heroChipMutedText}>Você está vinculado a uma sala</Text>
          </View>
        ) : null}
      </View>

      <View style={styles.searchWrap}>
        <IconSymbol name="magnifyingglass" size={20} color={MUTED} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Buscar sala por nome..."
          placeholderTextColor={AppTheme.placeholder}
          style={styles.searchInput}
        />
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {loading && !refreshing ? (
        <View style={styles.loadingBox}>
          <ActivityIndicator color={ACCENT} />
          <Text style={styles.loadingText}>Carregando salas inteligentes…</Text>
        </View>
      ) : null}

      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={ACCENT} />}
        ListEmptyComponent={
          !loading ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nenhuma sala encontrada</Text>
              <Text style={styles.emptyBody}>
                {query.trim()
                  ? 'Tente outro termo na busca ou puxe para atualizar.'
                  : 'Ainda não há turmas listadas para o seu perfil.'}
              </Text>
            </View>
          ) : null
        }
        renderItem={renderItem}
        showsVerticalScrollIndicator={false}
      />
    </View>
  );
}

const dashStyles = StyleSheet.create({
  scrollPad: {},
  loadingInline: { paddingVertical: 24, alignItems: 'center' },
  classCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    marginBottom: 18,
  },
  classCardText: { flex: 1, minWidth: 0 },
  classCardLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 4,
  },
  classCardName: {
    color: AppTheme.text,
    fontSize: 20,
    fontWeight: '900',
  },
  section: { marginBottom: 20 },
  sectionHead: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 6,
  },
  sectionTitle: {
    color: AppTheme.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionHint: {
    color: MUTED,
    fontSize: 12,
    lineHeight: 17,
    marginBottom: 10,
  },
  emptyBox: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: BORDER,
  },
  emptyText: { color: MUTED, fontSize: 13, textAlign: 'center' },
  podiumCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
    gap: 6,
  },
  podiumRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 6,
  },
  podiumRank: {
    width: 30,
    height: 30,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: AppTheme.bgElevated,
  },
  podiumRankText: { fontSize: 14, fontWeight: '900' },
  podiumName: { flex: 1, color: AppTheme.text, fontSize: 15, fontWeight: '700' },
  podiumPts: { color: ACCENT, fontSize: 13, fontWeight: '800' },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    marginBottom: 12,
  },
  statMini: {
    width: '47%',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 12,
  },
  statMiniVal: {
    color: AppTheme.text,
    fontSize: 22,
    fontWeight: '900',
  },
  statMiniLbl: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '700',
    marginTop: 4,
  },
  rateText: {
    color: AppTheme.textSecondary,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  rateTextMuted: {
    color: MUTED,
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 14,
  },
  recentBlock: { marginTop: 4 },
  recentLabel: {
    color: MUTED,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.8,
    marginBottom: 10,
  },
  recentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  recentLeft: { flex: 1, minWidth: 0 },
  recentTitle: { color: AppTheme.text, fontSize: 14, fontWeight: '700' },
  recentSub: { color: MUTED, fontSize: 11, marginTop: 3 },
  pillStatus: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  pillOk: { backgroundColor: AppTheme.successMuted },
  pillBad: { backgroundColor: AppTheme.dangerMuted },
  pillStatusText: {
    fontSize: 10,
    fontWeight: '900',
    textTransform: 'uppercase',
    color: AppTheme.textSecondary,
  },
});

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: BG,
    paddingHorizontal: 18,
  },
  hero: {
    padding: 18,
    borderRadius: 22,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  heroKicker: {
    color: ACCENT,
    fontWeight: '800',
    fontSize: 12,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: {
    color: AppTheme.text,
    fontSize: 26,
    fontWeight: '900',
  },
  heroSub: {
    color: MUTED,
    marginTop: 8,
    lineHeight: 20,
    fontSize: 14,
  },
  heroChipMuted: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: AppTheme.cardHover,
    borderWidth: 1,
    borderColor: BORDER,
  },
  heroChipMutedText: {
    color: MUTED,
    fontWeight: '700',
    fontSize: 13,
  },
  searchWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    color: AppTheme.textSecondary,
    fontSize: 16,
  },
  error: {
    color: AppTheme.danger,
    marginBottom: 8,
  },
  loadingBox: {
    alignItems: 'center',
    paddingVertical: 20,
    gap: 10,
  },
  loadingText: {
    color: MUTED,
    fontSize: 14,
  },
  listContent: {
    paddingBottom: 32,
    gap: 12,
  },
  card: {
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  cardHighlight: {
    borderColor: 'rgba(89, 244, 168, 0.45)',
    shadowColor: ACCENT,
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
  cardTop: {
    flexDirection: 'row',
    gap: 12,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 14,
    backgroundColor: AppTheme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: ACCENT,
    fontWeight: '900',
    fontSize: 16,
  },
  cardBody: {
    flex: 1,
    minWidth: 0,
  },
  cardTitle: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: '800',
  },
  cardMeta: {
    color: AppTheme.mutedDark,
    fontSize: 12,
    marginTop: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    backgroundColor: AppTheme.cardHover,
  },
  badgeOk: { backgroundColor: AppTheme.successMuted },
  badgeWarn: { backgroundColor: AppTheme.accentMuted },
  badgeBad: { backgroundColor: AppTheme.dangerMuted },
  badgeText: {
    color: AppTheme.textSecondary,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  cta: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaDisabled: { opacity: 0.55 },
  ctaText: {
    color: AppTheme.onAccent,
    fontWeight: '900',
    fontSize: 15,
  },
  ctaGhost: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: AppTheme.inputBg,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: AppTheme.inputBorder,
  },
  ctaGhostText: {
    color: AppTheme.textSecondary,
    fontWeight: '800',
    fontSize: 14,
  },
  empty: {
    padding: 28,
    alignItems: 'center',
  },
  emptyTitle: {
    color: AppTheme.textSecondary,
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 6,
  },
  emptyBody: {
    color: MUTED,
    textAlign: 'center',
    lineHeight: 20,
  },
});
