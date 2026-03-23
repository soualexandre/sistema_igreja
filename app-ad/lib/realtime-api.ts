import { API_BASE_URL } from '@/lib/api-config';

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
  totalCorrectTimeMs?: number;
  correctCount?: number;
  points?: number;
};

export type SessionStatePayload = {
  session: RealtimeSessionDto;
  currentQuestion: RealtimeQuestionDto | null;
  ranking: RankingRow[];
};

export type AnswerAck = {
  accepted: boolean;
  reason?: string;
};

async function authRequest<T>(
  token: string,
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
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
};
