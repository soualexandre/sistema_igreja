/**
 * Porta do backend (REST direto + Socket.IO). Com proxy `/api` do Next, o browser
 * não usa esta porta para HTTP — só para WebSocket, se necessário.
 */
const DEFAULT_API_PORT = process.env.NEXT_PUBLIC_API_PORT ?? "3333";

/**
 * Base da API REST.
 *
 * - **Produção / API externa:** `NEXT_PUBLIC_API_URL` (ex. `https://api.site.com/api`).
 * - **Dev (padrão):** no navegador usa **`/api`** → Next faz proxy para o Nest
 *   (`BACKEND_PROXY_TARGET`, default `http://127.0.0.1:3333`). Assim o celular na
 *   mesma rede só precisa alcançar a porta do Next (ex. 3000), não a 3333.
 * - **SSR no Next:** `http://127.0.0.1:PORTA/api` para falar com o backend local.
 */
export function getApiBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }

  if (typeof window !== "undefined") {
    return "/api";
  }

  return `http://127.0.0.1:${DEFAULT_API_PORT}/api`;
}

/**
 * Origem Socket.IO (sem `/api`). No dev em LAN continua sendo host:3333 no cliente,
 * pois o Next não faz proxy de WebSocket por padrão. O quiz convidado funciona
 * só com HTTP + polling se o socket falhar.
 */
export function getSocketOrigin(): string {
  const fromEnv = process.env.NEXT_PUBLIC_API_URL?.trim();
  if (fromEnv) {
    const trimmed = fromEnv.replace(/\/$/, "");
    const withoutApi = trimmed.replace(/\/api\/?$/i, "");
    return withoutApi || trimmed;
  }

  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${DEFAULT_API_PORT}`;
  }

  return `http://127.0.0.1:${DEFAULT_API_PORT}`;
}
