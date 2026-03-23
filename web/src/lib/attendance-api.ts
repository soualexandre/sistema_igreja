import { getApiBaseUrl } from '@/lib/api-config';

export type ParticipationPayload = {
  magazine?: boolean;
  bible?: boolean;
  lessonParticipation?: boolean;
  offering?: boolean;
};

export type PresenceCountRow = {
  studentId: string;
  presentCount: number;
};

export type AttendanceRecordDto = {
  studentId: string;
  present: boolean;
  participation: Record<string, unknown> | null;
  recordedAt: string;
};

/** Top da turma por presença em aula (não inclui pontos de quiz/competição). */
export type AttendanceComboLeaderboardRow = {
  userId: string;
  name: string;
  comboScore: number;
  presentLessons: number;
  punctualLessons: number;
  participationChecks: number;
};

export type MyAttendanceSummary = {
  classId: string;
  totalRecorded: number;
  presentCount: number;
  absentCount: number;
  punctualCount: number;
  lastRecords: Array<{
    lessonTitle: string;
    startsAt: string;
    present: boolean;
    punctual: boolean;
    recordedAt: string;
  }>;
};

async function authRequest<T>(token: string, path: string, options?: RequestInit): Promise<T> {
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

export const attendanceApi = {
  register(
    token: string,
    body: {
      classId: string;
      studentId: string;
      lessonId: string;
      present: boolean;
      participation?: ParticipationPayload;
    },
  ) {
    return authRequest<unknown>(token, '/attendance', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  listByLesson(token: string, lessonId: string) {
    const q = new URLSearchParams({ lessonId });
    return authRequest<AttendanceRecordDto[]>(token, `/attendance/by-lesson?${q}`, {
      method: 'GET',
    });
  },

  countsByClass(token: string, classId: string) {
    const q = new URLSearchParams({ classId });
    return authRequest<PresenceCountRow[]>(token, `/attendance/counts-by-class?${q}`, {
      method: 'GET',
    });
  },

  /** Aluno: presenças na turma vinculada. */
  mySummary(token: string) {
    return authRequest<MyAttendanceSummary>(token, '/attendance/my-summary', {
      method: 'GET',
    });
  },

  /** Ranking por combo presença + pontualidade + itens de participação na turma. */
  classComboLeaderboard(token: string, classId: string) {
    const q = new URLSearchParams({ classId });
    return authRequest<AttendanceComboLeaderboardRow[]>(
      token,
      `/attendance/class-combo-leaderboard?${q}`,
      { method: 'GET' },
    );
  },
};
