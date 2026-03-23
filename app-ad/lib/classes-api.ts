import { API_BASE_URL } from '@/lib/api-config';

export type Classroom = {
  id: string;
  name: string;
  churchId: string;
  teacherId: string;
  studentIds: string[];
  useCpadSchedule?: boolean;
  cpadYear?: number | null;
  releasedThroughLessonIndex?: number;
};

export type ClassStudent = {
  id: string;
  name: string;
  email: string;
};

export type ClassTeacher = {
  id: string;
  name: string;
  email: string;
  isPrimary: boolean;
  /** teacher | admin quando vinculado à turma sem mudar de papel */
  role?: string;
};

export type ClassAccessRequest = {
  id: string;
  userId: string;
  classId: string;
  /** Pedido de aluno na turma ou de professor para ministrar/acessar a turma */
  requestKind?: 'student' | 'teacher' | string;
  status: 'PENDING_ADMIN' | 'PENDING_TEACHER' | 'APPROVED' | 'REJECTED';
  note?: string | null;
  createdAt: string;
};

/** Retorno de GET /classes/access/requests para professor/admin (inclui user e turma). */
export type ClassAccessRequestDetailed = ClassAccessRequest & {
  user?: { id: string; name: string; email: string };
  classroom?: { id: string; name: string };
};

async function request<T>(token: string, path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string | string[];
    };
    const msg = payload.message;
    const text = Array.isArray(msg) ? msg.join('. ') : msg;
    throw new Error(text ?? 'Falha na requisição');
  }

  return (await response.json()) as T;
}

export const classesApi = {
  list(token: string) {
    return request<Classroom[]>(token, '/classes', { method: 'GET' });
  },

  requestAccess(
    token: string,
    classId: string,
    note?: string,
    requestKind?: 'student' | 'teacher',
  ) {
    return request<ClassAccessRequest>(token, '/classes/access/request', {
      method: 'POST',
      body: JSON.stringify({ classId, note, requestKind }),
    });
  },

  /** Admin: vincula um usuário com papel professor à turma (sem pedido). */
  assignTeacherToClass(token: string, classId: string, userId: string) {
    return request<Classroom>(token, `/classes/${classId}/teachers/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  listTeachers(token: string, classId: string) {
    return request<ClassTeacher[]>(token, `/classes/${classId}/teachers`, {
      method: 'GET',
    });
  },

  removeTeacherFromClass(
    token: string,
    classId: string,
    teacherUserId: string,
    newPrimaryTeacherId?: string,
  ) {
    const q = newPrimaryTeacherId
      ? `?newPrimaryTeacherId=${encodeURIComponent(newPrimaryTeacherId)}`
      : '';
    return request<Classroom>(token, `/classes/${classId}/teachers/${teacherUserId}${q}`, {
      method: 'DELETE',
    });
  },

  assignStudentToClass(token: string, classId: string, userId: string) {
    return request<Classroom>(token, `/classes/${classId}/students/assign`, {
      method: 'POST',
      body: JSON.stringify({ userId }),
    });
  },

  removeStudentFromClass(token: string, classId: string, studentId: string) {
    return request<Classroom>(token, `/classes/${classId}/students/${studentId}`, {
      method: 'DELETE',
    });
  },

  deleteClass(token: string, classId: string) {
    return request<{ ok: boolean; id: string }>(token, `/classes/${classId}`, {
      method: 'DELETE',
    });
  },

  listMyRequests(token: string) {
    return request<ClassAccessRequest[]>(token, '/classes/access/requests', {
      method: 'GET',
    });
  },

  /** Professor: pedidos das suas turmas. Admin: pedidos da igreja. */
  listStaffAccessRequests(token: string) {
    return request<ClassAccessRequestDetailed[]>(token, '/classes/access/requests', {
      method: 'GET',
    });
  },

  moderateByAdmin(token: string, input: { requestId: string; approve: boolean; note?: string }) {
    return request<ClassAccessRequest>(token, '/classes/access/moderate/admin', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },

  listStudents(token: string, classId: string) {
    return request<ClassStudent[]>(token, `/classes/${classId}/students`, {
      method: 'GET',
    });
  },

  patchClass(
    token: string,
    classId: string,
    body: {
      useCpadSchedule?: boolean;
      cpadYear?: number | null;
      releasedThroughLessonIndex?: number;
      name?: string;
      teacherId?: string;
    },
  ) {
    return request<Classroom>(token, `/classes/${classId}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
};

