"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AnswerAck, SessionStatePayload } from "@/lib/realtime-api";

/** Paleta estilo quiz (4 formas × cores fortes). Cicla se houver mais opções. */
const OPTION_VISUALS = [
  {
    shape: "triangle" as const,
    bar: "bg-[#f43f5e]",
    panel:
      "border-rose-400/35 bg-gradient-to-br from-rose-600/95 via-rose-700/90 to-rose-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
    shapeFill: "text-white",
  },
  {
    shape: "diamond" as const,
    bar: "bg-[#3b82f6]",
    panel:
      "border-blue-400/35 bg-gradient-to-br from-blue-600/95 via-blue-700/90 to-blue-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]",
    shapeFill: "text-white",
  },
  {
    shape: "circle" as const,
    bar: "bg-[#fbbf24]",
    panel:
      "border-amber-300/40 bg-gradient-to-br from-amber-500/95 via-amber-600/90 to-amber-950/95 shadow-[inset_0_1px_0_rgba(255,255,255,0.15)]",
    shapeFill: "text-amber-950",
  },
  {
    shape: "square" as const,
    bar: "bg-[var(--color-accent)]",
    panel:
      "border-[var(--color-accent-border)] bg-gradient-to-br from-[#0f3d2c]/95 via-[#0d281c]/90 to-[#070914] shadow-[inset_0_1px_0_rgba(89,244,168,0.2)]",
    shapeFill: "text-[var(--color-accent)]",
  },
];

function ShapeIcon({
  kind,
  className,
}: {
  kind: (typeof OPTION_VISUALS)[number]["shape"];
  className?: string;
}) {
  const common = cn("size-9 shrink-0 drop-shadow-sm", className);
  switch (kind) {
    case "triangle":
      return (
        <svg viewBox="0 0 48 48" className={common} aria-hidden>
          <polygon points="24,6 44,42 4,42" fill="currentColor" className="opacity-95" />
        </svg>
      );
    case "diamond":
      return (
        <svg viewBox="0 0 48 48" className={common} aria-hidden>
          <polygon points="24,4 44,24 24,44 4,24" fill="currentColor" className="opacity-95" />
        </svg>
      );
    case "circle":
      return (
        <svg viewBox="0 0 48 48" className={common} aria-hidden>
          <circle cx="24" cy="24" r="18" fill="currentColor" className="opacity-95" />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 48 48" className={common} aria-hidden>
          <rect x="10" y="10" width="28" height="28" rx="6" fill="currentColor" className="opacity-95" />
        </svg>
      );
    default:
      return null;
  }
}

function useNow(intervalMs: number, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs, active]);
  return now;
}

function QuizTimerBar({
  endsAt,
  totalMs,
  active,
  paused,
}: {
  endsAt: number | null;
  totalMs: number;
  active: boolean;
  paused: boolean;
}) {
  const tick = active && !paused && !!endsAt && totalMs > 0;
  const now = useNow(80, tick);
  const { ratioLeft, secondsLeft } = useMemo(() => {
    if (!endsAt || totalMs <= 0) {
      return { ratioLeft: 0, secondsLeft: 0 };
    }
    const left = Math.max(0, endsAt - now);
    return {
      ratioLeft: Math.min(1, left / totalMs),
      secondsLeft: Math.ceil(left / 1000),
    };
  }, [endsAt, totalMs, now]);

  const hue =
    ratioLeft > 0.45
      ? "var(--color-accent)"
      : ratioLeft > 0.2
        ? "#fbbf24"
        : "var(--color-danger)";

  if (!active) {
    return (
      <div className="border-b border-border bg-bg-elevated/80 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto h-2 max-w-lg overflow-hidden rounded-full bg-surface-muted" />
      </div>
    );
  }

  if (paused) {
    return (
      <div className="border-b border-border bg-bg-elevated/90 px-4 py-3 backdrop-blur-md">
        <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
          <div className="h-2 flex-1 overflow-hidden rounded-full bg-surface-muted">
            <div
              className="h-full rounded-full bg-muted transition-all duration-300"
              style={{ width: `${ratioLeft * 100}%` }}
            />
          </div>
          <span className="text-xs font-black tabular-nums tracking-tight text-muted">
            Pausado
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="border-b border-border bg-bg-elevated/90 px-4 py-3 backdrop-blur-md">
      <div className="mx-auto max-w-lg">
        <div className="h-2.5 w-full overflow-hidden rounded-full bg-surface-muted ring-1 ring-border/80">
          <div
            className="h-full rounded-full transition-[width] duration-100 ease-linear"
            style={{
              width: `${ratioLeft * 100}%`,
              background: `linear-gradient(90deg, ${hue}, color-mix(in srgb, ${hue} 75%, white))`,
              boxShadow: `0 0 20px color-mix(in srgb, ${hue} 40%, transparent)`,
            }}
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] font-extrabold uppercase tracking-widest text-muted">
            Tempo
          </span>
          <span
            className="font-mono text-lg font-black tabular-nums tracking-tight text-text"
            style={{
              color:
                secondsLeft <= 3 && secondsLeft > 0
                  ? "var(--color-danger-text-bright)"
                  : undefined,
            }}
          >
            {secondsLeft}s
          </span>
        </div>
      </div>
    </div>
  );
}

