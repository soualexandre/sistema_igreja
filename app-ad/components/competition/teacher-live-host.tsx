import { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { formatRankingRowSummary } from '@/lib/quiz-ranking-display';
import { realtimeApi, type RealtimeQuestionDto, type SessionStatePayload } from '@/lib/realtime-api';
import { AppTheme } from '@/constants/app-theme';
import { KAHOOT } from '@/constants/kahoot-quiz';

const SCREEN_PAD_H = 22;

type ClassOption = { id: string; name: string };

type Props = {
  token: string;
  competitionId: string;
  competitionName: string;
  /** Turmas onde o professor pode jogar (ou todas para admin). */
  pickableClasses: ClassOption[];
  /** Já inclui safe area top (ex.: insets.top + 8) */
  topInset: number;
  onSessionEnded?: () => void;
};

export function TeacherLiveHost({
  token,
  competitionId,
  competitionName,
  pickableClasses,
  topInset,
  onSessionEnded,
}: Props) {
  const [questions, setQuestions] = useState<RealtimeQuestionDto[]>([]);
  const [loadingQs, setLoadingQs] = useState(false);
  const [session, setSession] = useState<SessionStatePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);

  useEffect(() => {
    if (pickableClasses.length === 1) {
      setSelectedClassId(pickableClasses[0]!.id);
    } else if (pickableClasses.length === 0) {
      setSelectedClassId(null);
    } else {
      setSelectedClassId((prev) =>
        prev && pickableClasses.some((c) => c.id === prev) ? prev : null,
      );
    }
  }, [pickableClasses]);

  const selectedClassName = useMemo(() => {
    if (session) {
      return (
        pickableClasses.find((c) => c.id === session.session.classId)?.name ?? 'Turma'
      );
    }
    return pickableClasses.find((c) => c.id === selectedClassId)?.name ?? '';
  }, [pickableClasses, selectedClassId, session]);

  const fetchQuestions = useCallback(async () => {
    if (!token || !competitionId) return;
    try {
      setLoadingQs(true);
      setError(null);
      const qs = await realtimeApi.listQuestions(token, { competitionId });
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perguntas');
    } finally {
      setLoadingQs(false);
    }
  }, [token, competitionId]);

  useEffect(() => {
    void fetchQuestions();
  }, [fetchQuestions]);

  useEffect(() => {
    if (!session?.session.id || !token) return;
    const id = setInterval(async () => {
      try {
        const s = await realtimeApi.getSessionState(token, session.session.id);
        setSession(s);
      } catch {
        /* ignore */
      }
    }, 1600);
    return () => clearInterval(id);
  }, [session?.session.id, token]);

  const startGame = async () => {
    if (!selectedClassId || !questions.length) {
      setError(
        !questions.length
          ? 'Adicione perguntas na aba Perguntas antes de iniciar.'
          : 'Selecione em qual turma esta rodada será jogada (PIN vale só para alunos dessa turma).',
      );
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const ids = questions.map((q) => q.id);
      const created = await realtimeApi.startSession(token, {
        competitionId,
        classId: selectedClassId,
        questionIds: ids,
      });
      const full = await realtimeApi.getSessionState(token, created.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao iniciar');
    } finally {
      setBusy(false);
    }
  };

  const pause = async () => {
    if (!session) return;
    try {
      setBusy(true);
      const full = await realtimeApi.pauseSession(token, session.session.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao pausar');
    } finally {
      setBusy(false);
    }
  };

  const resume = async () => {
    if (!session) return;
    try {
      setBusy(true);
      const full = await realtimeApi.resumeSession(token, session.session.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao retomar');
    } finally {
      setBusy(false);
    }
  };

  const beginQuestions = async () => {
    if (!session) return;
    try {
      setBusy(true);
      setError(null);
      await realtimeApi.nextQuestion(token, session.session.id);
      const full = await realtimeApi.getSessionState(token, session.session.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao iniciar perguntas');
    } finally {
      setBusy(false);
    }
  };

  const end = async () => {
    if (!session) return;
    try {
      setBusy(true);
      await realtimeApi.endSession(token, session.session.id);
      const full = await realtimeApi.getSessionState(token, session.session.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao encerrar');
    } finally {
      setBusy(false);
    }
  };

  const reset = () => {
    setSession(null);
    onSessionEnded?.();
  };

  if (!session) {
    const noClasses = pickableClasses.length === 0;
    const canStart =
      questions.length > 0 && !!selectedClassId && !noClasses && !busy;

    return (
      <ScrollView
        style={styles.screen}
        contentContainerStyle={{
          paddingTop: topInset + 12,
          paddingBottom: 32,
          paddingHorizontal: SCREEN_PAD_H,
        }}>
        <Text style={styles.kicker}>Ao vivo · {competitionName}</Text>
        <Text style={styles.title}>Iniciar rodada</Text>
        <Text style={styles.sub}>
          Gere o PIN e aguarde os alunos entrarem (aba Competição no modo aluno). O PIN vale apenas para a turma
          escolhida abaixo. Quando você iniciar as perguntas, a sala fecha para novas entradas.
        </Text>

        {noClasses ? (
          <Text style={styles.warnBox}>
            Não há turmas disponíveis para você nesta igreja. Peça ao administrador para vincular você a uma turma
            como professor.
          </Text>
        ) : pickableClasses.length > 1 ? (
          <View style={styles.classPick}>
            <Text style={styles.classPickLabel}>Onde jogar (turma do PIN)</Text>
            <View style={styles.chipRow}>
              {pickableClasses.map((c) => (
                <Pressable
                  key={c.id}
                  onPress={() => setSelectedClassId(c.id)}
                  style={[
                    styles.chip,
                    selectedClassId === c.id && styles.chipOn,
                  ]}>
                  <Text
                    style={[
                      styles.chipText,
                      selectedClassId === c.id && styles.chipTextOn,
                    ]}
                    numberOfLines={1}>
                    {c.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : (
          <Text style={styles.singleClassHint}>
            Turma: <Text style={styles.singleClassStrong}>{selectedClassName}</Text>
          </Text>
        )}

        {loadingQs ? <ActivityIndicator style={{ marginTop: 16 }} color={KAHOOT.lime} /> : null}
        <View style={styles.statCard}>
          <Text style={styles.statValue}>{questions.length}</Text>
          <Text style={styles.statLabel}>pergunta(s) nesta competição</Text>
        </View>

        {error ? <Text style={styles.err}>{error}</Text> : null}

        <Pressable
          style={[styles.primary, !canStart && styles.primaryDisabled]}
          disabled={!canStart}
          onPress={() => void startGame()}>
          {busy ? (
            <ActivityIndicator color={AppTheme.onAccent} />
          ) : (
            <Text style={styles.primaryText}>Gerar PIN da sala</Text>
          )}
        </Pressable>
      </ScrollView>
    );
  }

  const bigCode = session.session.code;
  const ranking = session.ranking;
  const statusLabel =
    session.session.status === 'paused'
      ? 'pausada'
      : session.session.status === 'running'
        ? 'em andamento'
        : session.session.status === 'waiting'
          ? 'aguardando'
          : session.session.status;
  const canPause =
    session.session.status === 'running' && !!session.currentQuestion;
  const canResume = session.session.status === 'paused';
  const canBeginQuestions = session.session.status === 'waiting';

  return (
    <ScrollView
      style={styles.liveScreen}
      contentContainerStyle={{
        paddingTop: topInset + 12,
        paddingBottom: 40,
        paddingHorizontal: SCREEN_PAD_H,
      }}>
      <Text style={styles.pinLabel}>PIN da sala</Text>
      <Text style={styles.pin}>{bigCode}</Text>
      <Text style={styles.meta}>
        {selectedClassName} · {statusLabel} · {session.session.participantCount ?? 0} jogadores
      </Text>

      {session.currentQuestion ? (
        <View style={styles.qCard}>
          <Text style={styles.qLabel}>Pergunta atual</Text>
          <Text style={styles.qText}>{session.currentQuestion.statement}</Text>
        </View>
      ) : session.session.status === 'finished' ? null : session.session.status === 'waiting' ? (
        <View style={styles.waitingCard}>
          <Text style={styles.waitingCardTitle}>Sala aberta</Text>
          <Text style={styles.waitingCardBody}>
            Os alunos podem entrar com o PIN. Quando você tocar em “Iniciar perguntas”, a competição começa e{' '}
            <Text style={styles.waitingCardStrong}>ninguém mais consegue entrar</Text> nesta sala.
          </Text>
        </View>
      ) : (
        <Text style={styles.waiting}>Carregando rodada…</Text>
      )}

      {error ? <Text style={styles.errLight}>{error}</Text> : null}

      <View style={styles.actions}>
        {session.session.status !== 'finished' ? (
          <>
            {canBeginQuestions ? (
              <Pressable style={styles.secondary} disabled={busy} onPress={() => void beginQuestions()}>
                <Text style={styles.secondaryText}>{busy ? '…' : 'Iniciar perguntas'}</Text>
              </Pressable>
            ) : null}
            {canPause ? (
              <Pressable style={styles.secondaryMuted} disabled={busy} onPress={() => void pause()}>
                <Text style={styles.secondaryMutedText}>{busy ? '…' : 'Pausar rodada'}</Text>
              </Pressable>
            ) : null}
            {canResume ? (
              <Pressable style={styles.secondary} disabled={busy} onPress={() => void resume()}>
                <Text style={styles.secondaryText}>{busy ? '…' : 'Continuar'}</Text>
              </Pressable>
            ) : null}
            <Pressable style={styles.danger} disabled={busy} onPress={() => void end()}>
              <Text style={styles.dangerText}>Encerrar sessão</Text>
            </Pressable>
          </>
        ) : (
          <Pressable style={styles.secondary} onPress={reset}>
            <Text style={styles.secondaryText}>Nova sessão</Text>
          </Pressable>
        )}
      </View>

      <Text style={styles.rankTitle}>Ranking · tempo nas corretas</Text>
      {ranking.slice(0, 10).map((row, i) => {
        const { main, sub } = formatRankingRowSummary(row);
        return (
          <View key={row.userId} style={styles.rankRow}>
            <Text style={styles.rankPos}>{i + 1}</Text>
            <Text style={styles.rankName} numberOfLines={1}>
              {row.name}
            </Text>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.rankPts}>{main}</Text>
              {sub ? <Text style={styles.rankSub}>{sub}</Text> : null}
            </View>
          </View>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: AppTheme.bg },
  liveScreen: { flex: 1, backgroundColor: KAHOOT.bg },
  kicker: { color: KAHOOT.lime, fontWeight: '800', fontSize: 12, letterSpacing: 1 },
  title: { color: '#F8FAFC', fontSize: 24, fontWeight: '900', marginTop: 8 },
  sub: { color: '#94A3B8', marginTop: 10, lineHeight: 20, marginBottom: 16 },
  warnBox: {
    color: AppTheme.dangerTextBright,
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderRadius: 12,
    padding: 14,
    marginBottom: 16,
    lineHeight: 20,
    fontSize: 14,
  },
  classPick: { marginBottom: 16 },
  classPickLabel: { color: KAHOOT.lime, fontWeight: '800', marginBottom: 10, fontSize: 13 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: AppTheme.border,
    backgroundColor: AppTheme.card,
    maxWidth: '100%',
  },
  chipOn: { borderColor: KAHOOT.lime, backgroundColor: 'rgba(163, 230, 53, 0.15)' },
  chipText: { color: '#94A3B8', fontWeight: '700', fontSize: 14, maxWidth: 280 },
  chipTextOn: { color: KAHOOT.lime },
  singleClassHint: { color: '#94A3B8', marginBottom: 16, fontSize: 14 },
  singleClassStrong: { color: KAHOOT.white, fontWeight: '800' },
  statCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    padding: 18,
    borderWidth: 1,
    borderColor: AppTheme.border,
    alignItems: 'center',
    marginBottom: 20,
  },
  statValue: { color: KAHOOT.lime, fontSize: 36, fontWeight: '900' },
  statLabel: { color: '#94A3B8', marginTop: 4, textAlign: 'center' },
  err: { color: AppTheme.danger, marginBottom: 12 },
  errLight: { color: AppTheme.dangerTextBright, textAlign: 'center', marginBottom: 8 },
  primary: {
    backgroundColor: KAHOOT.lime,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  primaryDisabled: { opacity: 0.5 },
  primaryText: { color: AppTheme.onAccent, fontWeight: '900', fontSize: 17 },
  pinLabel: { color: KAHOOT.muted, textAlign: 'center' },
  pin: {
    color: KAHOOT.white,
    fontSize: 48,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 8,
    marginVertical: 8,
  },
  meta: { color: KAHOOT.muted, textAlign: 'center', marginBottom: 16 },
  qCard: {
    marginHorizontal: 0,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 16,
    padding: 16,
    marginBottom: 12,
  },
  qLabel: { color: KAHOOT.lime, fontWeight: '800', marginBottom: 6 },
  qText: { color: KAHOOT.white, fontSize: 16, lineHeight: 22 },
  waiting: { color: KAHOOT.muted, textAlign: 'center', marginBottom: 16 },
  waitingCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 16,
    marginBottom: 16,
  },
  waitingCardTitle: { color: KAHOOT.lime, fontWeight: '900', fontSize: 16, marginBottom: 8 },
  waitingCardBody: { color: KAHOOT.muted, lineHeight: 22, fontSize: 14 },
  waitingCardStrong: { color: KAHOOT.white, fontWeight: '800' },
  actions: { gap: 10, marginHorizontal: 0, marginTop: 8 },
  secondary: {
    backgroundColor: KAHOOT.lime,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  secondaryText: { color: AppTheme.onAccent, fontWeight: '900' },
  secondaryMuted: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: KAHOOT.muted,
    backgroundColor: 'rgba(148, 163, 184, 0.12)',
  },
  secondaryMutedText: { color: KAHOOT.white, fontWeight: '800' },
  danger: {
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppTheme.dangerBorder,
    backgroundColor: AppTheme.dangerMuted,
  },
  dangerText: { color: AppTheme.dangerTextBright, fontWeight: '800' },
  rankTitle: {
    color: KAHOOT.white,
    fontWeight: '800',
    marginHorizontal: 0,
    marginTop: 24,
    marginBottom: 10,
  },
  rankRow: {
    flexDirection: 'row',
    marginHorizontal: 0,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: AppTheme.border,
    gap: 10,
  },
  rankPos: { color: KAHOOT.lime, fontWeight: '900', width: 28 },
  rankName: { flex: 1, color: KAHOOT.white, fontWeight: '600' },
  rankPts: { color: KAHOOT.lime, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankSub: { color: KAHOOT.muted, fontWeight: '600', fontSize: 10, marginTop: 2 },
});
