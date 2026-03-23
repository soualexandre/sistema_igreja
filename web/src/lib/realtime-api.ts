import { getApiBaseUrl } from '@/lib/api-config';

export type RealtimeSessionStatus = 'waiting' | 'running' | 'paused' | 'finished';

export type RealtimeSessionDto = {
  id: string;
  code: string;
  churchId: string;
  classId: string;
  competitionId: string;
  teacherId: string;
  status: RealtimeSessionStatus;
  questionIds: string[];
  currentQuestionIndex: number;
  currentQuestionStartedAt: number | null;
  currentQuestionEndsAt: number | null;
  pausedAt: number | null;
  participants: Record<string, true>;
  answersByQuestion: Record<
    string,
    Record<string, number | { selectedOptionIndex: number; elapsedMs: number }>
  >;
  createdAt: string;
  updatedAt: string;
  participantCount?: number;
};

export type RealtimeQuestionDto = {
  id: string;
  competitionId: string;
  classId: string | null;
  lessonId: string | null;
  statement: string;
  options: string[];
  correctOptionIndex: number;
  timeLimitSeconds: number;
  createdBy: string;
};

export type RankingRow = {
  userId: string;
  name: string;
  /** Soma dos tempos (ms) só nas questões acertadas; menor = melhor (usar com correctCount). */
  totalCorrectTimeMs: number;
  /** Quantas perguntas acertou */
  correctCount: number;
  /** Legado / fallback */
  points?: number;
};

export type AnswerRevealPayload = {
  selectedOptionIndex: number;
  correct: boolean;
  correctOptionIndex: number;
};

export type SessionStatePayload = {
  session: RealtimeSessionDto;
  currentQuestion: RealtimeQuestionDto | null;
  ranking: RankingRow[];
  /** Rotas de convidado: feedback após responder a pergunta atual */
  answerReveal?: AnswerRevealPayload | null;
};

/** Resposta de POST /realtime/session/join-guest */
export type GuestJoinResponse = SessionStatePayload & { guestId: string };

export type AnswerAck = {
  accepted: boolean;
  reason?: string;
  /** Só após resposta aceita — para feedback no cliente (sem expor gabarito antes). */
  correct?: boolean;
  correctOptionIndex?: number;
  selectedOptionIndex?: number;
};

function rethrowNetworkError(e: unknown): never {
  if (e instanceof TypeError) {
    throw new Error(
      'Sem conexão. Confirme o Next em execução (porta 3000) e o backend Nest na mesma máquina (porta 3333).',
    );
  }
  throw e;
}

function formatApiErrorMessage(
  payload: unknown,
  fallback: string,
  status: number,
): string {
  if (!payload || typeof payload !== 'object') {
    return fallback || `Erro HTTP ${status}`;
  }
  const p = payload as { message?: string | string[]; error?: string };
  const raw = p.message ?? p.error;
  if (Array.isArray(raw)) {
    return raw.join('. ') || fallback;
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw;
  }
  return fallback || `Erro HTTP ${status}`;
}

async function publicJsonRequest<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options?.headers ?? {}),
      },
    });
  } catch (e) {
    rethrowNetworkError(e);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      formatApiErrorMessage(payload, response.statusText || 'Falha na requisição', response.status),
    );
  }

  return (await response.json()) as T;
}

