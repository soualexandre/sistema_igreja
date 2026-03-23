import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuizSocket } from '@/hooks/use-quiz-socket';
import { formatRankingRowSummary } from '@/lib/quiz-ranking-display';
import { realtimeApi, type AnswerAck, type SessionStatePayload } from '@/lib/realtime-api';
import { AppTheme } from '@/constants/app-theme';
import { KAHOOT, KAHOOT_ANSWER_SLOTS } from '@/constants/kahoot-quiz';

function normalizeCode(raw: string) {
  return raw.replace(/[^a-zA-Z0-9]/g, '').slice(0, 8).toUpperCase();
}

function useNowTick(active: boolean, endsAt: number | null) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active || !endsAt) return;
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, [active, endsAt]);
  return now;
}

/** Layout responsivo: 2 opções em coluna; 3–4 em grade 2 colunas (estilo Kahoot). */
function optionLayoutStyle(count: number, index: number) {
  if (count <= 2) {
    return { width: '100%' as const };
  }
  if (count === 3) {
    if (index < 2) return { width: '48%' as const };
    return { width: '100%' as const };
  }
  return { width: '48%' as const };
}

export function StudentLiveFlow({
  token,
  userId,
  name,
}: {
  token: string;
  userId: string;
  name: string;
}) {
  const insets = useSafeAreaInsets();
  const [pin, setPin] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [lastAck, setLastAck] = useState<AnswerAck | null>(null);

  const sessionId = state?.session.id ?? null;
  const codeNormalized = useMemo(() => normalizeCode(pin), [pin]);

  const applyState = useCallback((payload: SessionStatePayload) => {
    setState(payload);
    setError(null);
  }, []);

  const { connected, emitJoin } = useQuizSocket({
    token,
    enabled: !!sessionId,
    onState: applyState,
  });

  useEffect(() => {
    if (!sessionId || !token) return;
    let id: ReturnType<typeof setInterval> | undefined;
    const tick = async () => {
      try {
        const fresh = await realtimeApi.getSessionState(token, sessionId);
        applyState(fresh);
        if (fresh.session.status === 'finished' && id !== undefined) {
          clearInterval(id);
        }
      } catch {
        /* ignore */
      }
    };
    void tick();
    id = setInterval(() => void tick(), 2000);
    return () => {
      if (id !== undefined) clearInterval(id);
    };
  }, [sessionId, token, applyState]);

  const currentQ = state?.currentQuestion ?? null;
  const endsAt = state?.session.currentQuestionEndsAt ?? null;
  const timerActive = state?.session.status === 'running' && !!currentQ;
  const now = useNowTick(timerActive, endsAt);

  const progress =
    currentQ && state?.session.currentQuestionStartedAt != null && endsAt
      ? Math.max(
          0,
          Math.min(1, (endsAt - now) / (endsAt - state.session.currentQuestionStartedAt!)),
        )
      : 0;

  const currentQuestionId =
    state && state.session.currentQuestionIndex >= 0
      ? state.session.questionIds[state.session.currentQuestionIndex]
      : null;

  useEffect(() => {
    setLastAck(null);
  }, [currentQuestionId]);

  const alreadyAnswered =
    !!currentQuestionId &&
    !!state &&
    state.session.answersByQuestion[currentQuestionId]?.[userId] !== undefined;

  const onEnterPin = async () => {
    if (codeNormalized.length < 4) {
      setError('Digite o código da sala (PIN).');
      return;
    }
    try {
      setBusy(true);
      setError(null);
      const payload = await realtimeApi.joinSession(token, codeNormalized);
      applyState(payload);
      try {
        const viaSocket = await emitJoin(codeNormalized);
        if (viaSocket) applyState(viaSocket);
      } catch {
        /* ok */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível entrar');
      setState(null);
    } finally {
      setBusy(false);
    }
  };

  const onPickOption = async (index: number) => {
    if (!state || !currentQ || alreadyAnswered) return;
    try {
      setBusy(true);
      const ack = await realtimeApi.answerQuestion(token, state.session.id, index);
      setLastAck(ack);
      const fresh = await realtimeApi.getSessionState(token, state.session.id);
      applyState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao enviar resposta');
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    setState(null);
    setPin('');
    setError(null);
  };

  if (!state) {
    const pinPadH = Math.max(24, insets.left + 16, insets.right + 16);
    return (
      <ScrollView
        style={styles.screenDark}
        contentContainerStyle={[
          styles.pinScroll,
          {
            paddingTop: insets.top + 28,
            paddingBottom: 32 + insets.bottom,
            paddingHorizontal: pinPadH,
          },
        ]}>
        <Text style={styles.kahootLogo}>COMPETIÇÃO</Text>
        <Text style={styles.pinHint}>Digite o PIN da sala</Text>
        <TextInput
          value={pin}
          onChangeText={(t) => setPin(normalizeCode(t))}
          placeholder="ex: AB12CD"
          placeholderTextColor={AppTheme.placeholder}
          autoCapitalize="characters"
          style={styles.pinInput}
          maxLength={8}
        />
        {error ? <Text style={styles.errLight}>{error}</Text> : null}
        <Pressable
          style={[styles.pinCta, busy && styles.pinCtaDisabled]}
          onPress={() => void onEnterPin()}
          disabled={busy}>
          {busy ? <ActivityIndicator color={AppTheme.onAccent} /> : <Text style={styles.pinCtaText}>Entrar</Text>}
        </Pressable>
        <Text style={styles.pinFootnote}>O professor inicia o jogo e exibe o PIN na sala.</Text>
      </ScrollView>
    );
  }

  const { session, ranking } = state;

  if (session.status === 'waiting' || (session.status === 'running' && !currentQ)) {
    return (
      <View style={styles.screenDark}>
        <View
          style={[
            styles.lobbyTop,
            {
              paddingTop: insets.top + 20,
              paddingLeft: Math.max(24, insets.left + 16),
              paddingRight: Math.max(24, insets.right + 16),
            },
          ]}>
          <Text style={styles.lobbyHi}>Olá, {name.split(' ')[0]}!</Text>
          <Text style={styles.lobbySub}>Sala {session.code}</Text>
          <View style={styles.connPill}>
            <View style={[styles.dot, connected ? styles.dotOn : styles.dotOff]} />
            <Text style={styles.connText}>{connected ? 'Ao vivo' : 'Conectando…'}</Text>
          </View>
        </View>
        <View
          style={[
            styles.lobbyCard,
            {
              marginLeft: Math.max(20, insets.left + 12),
              marginRight: Math.max(20, insets.right + 12),
            },
          ]}>
          <Text style={styles.lobbyTitle}>Aguardando o professor…</Text>
          <Text style={styles.lobbyBody}>
            Quando a pergunta aparecer, toque na opção desejada. O tempo passa sozinho entre as perguntas; você não verá
            se acertou até o fim do jogo.
          </Text>
        </View>
        <Pressable
          style={[
            styles.leaveBtn,
            {
              marginLeft: Math.max(20, insets.left + 12),
              marginRight: Math.max(20, insets.right + 12),
              marginBottom: insets.bottom + 8,
            },
          ]}
          onPress={onLeave}>
          <Text style={styles.leaveBtnText}>Sair da sala</Text>
        </Pressable>
      </View>
    );
  }

  if (session.status === 'finished') {
    return (
      <View style={styles.screenDark}>
        <Text
          style={[
            styles.finishTitle,
            {
              marginTop: insets.top + 32,
              paddingHorizontal: Math.max(16, insets.left + 8, insets.right + 8),
            },
          ]}>
          Fim de jogo!
        </Text>
        <Text
          style={[
            styles.finishSub,
            { paddingHorizontal: Math.max(16, insets.left + 8, insets.right + 8) },
          ]}>
          Ranking · soma do tempo nas respostas corretas
        </Text>
        <FlatList
          data={ranking}
          keyExtractor={(item) => item.userId}
          contentContainerStyle={{
            paddingHorizontal: Math.max(20, insets.left + 12, insets.right + 12),
            paddingBottom: 40 + insets.bottom,
          }}
          renderItem={({ item, index }) => {
            const { main, sub } = formatRankingRowSummary(item);
            return (
              <View style={[styles.rankRow, item.userId === userId && styles.rankRowMe]}>
                <Text style={styles.rankPos}>{index + 1}º</Text>
                <Text style={styles.rankName} numberOfLines={1}>
                  {item.name}
                </Text>
                <View style={{ alignItems: 'flex-end' }}>
                  <Text style={styles.rankPts}>{main}</Text>
                  {sub ? <Text style={styles.rankSub}>{sub}</Text> : null}
                </View>
              </View>
            );
          }}
        />
        <Pressable
          style={[
            styles.leaveBtn,
            {
              marginLeft: Math.max(20, insets.left + 12),
              marginRight: Math.max(20, insets.right + 12),
              marginBottom: insets.bottom + 8,
            },
          ]}
          onPress={onLeave}>
          <Text style={styles.leaveBtnText}>Jogar de novo</Text>
        </Pressable>
      </View>
    );
  }

  const n = currentQ?.options.length ?? 0;

  /** Barra de tempo abaixo do notch; pergunta com respiro extra para câmera/Dynamic Island */
  const playPadH = Math.max(16, insets.left + 12, insets.right + 12);

  return (
    <View style={[styles.playRoot, { paddingTop: insets.top }]}>
      <View style={styles.timerBarTrack}>
        <View style={[styles.timerBarFill, { width: `${progress * 100}%` }]} />
      </View>
      <ScrollView
        contentContainerStyle={[
          styles.playScroll,
          {
            paddingTop: 24,
            paddingHorizontal: playPadH,
            paddingBottom: 40 + insets.bottom,
          },
        ]}>
        <Text style={styles.statement}>{currentQ?.statement}</Text>

        <View style={styles.legendRow}>
          {KAHOOT_ANSWER_SLOTS.slice(0, n).map((slot) => (
            <View key={slot.letter} style={styles.legendItem}>
              <Text style={[styles.legendShape, { color: slot.bg }]}>{slot.shape}</Text>
              <Text style={styles.legendText}>{slot.name}</Text>
            </View>
          ))}
        </View>

        <Text style={styles.tapHint}>Toque na cor da resposta certa</Text>

        {lastAck?.accepted === true ? (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackTitle}>Resposta registrada</Text>
            <Text style={styles.feedbackPts}>Aguarde o fim do tempo ou a próxima pergunta.</Text>
          </View>
        ) : lastAck?.accepted === false && lastAck.reason ? (
          <View style={styles.feedbackBox}>
            <Text style={styles.feedbackTitle}>Não contou</Text>
            <Text style={styles.feedbackPts}>{lastAck.reason}</Text>
          </View>
        ) : null}

        <View style={styles.optionsWrap}>
          {currentQ?.options.map((label, index) => {
            const slot = KAHOOT_ANSWER_SLOTS[index] ?? KAHOOT_ANSWER_SLOTS[0]!;
            const disabled = alreadyAnswered || busy || now > (endsAt ?? 0);
            const layout = optionLayoutStyle(n, index);
            return (
              <Pressable
                key={`${currentQ.id}-${index}`}
                onPress={() => void onPickOption(index)}
                disabled={disabled}
                style={({ pressed }) => [
                  styles.optionTile,
                  layout,
                  { backgroundColor: slot.bg },
                  pressed && !disabled ? styles.optionPressed : null,
                  disabled ? styles.optionDisabled : null,
                ]}>
                <View style={styles.optionTileInner}>
                  <Text style={styles.optionLetter}>{slot.letter}</Text>
                  <Text style={styles.optionShape}>{slot.shape}</Text>
                  <Text style={styles.optionLabel}>{label}</Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {alreadyAnswered ? (
          <Text style={styles.waitingOthers}>Resposta enviada. Aguarde a próxima pergunta…</Text>
        ) : null}
        {error ? <Text style={styles.errDark}>{error}</Text> : null}

        <Pressable style={styles.leaveBtnDark} onPress={onLeave}>
          <Text style={styles.leaveBtnTextDark}>Sair</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screenDark: { flex: 1, backgroundColor: KAHOOT.bg },
  pinScroll: { alignItems: 'center', flexGrow: 1 },
  kahootLogo: {
    color: KAHOOT.lime,
    fontSize: 22,
    fontWeight: '900',
    letterSpacing: 2,
    marginBottom: 8,
  },
  pinHint: { color: KAHOOT.white, fontSize: 20, fontWeight: '700', marginBottom: 16 },
  pinInput: {
    width: '100%',
    maxWidth: 320,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 18,
    fontSize: 28,
    fontWeight: '800',
    color: KAHOOT.white,
    textAlign: 'center',
    letterSpacing: 4,
    marginBottom: 16,
  },
  pinCta: {
    backgroundColor: KAHOOT.lime,
    paddingVertical: 16,
    paddingHorizontal: 48,
    borderRadius: 14,
    minWidth: 200,
    alignItems: 'center',
  },
  pinCtaDisabled: { opacity: 0.65 },
  pinCtaText: { color: AppTheme.onAccent, fontSize: 18, fontWeight: '900' },
  pinFootnote: { color: KAHOOT.muted, marginTop: 24, textAlign: 'center', fontSize: 13 },
  errLight: { color: AppTheme.dangerTextBright, marginBottom: 8, textAlign: 'center' },
  errDark: { color: AppTheme.danger, marginTop: 8, textAlign: 'center' },

  lobbyTop: { paddingBottom: 24 },
  lobbyHi: { color: KAHOOT.white, fontSize: 26, fontWeight: '800' },
  lobbySub: { color: KAHOOT.muted, marginTop: 6, fontSize: 16 },
  connPill: {
    marginTop: 14,
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: AppTheme.card,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotOn: { backgroundColor: KAHOOT.lime },
  dotOff: { backgroundColor: AppTheme.danger },
  connText: { color: KAHOOT.white, fontWeight: '600', fontSize: 13 },
  lobbyCard: {
    backgroundColor: AppTheme.card,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: AppTheme.border,
    padding: 20,
  },
  lobbyTitle: { color: KAHOOT.white, fontSize: 18, fontWeight: '800', marginBottom: 8 },
  lobbyBody: { color: KAHOOT.muted, lineHeight: 20 },
  leaveBtn: {
    marginTop: 32,
    marginHorizontal: 20,
    borderWidth: 1,
    borderColor: AppTheme.borderStrong,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  leaveBtnText: { color: KAHOOT.white, fontWeight: '700' },

  finishTitle: {
    color: KAHOOT.white,
    fontSize: 28,
    fontWeight: '900',
    textAlign: 'center',
  },
  finishSub: { color: KAHOOT.muted, textAlign: 'center', marginTop: 8, marginBottom: 20 },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    backgroundColor: AppTheme.card,
    borderWidth: 1,
    borderColor: AppTheme.border,
    marginBottom: 8,
    gap: 10,
  },
  rankRowMe: { borderWidth: 2, borderColor: KAHOOT.lime },
  rankPos: { color: KAHOOT.lime, fontWeight: '900', width: 36 },
  rankName: { flex: 1, color: KAHOOT.white, fontWeight: '600' },
  rankPts: { color: KAHOOT.lime, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankSub: { color: KAHOOT.muted, fontWeight: '600', fontSize: 10, marginTop: 2 },

  playRoot: { flex: 1, backgroundColor: AppTheme.bg },
  timerBarTrack: { height: 12, backgroundColor: AppTheme.border },
  timerBarFill: { height: '100%', backgroundColor: AppTheme.accent },
  playScroll: {},
  statement: {
    fontSize: 22,
    fontWeight: '800',
    color: AppTheme.text,
    textAlign: 'center',
    marginBottom: 20,
    lineHeight: 30,
    maxWidth: 720,
    alignSelf: 'center',
  },
  legendRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'center',
    gap: 12,
    marginBottom: 8,
  },
  legendItem: { alignItems: 'center', minWidth: 64 },
  legendShape: { fontSize: 20, fontWeight: '900' },
  legendText: { color: AppTheme.muted, fontSize: 11, fontWeight: '700', marginTop: 2 },

  tapHint: {
    textAlign: 'center',
    color: AppTheme.muted,
    fontWeight: '800',
    fontSize: 13,
    marginBottom: 16,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },

  feedbackBox: {
    backgroundColor: AppTheme.accentMuted,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: AppTheme.accentBorder,
  },
  feedbackTitle: { fontSize: 18, fontWeight: '900', color: AppTheme.accent },
  feedbackPts: { marginTop: 4, color: AppTheme.textSecondary, fontWeight: '700' },

  optionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 12,
  },
  optionTile: {
    minHeight: 104,
    borderRadius: 18,
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: 'rgba(248, 250, 252, 0.2)',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 5 },
    elevation: 6,
  },
  optionTileInner: { paddingVertical: 14, paddingHorizontal: 14 },
  optionLetter: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    fontWeight: '900',
    marginBottom: 4,
  },
  optionShape: { color: 'rgba(255,255,255,0.95)', fontSize: 26, fontWeight: '900', marginBottom: 6 },
  optionLabel: { color: '#fff', fontSize: 17, fontWeight: '800', lineHeight: 22 },
  optionPressed: { opacity: 0.92, transform: [{ scale: 0.98 }] },
  optionDisabled: { opacity: 0.45 },
  waitingOthers: { marginTop: 20, textAlign: 'center', color: AppTheme.muted, fontWeight: '600' },
  leaveBtnDark: {
    marginTop: 28,
    alignSelf: 'center',
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  leaveBtnTextDark: { color: AppTheme.muted, fontWeight: '700' },
});
