import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '@/constants/app-theme';
import { KAHOOT_ANSWER_SLOTS, TIMER_PRESETS } from '@/constants/kahoot-quiz';
import { realtimeApi, type RealtimeQuestionDto } from '@/lib/realtime-api';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

type WizardStep = 'statement' | 'answers' | 'correct' | 'timer' | 'review';

type Draft = {
  statement: string;
  options: [string, string, string, string];
  correctOptionIndex: number;
  timeLimitSeconds: number;
};

const STEPS: WizardStep[] = ['statement', 'answers', 'correct', 'timer', 'review'];

function emptyDraft(): Draft {
  return {
    statement: '',
    options: ['', '', '', ''],
    correctOptionIndex: 0,
    timeLimitSeconds: 20,
  };
}

function buildOptionsForApi(slots: [string, string, string, string]): {
  options: string[];
  lastIndex: number;
} {
  const trimmed = slots.map((s) => s.trim()) as [string, string, string, string];
  let last = -1;
  for (let i = trimmed.length - 1; i >= 0; i--) {
    if (trimmed[i] !== '') {
      last = i;
      break;
    }
  }
  if (last < 1) {
    throw new Error('Preencha pelo menos duas respostas (A e B).');
  }
  for (let i = 0; i <= last; i++) {
    if (trimmed[i] === '') {
      throw new Error('Preencha as respostas em ordem: não deixe espaços vazios entre elas.');
    }
  }
  return { options: trimmed.slice(0, last + 1), lastIndex: last };
}

type Props = {
  token: string;
  competitionId: string;
  competitionName: string;
  topInset: number;
  onQuestionsChanged?: () => void;
};

