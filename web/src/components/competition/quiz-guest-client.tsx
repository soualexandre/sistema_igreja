"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuizSocket } from "@/hooks/use-quiz-socket";
import {
  realtimeApi,
  type GuestJoinResponse,
  type SessionStatePayload,
} from "@/lib/realtime-api";
import { QuizGuestPlayUI } from "@/components/competition/quiz-guest-play-ui";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatRankingRowSummary } from "@/lib/quiz-ranking-display";
import { cn } from "@/lib/utils";

const GUEST_SESSION_STORAGE_KEY = "ebd_quiz_guest_session_v1";

type StoredGuestSession = {
  guestId: string;
  sessionId: string;
  displayName: string;
  code: string;
};

function normalizeCode(raw: string) {
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}

function readStoredGuestSession(): StoredGuestSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(GUEST_SESSION_STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as Partial<StoredGuestSession>;
    if (
      typeof p.guestId === "string" &&
      p.guestId.length > 0 &&
      typeof p.sessionId === "string" &&
      p.sessionId.length > 0 &&
      typeof p.displayName === "string" &&
      typeof p.code === "string"
    ) {
      return {
        guestId: p.guestId,
        sessionId: p.sessionId,
        displayName: p.displayName,
        code: p.code,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

function persistGuestSession(data: StoredGuestSession) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(GUEST_SESSION_STORAGE_KEY, JSON.stringify(data));
  } catch {
    /* ignore */
  }
}

function clearGuestSessionStorage() {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.removeItem(GUEST_SESSION_STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

type EntryStep = "pin" | "name";

export function QuizGuestClient() {
  const [booting, setBooting] = useState(true);
  const [entryStep, setEntryStep] = useState<EntryStep>("pin");
  const [displayName, setDisplayName] = useState("");
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [guestId, setGuestId] = useState<string | null>(null);
  const [lastAck, setLastAck] = useState<{ accepted: boolean; reason?: string } | null>(
    null,
  );

  const sessionId = state?.session.id ?? null;
  const codeNormalized = useMemo(() => normalizeCode(pin), [pin]);
  const nameTrim = displayName.trim();

  const applyState = useCallback((payload: SessionStatePayload) => {
    setState(payload);
    setError(null);
  }, []);

  /** Restaura sessão após F5 (mesmo PIN + convidado já registrado na sala). */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const stored = readStoredGuestSession();
      if (!stored) {
        setBooting(false);
        return;
      }
      try {
        const fresh = await realtimeApi.getSessionStateGuest(
          stored.sessionId,
          stored.guestId,
        );
        if (cancelled) return;
        setGuestId(stored.guestId);
        setDisplayName(stored.displayName);
        setPin(stored.code);
        applyState(fresh);
      } catch {
        clearGuestSessionStorage();
      } finally {
        if (!cancelled) setBooting(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyState]);

  const { emitJoin } = useQuizSocket({
    mode: "guest",
    displayName: nameTrim.length >= 2 ? nameTrim : "Convidado",
    guestId,
    /* Socket ligado cedo para emitir join logo após o HTTP (convidado). */
    enabled: true,
    onState: applyState,
  });

  useEffect(() => {
    if (!sessionId || !guestId) return;
    let id: ReturnType<typeof setInterval>;
    const tick = async () => {
      try {
        const fresh = await realtimeApi.getSessionStateGuest(sessionId, guestId);
        applyState(fresh);
        if (fresh.session.status === "finished") clearInterval(id);
      } catch {
        /* ignore */
      }
    };
    void tick();
    id = setInterval(() => void tick(), 2000);
    return () => clearInterval(id);
  }, [sessionId, guestId, applyState]);

  const currentQ = state?.currentQuestion ?? null;
  const currentQuestionId =
    state && state.session.currentQuestionIndex >= 0
      ? state.session.questionIds[state.session.currentQuestionIndex]
      : null;

  const alreadyAnswered =
    !!currentQuestionId &&
    !!state &&
    !!guestId &&
    state.session.answersByQuestion[currentQuestionId]?.[guestId] !== undefined;

  useEffect(() => {
    setLastAck(null);
  }, [currentQuestionId]);

  const onContinueFromPin = () => {
    setError(null);
    if (codeNormalized.length < 4) {
      setError("Digite o PIN da sala (mínimo 4 caracteres).");
      return;
    }
    setEntryStep("name");
  };

  const onBackToPin = () => {
    setError(null);
    setEntryStep("pin");
  };

  const onEnter = async () => {
    if (entryStep !== "name") return;
    if (nameTrim.length < 2) {
      setError("Digite seu nome (mínimo 2 caracteres).");
      return;
    }
    if (codeNormalized.length < 4) {
      setError("PIN inválido. Volte e confira o código.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await realtimeApi.joinSessionGuest({
        sessionCode: codeNormalized,
        displayName: nameTrim,
      });
      const gid = (res as GuestJoinResponse).guestId;
      if (!gid) {
        throw new Error("Resposta inválida do servidor");
      }
      setGuestId(gid);
      const { guestId: _g, ...payload } = res as GuestJoinResponse;
      applyState(payload);
      persistGuestSession({
        guestId: gid,
        sessionId: payload.session.id,
        displayName: nameTrim,
        code: codeNormalized,
      });
      try {
        const via = await emitJoin(codeNormalized, {
          displayName: nameTrim,
          guestId: gid,
        });
        if (via && "session" in via) {
          const v = via as GuestJoinResponse;
          const { guestId: __, ...rest } = v;
          applyState(rest);
        }
      } catch {
        /* socket opcional */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar");
      setState(null);
      setGuestId(null);
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (index: number) => {
    if (!state || !guestId || !currentQ || alreadyAnswered) return;
    setBusy(true);
    try {
      const ack = await realtimeApi.answerQuestionGuest(
        state.session.id,
        guestId,
        index,
      );
      setLastAck(ack);
      const fresh = await realtimeApi.getSessionStateGuest(
        state.session.id,
        guestId,
      );
      applyState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao responder");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    clearGuestSessionStorage();
    setState(null);
    setGuestId(null);
    setPin("");
    setDisplayName("");
    setEntryStep("pin");
    setLastAck(null);
    setError(null);
  };

  if (booting) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-4">
        <div className="h-12 w-12 animate-spin rounded-full border-[3px] border-accent border-t-transparent" />
      </div>
    );
  }

  if (!state || !guestId) {
    return (
      <div className="flex min-h-dvh flex-col px-5 py-8">
        <div className="flex flex-1 flex-col items-center justify-center">
          {entryStep === "pin" ? (
            <>
              <h1 className="text-center text-2xl font-black tracking-tight text-text sm:text-3xl">
                PIN
              </h1>
              <Input
                aria-label="PIN da sala"
                placeholder="____"
                value={pin}
                onChange={(e) => {
                  setError(null);
                  setPin(e.target.value.toUpperCase());
                }}
                className="mt-8 h-14 max-w-xs border-2 text-center font-mono text-2xl tracking-[0.35em] sm:text-3xl"
                inputMode="text"
                autoCapitalize="characters"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") onContinueFromPin();
                }}
              />
              {error ? (
                <p className="mt-3 max-w-xs text-center text-sm text-danger-text-bright">
                  {error}
                </p>
              ) : null}
              <Button
                className="mt-8 h-12 w-full max-w-xs text-base font-black"
                disabled={busy}
                onClick={() => onContinueFromPin()}
              >
                OK
              </Button>
            </>
          ) : (
            <>
              <p className="max-w-sm px-1 text-center text-base font-bold leading-snug text-text sm:text-lg">
                Como quer que vejam seu nome no ranking?
              </p>
              <p className="mt-3 font-mono text-sm font-bold tracking-widest text-muted">
                {codeNormalized}
              </p>
              <Input
                aria-label="Como quer que vejam seu nome no ranking"
                placeholder="…"
                value={displayName}
                onChange={(e) => {
                  setError(null);
                  setDisplayName(e.target.value);
                }}
                autoComplete="nickname"
                autoFocus
                className="mt-8 h-14 max-w-sm border-2 text-center text-lg font-bold"
                onKeyDown={(e) => {
                  if (e.key === "Enter") void onEnter();
                }}
              />
              {error ? (
                <p className="mt-3 max-w-sm text-center text-sm text-danger-text-bright">
                  {error}
                </p>
              ) : null}
              <Button
                className="mt-8 h-12 w-full max-w-sm text-base font-black"
                disabled={busy}
                onClick={() => void onEnter()}
              >
                {busy ? "…" : "Entrar"}
              </Button>
              <button
                type="button"
                disabled={busy}
                onClick={() => onBackToPin()}
                className="mt-4 text-sm font-bold text-muted underline decoration-2 underline-offset-4 hover:text-accent"
              >
                Voltar
              </button>
            </>
          )}
        </div>
        <p className="pb-[max(1rem,env(safe-area-inset-bottom))] text-center">
          <Link
            href="/login"
            className="text-[11px] font-semibold uppercase tracking-wider text-muted/80 hover:text-accent"
          >
            Professor
          </Link>
        </p>
      </div>
    );
  }

  if (state.session.status === "finished") {
    return (
      <div className="min-h-dvh bg-bg px-4 py-10">
        <div className="mx-auto max-w-md space-y-6">
          <div className="rounded-2xl border border-border bg-card/90 p-6 text-center shadow-[0_16px_48px_-20px_rgba(0,0,0,0.7)] ring-1 ring-border/50">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-accent">Fim da sessão</p>
            <p className="mt-2 text-3xl font-black text-text">Parabéns!</p>
            <p className="mt-1 text-sm font-bold text-muted">{nameTrim}</p>
          </div>
          <div>
            <p className="mb-3 text-center text-xs font-black uppercase tracking-widest text-muted">
              Ranking · soma do tempo (corretas)
            </p>
            <ul className="space-y-2">
              {state.ranking.slice(0, 15).map((r, i) => {
                const { main, sub } = formatRankingRowSummary(r);
                return (
                  <li
                    key={r.userId}
                    className={cn(
                      "flex items-center justify-between gap-2 rounded-2xl border px-4 py-3",
                      i === 0
                        ? "border-accent-border bg-accent-muted"
                        : "border-border bg-card/80",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-8 shrink-0 items-center justify-center rounded-xl text-sm font-black",
                        i === 0 ? "bg-accent text-on-accent" : "bg-surface-muted text-muted",
                      )}
                    >
                      {i + 1}
                    </span>
                    <span className="min-w-0 flex-1 truncate text-left font-bold text-text-secondary">
                      {r.name}
                    </span>
                    <div className="shrink-0 text-right">
                      <span className="font-mono text-base font-black text-accent sm:text-lg">
                        {main}
                      </span>
                      {sub ? (
                        <span className="block text-[10px] font-bold text-muted">{sub}</span>
                      ) : null}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>
          <Button variant="secondary" className="h-12 w-full rounded-2xl font-black" onClick={onLeave}>
            Sair
          </Button>
        </div>
      </div>
    );
  }

  return (
    <QuizGuestPlayUI
      nameTrim={nameTrim}
      sessionCode={state.session.code}
      guestId={guestId}
      state={state}
      lastAck={lastAck}
      busy={busy}
      onPick={(i) => void onPick(i)}
      onLeave={onLeave}
    />
  );
}
