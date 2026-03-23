import { getApiBaseUrl } from "@/lib/api-config";

export type AuthUser = {
  id: string;
  name: string;
  email: string;
  role: "admin" | "teacher" | "student";
  churchId: string;
  classId: string | null;
  teacherClassIds: string[];
  isActive: boolean;
};

type AuthResponse = {
  token: string;
  user: AuthUser;
};

type RegisterPayload = {
  name: string;
  email: string;
  password: string;
  role?: "admin" | "teacher" | "student";
  classId?: string;
  churchId?: string;
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrl()}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const payload = (await response.json().catch(() => ({}))) as {
      message?: string;
    };
    throw new Error(payload.message ?? "Falha na requisição");
  }

  return (await response.json()) as T;
}

export const authApi = {
  login(email: string, password: string) {
    return request<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  register(payload: RegisterPayload) {
    return request<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me(token: string) {
    return request<AuthUser>("/auth/me", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
  },
};