export function TeacherQuestionManager({
  token,
  competitionId,
  competitionName,
  topInset,
  onQuestionsChanged,
}: Props) {
  const insets = useSafeAreaInsets();
  const [questions, setQuestions] = useState<RealtimeQuestionDto[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [mode, setMode] = useState<'hub' | 'wizard' | 'done'>('hub');
  const [wizardStep, setWizardStep] = useState<WizardStep>('statement');
  const [draft, setDraft] = useState<Draft>(() => emptyDraft());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadQuestions = useCallback(async () => {
    if (!token || !competitionId) return;
    try {
      setLoadingList(true);
      setError(null);
      const qs = await realtimeApi.listQuestions(token, { competitionId });
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar perguntas');
    } finally {
      setLoadingList(false);
    }
  }, [token, competitionId]);

  useEffect(() => {
    void loadQuestions();
  }, [loadQuestions]);

  const stepIndex = STEPS.indexOf(wizardStep);

  const goHub = () => {
    setMode('hub');
    setWizardStep('statement');
    setDraft(emptyDraft());
    setEditingId(null);
    void loadQuestions();
    onQuestionsChanged?.();
  };

  const startCreate = () => {
    setEditingId(null);
    setDraft(emptyDraft());
    setWizardStep('statement');
    setMode('wizard');
  };

  const startEdit = (q: RealtimeQuestionDto) => {
    const opts = [...q.options];
    while (opts.length < 4) opts.push('');
    setDraft({
      statement: q.statement,
      options: opts.slice(0, 4) as Draft['options'],
      correctOptionIndex: q.correctOptionIndex,
      timeLimitSeconds: q.timeLimitSeconds,
    });
    setEditingId(q.id);
    setWizardStep('statement');
    setMode('wizard');
  };

  const nextStep = () => {
    const i = STEPS.indexOf(wizardStep);
    if (i < STEPS.length - 1) setWizardStep(STEPS[i + 1]!);
  };

  const prevStep = () => {
    const i = STEPS.indexOf(wizardStep);
    if (i > 0) setWizardStep(STEPS[i - 1]!);
    else goHub();
  };

  const validateStep = (): string | null => {
    if (wizardStep === 'statement') {
      const s = draft.statement.trim();
      if (s.length < 3) return 'Escreva a pergunta (mínimo 3 caracteres).';
      if (s.length > 2000) return 'Pergunta muito longa (máx. 2000).';
    }
    if (wizardStep === 'answers') {
      try {
        buildOptionsForApi(draft.options);
      } catch (e) {
        return e instanceof Error ? e.message : 'Respostas inválidas';
      }
    }
    if (wizardStep === 'correct') {
      try {
        const { options, lastIndex } = buildOptionsForApi(draft.options);
        if (draft.correctOptionIndex < 0 || draft.correctOptionIndex > lastIndex) {
          return 'Marque qual alternativa está correta.';
        }
        if (draft.correctOptionIndex >= options.length) {
          return 'Índice de resposta correta inválido.';
        }
      } catch (e) {
        return e instanceof Error ? e.message : 'Revise as respostas.';
      }
    }
    return null;
  };

  const onPrimaryAction = () => {
    const err = validateStep();
    if (err) {
      setError(err);
      return;
    }
    setError(null);
    if (wizardStep === 'review') {
      void submit();
      return;
    }
    if (wizardStep === 'answers') {
      try {
        const { lastIndex } = buildOptionsForApi(draft.options);
        setDraft((d) => ({
          ...d,
          correctOptionIndex: Math.min(Math.max(0, d.correctOptionIndex), lastIndex),
        }));
      } catch {
        /* ok */
      }
    }
    nextStep();
  };

  const submit = async () => {
    if (!token || !competitionId) return;
    let options: string[];
    try {
      options = buildOptionsForApi(draft.options).options;
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro nas alternativas');
      return;
    }
    try {
      setSaving(true);
      setError(null);
      if (editingId) {
        await realtimeApi.updateQuestion(token, editingId, {
          statement: draft.statement.trim(),
          options,
          correctOptionIndex: draft.correctOptionIndex,
          timeLimitSeconds: draft.timeLimitSeconds,
        });
      } else {
        await realtimeApi.createQuestion(token, {
          competitionId,
          statement: draft.statement.trim(),
          options,
          correctOptionIndex: draft.correctOptionIndex,
          timeLimitSeconds: draft.timeLimitSeconds,
        });
      }
      setMode('done');
      onQuestionsChanged?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setSaving(false);
    }
  };

  const confirmDelete = (q: RealtimeQuestionDto) => {
    if (!token) return;
    Alert.alert(
      'Excluir pergunta?',
      `"${q.statement.slice(0, 80)}${q.statement.length > 80 ? '…' : ''}"`,
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Excluir',
          style: 'destructive',
          onPress: async () => {
            try {
              await realtimeApi.deleteQuestion(token, q.id);
              void loadQuestions();
              onQuestionsChanged?.();
            } catch (e) {
              Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível excluir');
            }
          },
        },
      ],
    );
  };

  const stepTitle = useMemo(() => {
    switch (wizardStep) {
      case 'statement':
        return 'Comece pela pergunta';
      case 'answers':
        return 'Adicione as respostas';
      case 'correct':
        return 'Qual é a correta?';
      case 'timer':
        return 'Tempo para responder';
      case 'review':
        return 'Revisar e publicar';
      default:
        return '';
    }
  }, [wizardStep]);

  const stepHint = useMemo(() => {
    switch (wizardStep) {
      case 'statement':
        return 'Escreva o enunciado como os alunos verão na competição.';
      case 'answers':
        return 'Mesmas cores e formas do jogo (▲ ◆ ● ■). Preencha em ordem.';
      case 'correct':
        return 'Toque na alternativa certa — só ela pontua na sessão ao vivo.';
      case 'timer':
        return 'Quanto tempo os alunos têm para tocar na cor certa?';
      case 'review':
        return 'Confira antes de salvar no banco desta turma.';
      default:
        return '';
    }
  }, [wizardStep]);

  if (mode === 'done') {
    return (
      <View style={[styles.screen, { paddingTop: topInset + 16, paddingHorizontal: 18 }]}>
        <View style={styles.successCard}>
          <Text style={styles.successEmoji}>✓</Text>
          <Text style={styles.successTitle}>Pergunta salva!</Text>
          <Text style={styles.successSub}>Já pode usar em “Ao vivo” nesta turma.</Text>
        </View>
        <Pressable style={styles.primaryBtn} onPress={startCreate}>
          <Text style={styles.primaryBtnText}>Adicionar outra pergunta</Text>
        </Pressable>
        <Pressable style={styles.secondaryBtn} onPress={goHub}>
          <Text style={styles.secondaryBtnText}>Ver todas as perguntas</Text>
        </Pressable>
      </View>
    );
  }

  if (mode === 'wizard') {
    return (
      <View style={[styles.screen, { paddingTop: topInset + 8, paddingHorizontal: 18 }]}>
        <View style={styles.wizardTop}>
          <Pressable onPress={prevStep} hitSlop={12}>
            <Text style={styles.backLink}>‹ {wizardStep === 'statement' ? 'Sair' : 'Voltar'}</Text>
          </Pressable>
          <Text style={styles.wizardKicker}>
            {editingId ? 'Editar pergunta' : 'Nova pergunta'} · {competitionName}
          </Text>
        </View>

        <View style={styles.dotsRow}>
          {STEPS.map((s, idx) => (
            <View key={s} style={[styles.dot, idx <= stepIndex ? styles.dotOn : styles.dotOff]} />
          ))}
        </View>

        <Text style={styles.stepTitle}>{stepTitle}</Text>
        <Text style={styles.stepHint}>{stepHint}</Text>

        {error ? <Text style={styles.errorBanner}>{error}</Text> : null}

        <ScrollView
          style={styles.wizardScroll}
          contentContainerStyle={{ paddingBottom: 120 }}
          keyboardShouldPersistTaps="handled">
          {wizardStep === 'statement' ? (
            <TextInput
              value={draft.statement}
              onChangeText={(t) => setDraft((d) => ({ ...d, statement: t }))}
              placeholder="Ex: Quem foi o primeiro discípulo chamado por Jesus?"
              placeholderTextColor={AppTheme.placeholder}
              multiline
              style={styles.bigInput}
            />
          ) : null}

          {wizardStep === 'answers' ? (
            <View style={{ gap: 12 }}>
              {KAHOOT_ANSWER_SLOTS.map((theme, i) => (
                <View key={i} style={[styles.answerRow, { borderLeftColor: theme.bg }]}>
                  <Text style={[styles.answerShape, { color: theme.bg }]}>{theme.shape}</Text>
                  <TextInput
                    value={draft.options[i]}
                    onChangeText={(t) =>
                      setDraft((d) => {
                        const next = [...d.options] as string[];
                        next[i] = t;
                        return { ...d, options: next as Draft['options'] };
                      })
                    }
                    placeholder={`Resposta ${theme.name}`}
                    placeholderTextColor={AppTheme.placeholder}
                    style={styles.answerInput}
                  />
                </View>
              ))}
            </View>
          ) : null}

          {wizardStep === 'correct' ? (
            <View style={{ gap: 12 }}>
              {buildOptionsForApi(draft.options).options.map((label, i) => {
                const theme = KAHOOT_ANSWER_SLOTS[i]!;
                const selected = draft.correctOptionIndex === i;
                return (
                  <Pressable
                    key={i}
                    onPress={() => setDraft((d) => ({ ...d, correctOptionIndex: i }))}
                    style={[
                      styles.correctTile,
                      { backgroundColor: theme.bg },
                      selected ? styles.correctTileSelected : null,
                    ]}>
                    <Text style={styles.correctShape}>{theme.shape}</Text>
                    <Text style={styles.correctLabel} numberOfLines={2}>
                      {label}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          ) : null}

          {wizardStep === 'timer' ? (
            <View style={styles.timerGrid}>
              {TIMER_PRESETS.map((sec) => (
                <Pressable
                  key={sec}
                  onPress={() => setDraft((d) => ({ ...d, timeLimitSeconds: sec }))}
                  style={[styles.timerChip, draft.timeLimitSeconds === sec && styles.timerChipOn]}>
                  <Text
                    style={[
                      styles.timerChipText,
                      draft.timeLimitSeconds === sec && styles.timerChipTextOn,
                    ]}>
                    {sec}s
                  </Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          {wizardStep === 'review' ? (
            <View style={styles.reviewCard}>
              <Text style={styles.reviewSection}>Pergunta</Text>
              <Text style={styles.reviewStatement}>{draft.statement.trim()}</Text>
              <Text style={styles.reviewSection}>Respostas</Text>
              {buildOptionsForApi(draft.options).options.map((o, i) => (
                <View key={i} style={styles.reviewRow}>
                  <Text style={[styles.reviewShape, { color: KAHOOT_ANSWER_SLOTS[i]!.bg }]}>
                    {KAHOOT_ANSWER_SLOTS[i]!.shape}
                  </Text>
                  <Text style={styles.reviewOpt}>
                    {o}
                    {i === draft.correctOptionIndex ? '  ✓' : ''}
                  </Text>
                </View>
              ))}
              <Text style={styles.reviewSection}>Tempo</Text>
              <Text style={styles.reviewMeta}>{draft.timeLimitSeconds} segundos</Text>
            </View>
          ) : null}
        </ScrollView>

        <View style={[styles.wizardFooter, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable
            style={[styles.primaryBtn, saving && styles.btnDisabled]}
            onPress={onPrimaryAction}
            disabled={saving}>
            {saving ? (
              <ActivityIndicator color={AppTheme.onAccent} />
            ) : (
              <Text style={styles.primaryBtnText}>
                {wizardStep === 'review' ? (editingId ? 'Salvar alterações' : 'Salvar pergunta') : 'Continuar'}
              </Text>
            )}
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: topInset + 8, paddingHorizontal: 18 }]}>
      <Text style={styles.hubTitle}>Banco de perguntas</Text>
      <Text style={styles.hubSub}>
        {competitionName} · fluxo Kahoot: enunciado → cores ▲◆●■ → correta → tempo.
      </Text>

      <Pressable style={styles.createHero} onPress={startCreate}>
        <Text style={styles.createHeroPlus}>＋</Text>
        <View style={{ flex: 1 }}>
          <Text style={styles.createHeroTitle}>Nova pergunta</Text>
          <Text style={styles.createHeroSub}>2 a 4 alternativas nas cores do jogo</Text>
        </View>
      </Pressable>

      {loadingList ? <ActivityIndicator color={ACCENT} style={{ marginVertical: 16 }} /> : null}
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <Text style={styles.listHeading}>Lista ({questions.length})</Text>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: 24 }}>
        {questions.map((q) => (
          <View key={q.id} style={styles.qCard}>
            <Text style={styles.qStatement} numberOfLines={3}>
              {q.statement}
            </Text>
            <Text style={styles.qMeta}>
              {q.options.length} opções · {q.timeLimitSeconds}s · correta:{' '}
              {String.fromCharCode(65 + q.correctOptionIndex)}
            </Text>
            <View style={styles.qActions}>
              <Pressable style={styles.qEdit} onPress={() => startEdit(q)}>
                <Text style={styles.qEditText}>Editar</Text>
              </Pressable>
              <Pressable style={styles.qDelete} onPress={() => confirmDelete(q)}>
                <Text style={styles.qDeleteText}>Excluir</Text>
              </Pressable>
            </View>
          </View>
        ))}
        {!loadingList && questions.length === 0 ? (
          <Text style={styles.empty}>Nenhuma pergunta ainda. Toque em “Nova pergunta”.</Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: BG },
  hubTitle: { color: AppTheme.text, fontSize: 22, fontWeight: '900' },
  hubSub: { color: MUTED, marginTop: 8, lineHeight: 20, marginBottom: 16 },
  createHero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 16,
    backgroundColor: AppTheme.chipOnBg,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: AppTheme.accentBorder,
    padding: 18,
    marginBottom: 16,
  },
  createHeroPlus: { fontSize: 36, color: ACCENT, fontWeight: '300' },
  createHeroTitle: { color: AppTheme.text, fontSize: 17, fontWeight: '800' },
  createHeroSub: { color: MUTED, marginTop: 4, fontSize: 13 },
  listHeading: { color: AppTheme.textSecondary, fontWeight: '800', marginBottom: 10 },
  qCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  qStatement: { color: AppTheme.text, fontWeight: '600', fontSize: 15 },
  qMeta: { color: MUTED, fontSize: 12, marginTop: 8 },
  qActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  qEdit: {
    flex: 1,
    backgroundColor: 'rgba(89, 244, 168, 0.12)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  qEditText: { color: ACCENT, fontWeight: '800' },
  qDelete: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.4)',
    paddingVertical: 10,
    borderRadius: 10,
    alignItems: 'center',
  },
  qDeleteText: { color: AppTheme.danger, fontWeight: '800' },
  empty: { color: MUTED, textAlign: 'center', marginTop: 20 },
  err: { color: AppTheme.danger, marginBottom: 8 },

  wizardTop: { marginBottom: 12 },
  backLink: { color: ACCENT, fontWeight: '700', fontSize: 16, marginBottom: 8 },
  wizardKicker: { color: MUTED, fontSize: 12, fontWeight: '600' },
  dotsRow: { flexDirection: 'row', gap: 8, marginBottom: 16 },
  dot: { flex: 1, height: 4, borderRadius: 2, backgroundColor: BORDER },
  dotOn: { backgroundColor: ACCENT },
  dotOff: { backgroundColor: AppTheme.surfaceMuted },
  stepTitle: { color: AppTheme.text, fontSize: 22, fontWeight: '900' },
  stepHint: { color: MUTED, marginTop: 6, marginBottom: 12, lineHeight: 20 },
  errorBanner: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    color: AppTheme.dangerTextBright,
    padding: 10,
    borderRadius: 10,
    marginBottom: 12,
  },
  wizardScroll: { flex: 1 },
  bigInput: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    color: AppTheme.text,
    fontSize: 18,
    minHeight: 140,
    padding: 16,
    textAlignVertical: 'top',
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: CARD,
    borderRadius: 14,
    borderLeftWidth: 5,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  answerShape: { fontSize: 22, fontWeight: '900', width: 28 },
  answerInput: { flex: 1, color: AppTheme.text, fontSize: 16, paddingVertical: 8 },
  correctTile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingVertical: 18,
    paddingHorizontal: 16,
    borderRadius: 14,
    borderWidth: 3,
    borderColor: 'transparent',
  },
  correctTileSelected: { borderColor: AppTheme.accent, transform: [{ scale: 1.02 }] },
  correctShape: { color: AppTheme.text, fontSize: 24, fontWeight: '900' },
  correctLabel: { flex: 1, color: AppTheme.text, fontSize: 17, fontWeight: '800' },
  timerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  timerChip: {
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
  },
  timerChipOn: { borderColor: ACCENT, backgroundColor: AppTheme.chipOnBg },
  timerChipText: { color: MUTED, fontWeight: '800', fontSize: 16 },
  timerChipTextOn: { color: ACCENT },
  reviewCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
  },
  reviewSection: { color: ACCENT, fontWeight: '800', fontSize: 12, marginTop: 12, marginBottom: 6 },
  reviewStatement: { color: AppTheme.text, fontSize: 17, lineHeight: 24 },
  reviewRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 8 },
  reviewShape: { fontSize: 18, fontWeight: '900', width: 24 },
  reviewOpt: { flex: 1, color: AppTheme.textSecondary, fontSize: 15 },
  reviewMeta: { color: AppTheme.textSecondary, fontWeight: '700' },
  wizardFooter: {
    position: 'absolute',
    left: 18,
    right: 18,
    bottom: 0,
    backgroundColor: BG,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  primaryBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.6 },
  primaryBtnText: { color: AppTheme.onAccent, fontWeight: '900', fontSize: 16 },
  secondaryBtn: {
    marginTop: 12,
    borderRadius: 14,
    paddingVertical: 16,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: BORDER,
  },
  secondaryBtnText: { color: AppTheme.textSecondary, fontWeight: '800' },
  successCard: {
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 20,
    padding: 28,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 24,
  },
  successEmoji: { fontSize: 48, color: ACCENT, fontWeight: '900', marginBottom: 8 },
  successTitle: { color: AppTheme.text, fontSize: 22, fontWeight: '900' },
  successSub: { color: MUTED, textAlign: 'center', marginTop: 8, lineHeight: 20 },
});