async function authRequest<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  let response: Response;
  try {
    response = await fetch(`${getApiBaseUrl()}${path}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(options?.headers ?? {}),
      },
    });
  } catch (e) {
    rethrowNetworkError(e);
  }

  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(
      formatApiErrorMessage(payload, response.statusText || 'Falha na requisição', response.status),
    );
  }

  return (await response.json()) as T;
}

export type CreateQuestionBody = {
  competitionId: string;
  classId?: string | null;
  statement: string;
  options: string[];
  correctOptionIndex: number;
  timeLimitSeconds?: number;
  lessonId?: string | null;
};

export type UpdateQuestionBody = Partial<
  Pick<
    CreateQuestionBody,
    'statement' | 'options' | 'correctOptionIndex' | 'timeLimitSeconds' | 'lessonId'
  >
>;

export type ListQuestionsParams = { classId?: string; competitionId?: string };

export const realtimeApi = {
  listQuestions(token: string, params: ListQuestionsParams) {
    const q = new URLSearchParams();
    if (params.classId) q.set('classId', params.classId);
    if (params.competitionId) q.set('competitionId', params.competitionId);
    return authRequest<RealtimeQuestionDto[]>(token, `/realtime/questions?${q}`, {
      method: 'GET',
    });
  },

  createQuestion(token: string, body: CreateQuestionBody) {
    return authRequest<RealtimeQuestionDto>(token, '/realtime/questions', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  updateQuestion(token: string, questionId: string, body: UpdateQuestionBody) {
    return authRequest<RealtimeQuestionDto>(token, `/realtime/questions/${questionId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },

  deleteQuestion(token: string, questionId: string) {
    return authRequest<{ ok: boolean }>(token, `/realtime/questions/${questionId}`, {
      method: 'DELETE',
    });
  },

  startSession(
    token: string,
    body: { competitionId: string; classId: string; questionIds: string[] },
  ) {
    return authRequest<RealtimeSessionDto>(token, '/realtime/session/start', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  nextQuestion(token: string, sessionId: string) {
    return authRequest<{
      done: boolean;
      session: RealtimeSessionDto;
      question?: RealtimeQuestionDto;
    }>(token, '/realtime/session/next', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  endSession(token: string, sessionId: string) {
    return authRequest<RealtimeSessionDto>(token, '/realtime/session/end', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  pauseSession(token: string, sessionId: string) {
    return authRequest<SessionStatePayload>(token, '/realtime/session/pause', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  resumeSession(token: string, sessionId: string) {
    return authRequest<SessionStatePayload>(token, '/realtime/session/resume', {
      method: 'POST',
      body: JSON.stringify({ sessionId }),
    });
  },

  joinSession(token: string, sessionCode: string) {
    return authRequest<SessionStatePayload>(token, '/realtime/session/join', {
      method: 'POST',
      body: JSON.stringify({ sessionCode }),
    });
  },

  answerQuestion(token: string, sessionId: string, selectedOptionIndex: number) {
    return authRequest<AnswerAck>(token, '/realtime/session/answer', {
      method: 'POST',
      body: JSON.stringify({ sessionId, selectedOptionIndex }),
    });
  },

  getSessionState(token: string, sessionId: string) {
    const q = new URLSearchParams({ sessionId });
    return authRequest<SessionStatePayload>(token, `/realtime/session/state?${q}`, {
      method: 'GET',
    });
  },

  /** Convidado: sem token. */
  joinSessionGuest(body: {
    sessionCode: string;
    displayName: string;
    guestId?: string;
  }) {
    return publicJsonRequest<GuestJoinResponse>('/realtime/session/join-guest', {
      method: 'POST',
      body: JSON.stringify({
        sessionCode: body.sessionCode.trim().toUpperCase(),
        displayName: body.displayName.trim(),
        ...(body.guestId ? { guestId: body.guestId } : {}),
      }),
    });
  },

  answerQuestionGuest(
    sessionId: string,
    guestId: string,
    selectedOptionIndex: number,
  ) {
    return publicJsonRequest<AnswerAck>('/realtime/session/answer-guest', {
      method: 'POST',
      body: JSON.stringify({ sessionId, guestId, selectedOptionIndex }),
    });
  },

  getSessionStateGuest(sessionId: string, guestId: string) {
    const q = new URLSearchParams({ sessionId, guestId });
    return publicJsonRequest<SessionStatePayload>(
      `/realtime/session/state-guest?${q}`,
      { method: 'GET' },
    );
  },
};
