import { useEffect, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { AppTheme } from '@/constants/app-theme';
import { competitionsApi, type CompetitionRunRow } from '@/lib/competitions-api';
import { formatRankingRowSummary } from '@/lib/quiz-ranking-display';
import type { RankingRow } from '@/lib/realtime-api';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

function parseRanking(raw: unknown): RankingRow[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .map((x) => {
      if (x && typeof x === 'object' && 'userId' in x && 'name' in x) {
        const o = x as Record<string, unknown>;
        return {
          userId: String(o.userId),
          name: String(o.name),
          totalCorrectTimeMs:
            typeof o.totalCorrectTimeMs === 'number' ? o.totalCorrectTimeMs : undefined,
          correctCount: typeof o.correctCount === 'number' ? o.correctCount : undefined,
          points: typeof o.points === 'number' ? o.points : undefined,
        };
      }
      return null;
    })
    .filter(Boolean) as RankingRow[];
}

type Props = {
  token: string;
  competitionId: string;
  topInset: number;
};

export function TeacherCompetitionHistory({ token, competitionId, topInset }: Props) {
  const [runs, setRuns] = useState<CompetitionRunRow[]>([]);
  const [cursor, setCursor] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailTitle, setDetailTitle] = useState('');
  const [detailRanking, setDetailRanking] = useState<RankingRow[]>([]);

  useEffect(() => {
    setLoading(true);
    setCursor(undefined);
    setRuns([]);
    void (async () => {
      if (!token || !competitionId) return;
      try {
        setError(null);
        const page = await competitionsApi.listRuns(token, competitionId, { take: 25 });
        setRuns(page.runs);
        setCursor(page.nextCursor);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Erro ao carregar histórico');
      } finally {
        setLoading(false);
      }
    })();
  }, [token, competitionId]);

  const openDetail = (row: CompetitionRunRow) => {
    const ranking = parseRanking(row.finalRanking);
    const date = new Date(row.createdAt).toLocaleString();
    setDetailTitle(`${row.className} · ${date} · PIN ${row.code}`);
    setDetailRanking(ranking);
    setDetailOpen(true);
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.center, { paddingTop: topInset + 24 }]}>
        <ActivityIndicator color={ACCENT} size="large" />
        <Text style={styles.muted}>Carregando rodadas…</Text>
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: topInset + 8 }]}>
      <Text style={styles.intro}>
        Cada vez que você inicia o jogo ao vivo, uma nova rodada é registrada. Toque para ver o ranking salvo ao final.
      </Text>
      {error ? <Text style={styles.err}>{error}</Text> : null}

      <FlatList
        data={runs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listPad}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              setCursor(undefined);
              setRuns([]);
              void (async () => {
                try {
                  const page = await competitionsApi.listRuns(token, competitionId, { take: 25 });
                  setRuns(page.runs);
                  setCursor(page.nextCursor);
                } catch (e) {
                  setError(e instanceof Error ? e.message : 'Erro');
                } finally {
                  setRefreshing(false);
                }
              })();
            }}
            tintColor={ACCENT}
          />
        }
        onEndReached={() => {
          if (!cursor || loadingMore) return;
          setLoadingMore(true);
          void (async () => {
            try {
              const page = await competitionsApi.listRuns(token, competitionId, {
                take: 25,
                cursor,
              });
              setRuns((prev) => [...prev, ...page.runs]);
              setCursor(page.nextCursor);
            } catch {
              /* ignore */
            } finally {
              setLoadingMore(false);
            }
          })();
        }}
        onEndReachedThreshold={0.4}
        ListEmptyComponent={<Text style={styles.empty}>Nenhuma rodada registrada ainda.</Text>}
        ListFooterComponent={
          loadingMore ? <ActivityIndicator style={{ marginVertical: 16 }} color={ACCENT} /> : null
        }
        renderItem={({ item }) => (
          <Pressable
            onPress={() => openDetail(item)}
            style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}>
            <View style={styles.rowMain}>
              <Text style={styles.rowTitle} numberOfLines={1}>
                {item.className}
              </Text>
              <Text style={styles.rowMeta}>
                {new Date(item.createdAt).toLocaleString()} · PIN {item.code} · {item.questionCount}{' '}
                pergunta(s)
              </Text>
              <Text style={styles.rowStatus}>{item.status}</Text>
            </View>
            <Text style={styles.chev}>›</Text>
          </Pressable>
        )}
      />

      <Modal visible={detailOpen} transparent animationType="fade">
        <Pressable style={styles.modalBackdrop} onPress={() => setDetailOpen(false)}>
          <Pressable style={styles.modalCard} onPress={(e) => e.stopPropagation()}>
            <Text style={styles.modalTitle}>Resultado</Text>
            <Text style={styles.modalSub}>{detailTitle}</Text>
            {detailRanking.length === 0 ? (
              <Text style={styles.muted}>Sem ranking salvo (sessão antiga ou sem pontos).</Text>
            ) : (
              detailRanking.slice(0, 20).map((r, i) => {
                const { main, sub } = formatRankingRowSummary(r);
                return (
                  <View key={r.userId} style={styles.rankRow}>
                    <Text style={styles.rankPos}>{i + 1}</Text>
                    <Text style={styles.rankName} numberOfLines={1}>
                      {r.name}
                    </Text>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={styles.rankPts}>{main}</Text>
                      {sub ? <Text style={styles.rankSub}>{sub}</Text> : null}
                    </View>
                  </View>
                );
              })
            )}
            <Pressable style={styles.modalClose} onPress={() => setDetailOpen(false)}>
              <Text style={styles.modalCloseText}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  center: { flex: 1, alignItems: 'center', backgroundColor: BG },
  intro: { color: MUTED, lineHeight: 20, marginBottom: 12, fontSize: 14 },
  err: { color: AppTheme.danger, marginBottom: 8 },
  muted: { color: MUTED, marginTop: 8 },
  listPad: { paddingBottom: 40 },
  empty: { color: MUTED, textAlign: 'center', marginTop: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 10,
  },
  rowPressed: { opacity: 0.92 },
  rowMain: { flex: 1, minWidth: 0 },
  rowTitle: { color: AppTheme.text, fontWeight: '800', fontSize: 16 },
  rowMeta: { color: MUTED, fontSize: 12, marginTop: 4 },
  rowStatus: { color: ACCENT, fontSize: 11, fontWeight: '800', marginTop: 6, textTransform: 'uppercase' },
  chev: { color: MUTED, fontSize: 22, marginLeft: 8 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center',
    padding: 20,
  },
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
    maxHeight: '80%',
  },
  modalTitle: { color: AppTheme.text, fontSize: 20, fontWeight: '900' },
  modalSub: { color: MUTED, marginTop: 8, marginBottom: 16, lineHeight: 20 },
  rankRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8, gap: 10 },
  rankPos: { width: 28, color: ACCENT, fontWeight: '900' },
  rankName: { flex: 1, color: AppTheme.textSecondary },
  rankPts: { color: AppTheme.accent, fontWeight: '800', fontVariant: ['tabular-nums'] },
  rankSub: { color: MUTED, fontWeight: '600', fontSize: 10, marginTop: 2 },
  modalClose: {
    marginTop: 16,
    alignSelf: 'flex-end',
    paddingVertical: 10,
    paddingHorizontal: 16,
  },
  modalCloseText: { color: ACCENT, fontWeight: '800' },
});
