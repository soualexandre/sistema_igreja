import { API_BASE_URL } from '@/lib/api-config';

/** Soma de PointEvent da turma (presença, pontualidade, participação, quiz, bônus). */
export type RankingRow = {
  userId: string;
  name: string;
  points: number;
};

async function authRequest<T>(token: string, path: string): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? 'Falha ao carregar ranking');
  }
  return (await response.json()) as T;
}

export const rankingApi = {
  /** Ranking acumulado na turma (`scope=class`). */
  getClassRanking(token: string, classId: string) {
    const q = new URLSearchParams({ classId, scope: 'class' });
    return authRequest<RankingRow[]>(token, `/ranking?${q}`);
  },
};
