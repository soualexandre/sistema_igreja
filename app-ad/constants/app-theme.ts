/**
 * Tema único do app: modo escuro, cinzas (slate) + verde mint (#59F4A8).
 * Use estes tokens em todas as telas para manter consistência visual.
 */
export const AppTheme = {
  bg: '#070914',
  bgElevated: '#0B0F1A',
  /** Cartões e superfícies */
  card: '#111827',
  cardHover: '#0F172A',
  /** Inputs e poços */
  inputBg: '#0B1224',
  inputBorder: '#1E293B',
  border: '#1F2937',
  borderStrong: '#334155',
  /** Texto */
  text: '#F8FAFC',
  textSecondary: '#E2E8F0',
  muted: '#94A3B8',
  mutedDark: '#64748B',
  placeholder: '#64748B',
  /** Marca */
  accent: '#59F4A8',
  accentMuted: 'rgba(89, 244, 168, 0.12)',
  accentMutedStrong: 'rgba(89, 244, 168, 0.2)',
  accentBorder: 'rgba(89, 244, 168, 0.35)',
  accentGlow: 'rgba(89, 244, 168, 0.15)',
  chipOnBg: '#0f1f18',
  onAccent: '#0A0B12',
  /** Erro / recusa — tons que combinam com o dark slate */
  danger: '#F87171',
  dangerMuted: 'rgba(248, 113, 113, 0.12)',
  dangerBorder: 'rgba(248, 113, 113, 0.35)',
  dangerText: '#FCA5A5',
  dangerTextBright: '#FECACA',
  /** Aviso suave (pouco uso; prefira accent) */
  warnMuted: 'rgba(251, 191, 36, 0.12)',
  successMuted: 'rgba(34, 197, 94, 0.15)',
  /** Modal / overlay */
  overlay: 'rgba(2, 6, 23, 0.88)',
  modalSurface: '#0c1222',
  /** Avatar / blocos neutros */
  surfaceMuted: '#1E293B',
  /** Links secundários (evitar roxo isolado; verde-acinzentado) */
  link: '#86EFAC',
} as const;

export type AppThemeName = keyof typeof AppTheme;
