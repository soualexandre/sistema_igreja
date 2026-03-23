import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { AppTheme } from '@/constants/app-theme';
import { competitionsApi, type CompetitionListItem } from '@/lib/competitions-api';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

export function TeacherCompetitionsList({ token, topInset }: { token: string; topInset: number }) {
  const [items, setItems] = useState<CompetitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createName, setCreateName] = useState('');
  const [createBusy, setCreateBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const list = await competitionsApi.list(token);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const sorted = useMemo(() => items, [items]);

  const onOpen = (c: CompetitionListItem) => {
    router.push(`/competition/${c.id}`);
  };

  const submitCreate = async () => {
    const name = createName.trim();
    if (name.length < 2) {
      setError('Nome muito curto.');
      return;
    }
    try {
      setCreateBusy(true);
      setError(null);
      const created = await competitionsApi.create(token, name);
      setCreateOpen(false);
      setCreateName('');
      await load();
      router.push(`/competition/${created.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao criar');
    } finally {
      setCreateBusy(false);
    }
  };

  const confirmDelete = (c: CompetitionListItem) => {
    Alert.alert('Excluir competição?', `"${c.name}" e todas as perguntas serão removidas.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Excluir',
        style: 'destructive',
        onPress: async () => {
          try {
            await competitionsApi.remove(token, c.id);
            void load();
          } catch (e) {
            Alert.alert('Erro', e instanceof Error ? e.message : 'Não foi possível excluir');
          }
        },
      },
    ]);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { paddingTop: topInset + 40 }]}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={styles.loadingText}>Carregando competições…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topInset + 8 }]}>
      <View style={styles.hero}>
        <Text style={styles.heroKicker}>Modo professor / admin</Text>
        <Text style={styles.heroTitle}>Competições</Text>
        <Text style={styles.heroSub}>
          Crie um template com perguntas, use ao vivo quantas vezes quiser e consulte o histórico de cada rodada. A turma
          só é escolhida ao iniciar o jogo com PIN.
        </Text>
      </View>

      <Pressable
        onPress={() => {
          setCreateName('');
          setCreateOpen(true);
        }}
        style={({ pressed }) => [styles.newBtn, pressed && styles.newBtnPressed]}>
        <Text style={styles.newBtnText}>+ Nova competição</Text>
      </Pressable>

      {error ? <Text style={styles.err}>{error}</Text> : null}

      <FlatList
        data={sorted}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        ListEmptyComponent={
          <Text style={styles.emptyHint}>
            Nenhuma competição ainda. Toque em “Nova competição” para começar.
          </Text>
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              void load();
            }}
            tintColor={ACCENT}
          />
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => onOpen(item)}
            onLongPress={() => confirmDelete(item)}
            style={({ pressed }) => [styles.card, pressed && styles.cardPressed]}>
            <View style={styles.cardLeft}>
              <View style={styles.avatar}>
                <Text style={styles.avatarTxt}>{item.name.slice(0, 2).toUpperCase()}</Text>
              </View>
              <View style={styles.cardBody}>
                <Text style={styles.cardTitle} numberOfLines={2}>
                  {item.name}
                </Text>
                <Text style={styles.cardMeta} numberOfLines={1}>
                  {item._count.questions === 0
                    ? 'Sem perguntas — adicione antes de jogar'
                    : `${item._count.questions} pergunta${item._count.questions === 1 ? '' : 's'}`}
                  {item._count.quizSessions > 0
                    ? ` · ${item._count.quizSessions} rodada${item._count.quizSessions === 1 ? '' : 's'}`
                    : ''}
                </Text>
                <View style={styles.badgeRow}>
                  <View style={[styles.badge, item._count.questions > 0 ? styles.badgeOk : styles.badgeWarn]}>
                    <Text style={styles.badgeText}>
                      {item._count.questions > 0 ? 'Pronta para jogar' : 'Configurar'}
                    </Text>
                  </View>
                </View>
              </View>
            </View>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        )}
      />

      <Modal visible={createOpen} transparent animationType="fade">
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova competição</Text>
            <TextInput
              value={createName}
              onChangeText={setCreateName}
              placeholder="Ex.: Revisão trimestral"
              placeholderTextColor={AppTheme.placeholder}
              style={styles.modalInput}
            />
            <View style={styles.modalRow}>
              <Pressable
                onPress={() => setCreateOpen(false)}
                style={styles.modalCancel}
                disabled={createBusy}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                onPress={() => void submitCreate()}
                style={[styles.modalOk, createBusy && styles.modalOkDisabled]}
                disabled={createBusy}>
                {createBusy ? (
                  <ActivityIndicator color={AppTheme.onAccent} />
                ) : (
                  <Text style={styles.modalOkText}>Criar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 18 },
  center: { flex: 1, backgroundColor: BG, alignItems: 'center' },
  loadingText: { color: MUTED, marginTop: 12 },

  hero: {
    padding: 18,
    borderRadius: 20,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 14,
  },
  heroKicker: {
    color: ACCENT,
    fontWeight: '800',
    fontSize: 11,
    letterSpacing: 1.2,
    textTransform: 'uppercase',
    marginBottom: 8,
  },
  heroTitle: { color: AppTheme.text, fontSize: 26, fontWeight: '900' },
  heroSub: { color: MUTED, marginTop: 8, lineHeight: 20, fontSize: 14 },

  newBtn: {
    backgroundColor: ACCENT,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    marginBottom: 14,
  },
  newBtnPressed: { opacity: 0.9 },
  newBtnText: { color: AppTheme.onAccent, fontWeight: '900', fontSize: 16 },

  err: { color: AppTheme.danger, marginBottom: 8 },

  listContent: { paddingBottom: 100, gap: 12 },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 16,
    gap: 12,
  },
  cardPressed: { opacity: 0.92, borderColor: 'rgba(89, 244, 168, 0.35)' },
  cardLeft: { flex: 1, flexDirection: 'row', gap: 14, minWidth: 0 },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 16,
    backgroundColor: AppTheme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarTxt: { color: ACCENT, fontWeight: '900', fontSize: 18 },
  cardBody: { flex: 1, minWidth: 0 },
  cardTitle: { color: AppTheme.text, fontSize: 17, fontWeight: '800' },
  cardMeta: { color: MUTED, fontSize: 13, marginTop: 4, lineHeight: 18 },
  badgeRow: { flexDirection: 'row', marginTop: 10, flexWrap: 'wrap', gap: 6 },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 999 },
  badgeOk: { backgroundColor: AppTheme.successMuted },
  badgeWarn: { backgroundColor: AppTheme.accentMuted },
  badgeText: { color: AppTheme.textSecondary, fontSize: 11, fontWeight: '800' },
  chevron: { color: MUTED, fontSize: 28, fontWeight: '300' },
  emptyHint: { color: MUTED, textAlign: 'center', marginTop: 32 },

  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalTitle: { color: AppTheme.text, fontSize: 18, fontWeight: '900', marginBottom: 12 },
  modalInput: {
    borderWidth: 1,
    borderColor: BORDER,
    borderRadius: 12,
    padding: 14,
    color: AppTheme.textSecondary,
    fontSize: 16,
    marginBottom: 16,
  },
  modalRow: { flexDirection: 'row', justifyContent: 'flex-end', gap: 12 },
  modalCancel: { paddingVertical: 12, paddingHorizontal: 16 },
  modalCancelText: { color: MUTED, fontWeight: '700' },
  modalOk: {
    backgroundColor: ACCENT,
    paddingVertical: 12,
    paddingHorizontal: 22,
    borderRadius: 12,
    minWidth: 100,
    alignItems: 'center',
  },
  modalOkDisabled: { opacity: 0.6 },
  modalOkText: { color: AppTheme.onAccent, fontWeight: '900' },
});
