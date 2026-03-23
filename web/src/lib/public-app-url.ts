/**
 * URL base do site Next (página pública), para links compartilháveis.
 *
 * Defina em **dev** e **prod**:
 * `NEXT_PUBLIC_WEB_URL=https://seu-dominio.com`
 * (sem barra no final)
 *
 * Se não estiver definido, no **cliente** usa `window.location.origin` (útil em dev local).
 */
export function getPublicWebBaseUrl(): string {
  const fromEnv = process.env.NEXT_PUBLIC_WEB_URL?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/$/, "");
  }
  if (typeof window !== "undefined") {
    return window.location.origin;
  }
  return "";
}

/** URL absoluta da página do quiz convidado. */
export function getQuizPublicUrl(): string {
  const base = getPublicWebBaseUrl();
  const path = "/quiz";
  if (!base) {
    return path;
  }
  return `${base}${path}`;
}
