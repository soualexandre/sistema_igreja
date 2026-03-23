import { API_BASE_URL } from '@/lib/api-config';
import type { AuthUser } from '@/lib/auth-api';

export type ChurchUserListItem = {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'teacher' | 'student';
  classId: string | null;
  teacherClassIds: string[];
};

/** Somente admin. Lista usuários ativos da igreja; opcional ?role=teacher|student|admin */
export async function listChurchUsers(
  token: string,
  role?: 'admin' | 'teacher' | 'student',
): Promise<ChurchUserListItem[]> {
  const q = role ? `?role=${encodeURIComponent(role)}` : '';
  const response = await fetch(`${API_BASE_URL}/users${q}`, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = payload.message;
    const text = Array.isArray(msg) ? msg.join('. ') : msg;
    throw new Error(text ?? 'Falha ao listar usuários');
  }
  return (await response.json()) as ChurchUserListItem[];
}

/**
 * Somente admin. Altera o papel do usuário na mesma igreja (admin, teacher ou student).
 * PATCH /users/:userId { role }
 */
export async function patchUserRole(
  token: string,
  userId: string,
  role: 'admin' | 'teacher' | 'student',
): Promise<AuthUser> {
  const response = await fetch(`${API_BASE_URL}/users/${userId}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ role }),
  });
  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as { message?: string | string[] };
    const msg = payload.message;
    const text = Array.isArray(msg) ? msg.join('. ') : msg;
    throw new Error(text ?? 'Falha ao atualizar usuário');
  }
  return (await response.json()) as AuthUser;
}
