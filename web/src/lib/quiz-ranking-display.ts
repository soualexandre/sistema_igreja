import type { RankingRow } from "@/lib/realtime-api";

/** Exibe soma de tempos nas respostas corretas. */
export function formatQuizTotalTime(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return "—";
  if (ms < 1000) return `${Math.round(ms)} ms`;
  const s = ms / 1000;
  return s >= 100 ? `${s.toFixed(1)} s` : `${s.toFixed(2)} s`;
}

/** Ranking ao vivo / final: tempo total + acertos (ou legado só pontos). */
export function formatRankingRowSummary(r: RankingRow): {
  main: string;
  sub?: string;
} {
  if (
    typeof r.totalCorrectTimeMs === "number" &&
    typeof r.correctCount === "number"
  ) {
    if (r.correctCount === 0) {
      return { main: "—", sub: "0 acertos" };
    }
    return {
      main: formatQuizTotalTime(r.totalCorrectTimeMs),
      sub:
        r.correctCount === 1
          ? "1 acerto"
          : `${r.correctCount} acertos`,
    };
  }
  const pts = r.points ?? 0;
  return { main: `${pts} pts`, sub: undefined };
}
