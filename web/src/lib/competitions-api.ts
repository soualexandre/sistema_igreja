import { getApiBaseUrl } from '@/lib/api-config';

export type CompetitionListItem = {
  id: string;
  churchId: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  _count: { questions: number; quizSessions: number };
};

export type CompetitionRunRow = {
  id: string;
  competitionId: string;
  classId: string;
  className: string;
  code: string;
  status: string;
  questionCount: number;
  finalRanking: unknown;
  createdAt: string;
  updatedAt: string;
};

export type CompetitionRunsPage = {
  runs: CompetitionRunRow[];
  nextCursor?: string;
};

async function authRequest<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string };
    throw new Error(payload.message ?? 'Falha na requisição');
  }

  return (await response.json()) as T;
}

export const competitionsApi = {
  list(token: string) {
    return authRequest<CompetitionListItem[]>(token, '/competitions', { method: 'GET' });
  },

  create(token: string, name: string) {
    return authRequest<CompetitionListItem>(token, '/competitions', {
      method: 'POST',
      body: JSON.stringify({ name }),
    });
  },

  update(token: string, id: string, name: string) {
    return authRequest<CompetitionListItem>(token, `/competitions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ name }),
    });
  },

  remove(token: string, id: string) {
    return authRequest<{ ok: boolean }>(token, `/competitions/${id}`, {
      method: 'DELETE',
    });
  },

  listRuns(token: string, competitionId: string, opts?: { take?: number; cursor?: string }) {
    const q = new URLSearchParams();
    if (opts?.take != null) q.set('take', String(opts.take));
    if (opts?.cursor) q.set('cursor', opts.cursor);
    const suffix = q.toString() ? `?${q}` : '';
    return authRequest<CompetitionRunsPage>(
      token,
      `/competitions/${competitionId}/runs${suffix}`,
      { method: 'GET' },
    );
  },

  runDetail(token: string, runId: string) {
    return authRequest<{
      id: string;
      competitionId: string;
      competitionName: string;
      classId: string;
      className: string;
      code: string;
      status: string;
      questionIds: string[];
      finalRanking: unknown;
      createdAt: string;
      updatedAt: string;
    }>(token, `/competitions/runs/${runId}/detail`, { method: 'GET' });
  },
};
