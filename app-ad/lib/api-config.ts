/** Base URL da API REST, ex: http://192.168.1.10:3333/api */
export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:3333/api';

/** Origem do servidor (sem /api) — usada pelo Socket.IO */
export function getSocketOrigin(): string {
  return API_BASE_URL.replace(/\/api\/?$/i, '');
}
