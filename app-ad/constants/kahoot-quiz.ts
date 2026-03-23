/**
 * Quiz ao vivo: fundos alinhados ao AppTheme; opções com cores distintas mas saturadas
 * para o aluno reconhecer forma/cor (sem tela roxa/clara do Kahoot clássico).
 */
import { AppTheme } from './app-theme';

export const KAHOOT = {
  /** Fundo principal das telas do quiz */
  bg: AppTheme.bg,
  bgElevated: AppTheme.bgElevated,
  /** Mesmo verde do restante do app */
  lime: AppTheme.accent,
  white: AppTheme.text,
  muted: AppTheme.muted,
} as const;

export type KahootAnswerSlot = {
  bg: string;
  shape: string;
  name: string;
  letter: string;
};

/** Quatro cores escuras e contrastantes (texto branco), harmonizando com dark UI */
export const KAHOOT_ANSWER_SLOTS: KahootAnswerSlot[] = [
  { bg: '#9D174D', shape: '▲', name: 'Triângulo', letter: 'A' },
  { bg: '#1D4ED8', shape: '◆', name: 'Losango', letter: 'B' },
  { bg: '#B45309', shape: '●', name: 'Círculo', letter: 'C' },
  { bg: '#047857', shape: '■', name: 'Quadrado', letter: 'D' },
];

export const TIMER_PRESETS = [5, 10, 15, 20, 30, 40, 60, 90, 120] as const;
