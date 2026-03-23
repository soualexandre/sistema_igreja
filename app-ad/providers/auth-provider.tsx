import AsyncStorage from '@react-native-async-storage/async-storage';
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi, type AuthUser } from '@/lib/auth-api';

const AUTH_TOKEN_KEY = 'ebd_auth_token';

type AuthContextValue = {
  isLoading: boolean;
  token: string | null;
  user: AuthUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: {
    name: string;
    email: string;
    password: string;
    role?: 'admin' | 'teacher' | 'student';
  }) => Promise<void>;
  signOut: () => Promise<void>;
  /** Atualiza papel / turmas após o admin aprovar pedidos ou alterar o usuário. */
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

async function safeGetItem(key: string) {
  try {
    return await AsyncStorage.getItem(key);
  } catch {
    return null;
  }
}

async function safeSetItem(key: string, value: string) {
  try {
    await AsyncStorage.setItem(key, value);
  } catch {
    // no-op when native storage is unavailable
  }
}

async function safeRemoveItem(key: string) {
  try {
    await AsyncStorage.removeItem(key);
  } catch {
    // no-op when native storage is unavailable
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [isLoading, setIsLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);

  const bootstrap = useCallback(async () => {
    try {
      const storedToken = await safeGetItem(AUTH_TOKEN_KEY);
      if (!storedToken) {
        return;
      }
      const me = await authApi.me(storedToken);
      setToken(storedToken);
      setUser(me);
    } catch {
      await safeRemoveItem(AUTH_TOKEN_KEY);
      setToken(null);
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    void bootstrap();
  }, [bootstrap]);

  const signIn = useCallback(async (email: string, password: string) => {
    const response = await authApi.login(email, password);
    await safeSetItem(AUTH_TOKEN_KEY, response.token);
    setToken(response.token);
    setUser(response.user);
  }, []);

  const signUp = useCallback(
    async (payload: {
      name: string;
      email: string;
      password: string;
      role?: 'admin' | 'teacher' | 'student';
    }) => {
      const response = await authApi.register(payload);
      await safeSetItem(AUTH_TOKEN_KEY, response.token);
      setToken(response.token);
      setUser(response.user);
    },
    [],
  );

  const signOut = useCallback(async () => {
    await safeRemoveItem(AUTH_TOKEN_KEY);
    setToken(null);
    setUser(null);
  }, []);

  const refreshUser = useCallback(async () => {
    const t = token ?? (await safeGetItem(AUTH_TOKEN_KEY));
    if (!t) return;
    try {
      const me = await authApi.me(t);
      setToken(t);
      setUser(me);
    } catch {
      await safeRemoveItem(AUTH_TOKEN_KEY);
      setToken(null);
      setUser(null);
    }
  }, [token]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      token,
      user,
      signIn,
      signUp,
      signOut,
      refreshUser,
    }),
    [isLoading, token, user, signIn, signUp, signOut, refreshUser],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth precisa estar dentro de AuthProvider');
  }
  return context;
}