function mergeReveal(
  state: SessionStatePayload,
  lastAck: AnswerAck | null,
): {
  selectedOptionIndex: number;
  correct: boolean;
  correctOptionIndex: number;
} | null {
  if (state.answerReveal) return state.answerReveal;
  if (
    lastAck?.accepted &&
    lastAck.correct !== undefined &&
    lastAck.correctOptionIndex !== undefined &&
    lastAck.selectedOptionIndex !== undefined
  ) {
    return {
      selectedOptionIndex: lastAck.selectedOptionIndex,
      correct: lastAck.correct,
      correctOptionIndex: lastAck.correctOptionIndex,
    };
  }
  return null;
}

export function QuizGuestPlayUI({
  nameTrim,
  sessionCode,
  guestId,
  state,
  lastAck,
  busy,
  onPick,
  onLeave,
}: {
  nameTrim: string;
  sessionCode: string;
  guestId: string;
  state: SessionStatePayload;
  lastAck: AnswerAck | null;
  busy: boolean;
  onPick: (index: number) => void;
  onLeave: () => void;
}) {
  const s = state.session;
  const q = state.currentQuestion;
  const reveal = mergeReveal(state, lastAck);

  const currentQuestionId =
    s.currentQuestionIndex >= 0 ? s.questionIds[s.currentQuestionIndex] : null;

  const alreadyAnswered =
    !!currentQuestionId &&
    s.answersByQuestion[currentQuestionId]?.[guestId] !== undefined;

  const totalMs = useMemo(() => {
    if (!q || s.currentQuestionStartedAt === null || s.currentQuestionEndsAt === null) {
      return (q?.timeLimitSeconds ?? 20) * 1000;
    }
    return Math.max(
      1000,
      s.currentQuestionEndsAt - s.currentQuestionStartedAt,
    );
  }, [q, s.currentQuestionStartedAt, s.currentQuestionEndsAt]);

  const timerActive = s.status === "running" && !!q;

  return (
    <div className="flex min-h-dvh flex-col bg-bg">
      <QuizTimerBar
        endsAt={s.currentQuestionEndsAt}
        totalMs={totalMs}
        active={timerActive && !!q}
        paused={s.status === "paused"}
      />

      <header className="flex items-center justify-between gap-2 border-b border-border/60 px-4 py-2.5">
        <div className="min-w-0 flex-1">
          <p className="truncate text-xs font-bold text-text-secondary">{nameTrim}</p>
          <p className="font-mono text-[10px] font-black tracking-[0.2em] text-muted">
            {sessionCode}
          </p>
        </div>
        {s.status === "waiting" ? (
          <span className="shrink-0 rounded-full border border-accent-border bg-chip-on-bg px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-accent">
            Sala
          </span>
        ) : null}
      </header>

      <main className="flex flex-1 flex-col px-4 pb-3 pt-5">
        {s.status === "waiting" ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 px-2">
            <div className="relative">
              <div className="absolute inset-0 animate-ping rounded-full bg-accent/20" />
              <div className="relative flex size-20 items-center justify-center rounded-2xl border-2 border-accent-border bg-accent-muted">
                <span className="text-3xl">⏳</span>
              </div>
            </div>
            <p className="text-center text-xl font-black text-text">Aguarde o professor</p>
            <p className="max-w-xs text-center text-sm text-muted">
              A pergunta aparece aqui quando a rodada começar.
            </p>
          </div>
        ) : null}

        {s.status !== "waiting" && !q ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-3">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
            <p className="text-sm font-bold text-muted">Carregando…</p>
          </div>
        ) : null}

        {q ? (
          <div className="flex flex-1 flex-col">
            <div className="rounded-2xl border border-border bg-card/80 p-4 shadow-[0_12px_40px_-16px_rgba(0,0,0,0.65)] ring-1 ring-border/40 backdrop-blur-sm">
              <p className="text-center text-lg font-black leading-snug text-text sm:text-xl">
                {q.statement}
              </p>
            </div>

            {reveal ? (
              <div
                className={cn(
                  "mt-4 rounded-2xl border-2 px-4 py-4 text-center transition-all",
                  reveal.correct
                    ? "border-[var(--color-accent-border)] bg-[var(--color-accent-muted)]"
                    : "border-[var(--color-danger-border)] bg-[var(--color-danger-muted)]",
                )}
                role="status"
              >
                <p
                  className={cn(
                    "text-2xl font-black tracking-tight",
                    reveal.correct ? "text-[var(--color-accent)]" : "text-[var(--color-danger-text-bright)]",
                  )}
                >
                  {reveal.correct ? "Correto!" : "Errado"}
                </p>
                {!reveal.correct ? (
                  <p className="mt-1 text-xs font-semibold text-muted">
                    A alternativa certa está destacada abaixo.
                  </p>
                ) : null}
              </div>
            ) : null}

            {lastAck?.accepted === false && lastAck.reason ? (
              <p className="mt-3 text-center text-sm font-bold text-danger-text-bright">
                {lastAck.reason}
              </p>
            ) : null}

            <div
              className={cn(
                "mt-6 grid flex-1 gap-3 sm:gap-4",
                q.options.length <= 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-2",
              )}
            >
              {q.options.map((label, i) => {
                const vis = OPTION_VISUALS[i % OPTION_VISUALS.length]!;
                const disabled = alreadyAnswered || busy || s.status !== "running";
                const isCorrect = reveal && i === reveal.correctOptionIndex;
                const isWrongPick =
                  reveal && i === reveal.selectedOptionIndex && !reveal.correct;
                return (
                  <button
                    key={i}
                    type="button"
                    disabled={disabled}
                    onClick={() => onPick(i)}
                    className={cn(
                      "flex min-h-[100px] flex-col items-stretch justify-between rounded-2xl border-2 p-3 text-left transition-all duration-200 sm:min-h-[112px]",
                      vis.panel,
                      disabled && !reveal ? "opacity-90" : "",
                      reveal
                        ? isCorrect
                          ? "ring-2 ring-[var(--color-accent)] ring-offset-2 ring-offset-bg"
                          : isWrongPick
                            ? "ring-2 ring-[var(--color-danger)] ring-offset-2 ring-offset-bg opacity-95"
                            : "opacity-55"
                        : "hover:brightness-110 active:scale-[0.98] disabled:active:scale-100",
                    )}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <ShapeIcon kind={vis.shape} className={vis.shapeFill} />
                      <span
                        className={cn(
                          "rounded-lg px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-white/90",
                          vis.bar,
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                    </div>
                    <p
                      className={cn(
                        "mt-2 line-clamp-4 text-sm font-black leading-tight sm:text-base",
                        vis.shape === "circle" ? "text-amber-950" : "text-white",
                        vis.shape === "square" ? "!text-[var(--color-text-secondary)]" : "",
                      )}
                    >
                      {label}
                    </p>
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}
      </main>

      <footer className="mt-auto border-t border-border/60 px-4 py-3">
        <Button
          variant="ghost"
          className="w-full text-muted hover:text-text-secondary"
          onClick={onLeave}
        >
          Sair da sessão
        </Button>
      </footer>
    </div>
  );
}
