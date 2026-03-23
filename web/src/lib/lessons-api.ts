import { getApiBaseUrl } from '@/lib/api-config';

export type LessonDto = {
  id: string;
  classId: string;
  title: string;
  lessonDate: string;
  startsAt: string;
  createdBy: string;
  createdAt: string;
  location?: string | null;
  cpadYear?: number | null;
  cpadLessonIndex?: number | null;
};

export type CpadLessonsState = {
  useCpadSchedule: boolean;
  cpadYear: number | null;
  releasedThroughLessonIndex: number;
  maxLessonIndex: number | null;
  lessons: LessonDto[];
  canUnlockNext: boolean;
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

export const lessonsApi = {
  list(token: string, classId: string, from?: string, to?: string) {
    const q = new URLSearchParams({ classId });
    if (from) q.set('from', from);
    if (to) q.set('to', to);
    return authRequest<LessonDto[]>(token, `/lessons?${q}`, { method: 'GET' });
  },

  create(token: string, body: { classId: string; title: string; startsAt: string }) {
    return authRequest<LessonDto>(token, '/lessons', {
      method: 'POST',
      body: JSON.stringify(body),
    });
  },

  cpadState(token: string, classId: string) {
    const q = new URLSearchParams({ classId });
    return authRequest<CpadLessonsState>(token, `/lessons/cpad/state?${q}`, {
      method: 'GET',
    });
  },

  unlockNextCpad(token: string, classId: string) {
    return authRequest<CpadLessonsState>(token, '/lessons/cpad/unlock-next', {
      method: 'POST',
      body: JSON.stringify({ classId }),
    });
  },

  patchLesson(token: string, lessonId: string, body: { startsAt?: string; location?: string }) {
    return authRequest<LessonDto>(token, `/lessons/${lessonId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};
