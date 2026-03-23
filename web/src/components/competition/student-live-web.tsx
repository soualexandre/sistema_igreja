"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuizSocket } from "@/hooks/use-quiz-socket";
import { realtimeApi, type SessionStatePayload } from "@/lib/realtime-api";
import { formatRankingRowSummary } from "@/lib/quiz-ranking-display";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";

function normalizeCode(raw: string) {
  return raw.replace(/[^a-zA-Z0-9]/g, "").slice(0, 8).toUpperCase();
}

export function StudentLiveWeb({
  token,
  userId,
}: {
  token: string;
  userId: string;
}) {
  const [pin, setPin] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [state, setState] = useState<SessionStatePayload | null>(null);
  const [lastAck, setLastAck] = useState<{ accepted: boolean; reason?: string } | null>(null);

  const sessionId = state?.session.id ?? null;
  const codeNormalized = useMemo(() => normalizeCode(pin), [pin]);

  const applyState = useCallback((payload: SessionStatePayload) => {
    setState(payload);
    setError(null);
  }, []);

  const { emitJoin } = useQuizSocket({
    mode: "auth",
    token,
    enabled: !!sessionId,
    onState: applyState,
  });

  useEffect(() => {
    if (!sessionId || !token) return;
    let id: ReturnType<typeof setInterval>;
    const tick = async () => {
      try {
        const fresh = await realtimeApi.getSessionState(token, sessionId);
        applyState(fresh);
        if (fresh.session.status === "finished") clearInterval(id);
      } catch {
        /* ignore */
      }
    };
    void tick();
    id = setInterval(() => void tick(), 2000);
    return () => clearInterval(id);
  }, [sessionId, token, applyState]);

  const currentQ = state?.currentQuestion ?? null;
  const endsAt = state?.session.currentQuestionEndsAt ?? null;
  const currentQuestionId =
    state && state.session.currentQuestionIndex >= 0
      ? state.session.questionIds[state.session.currentQuestionIndex]
      : null;

  const alreadyAnswered =
    !!currentQuestionId &&
    !!state &&
    state.session.answersByQuestion[currentQuestionId]?.[userId] !== undefined;

  useEffect(() => {
    setLastAck(null);
  }, [currentQuestionId]);

  const onEnter = async () => {
    if (codeNormalized.length < 4) {
      setError("Digite o PIN.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = await realtimeApi.joinSession(token, codeNormalized);
      applyState(payload);
      try {
        const via = await emitJoin(codeNormalized);
        if (via) applyState(via);
      } catch {
        /* ok */
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Não foi possível entrar");
      setState(null);
    } finally {
      setBusy(false);
    }
  };

  const onPick = async (index: number) => {
    if (!state || !currentQ || alreadyAnswered) return;
    setBusy(true);
    try {
      const ack = await realtimeApi.answerQuestion(token, state.session.id, index);
      setLastAck(ack);
      const fresh = await realtimeApi.getSessionState(token, state.session.id);
      applyState(fresh);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao responder");
    } finally {
      setBusy(false);
    }
  };

  const onLeave = () => {
    setState(null);
    setPin("");
    setError(null);
  };

  if (!state) {
    return (
      <div className="px-4 py-8">
        <Card className="border-border bg-card">
          <CardContent className="space-y-4 pt-6">
            <h2 className="text-xl font-black text-text">Entrar com PIN</h2>
            <Input
              placeholder="Código da sala"
              value={pin}
              onChange={(e) => setPin(e.target.value.toUpperCase())}
              className="text-center font-mono text-lg tracking-widest"
            />
            {error ? (
              <p className="text-sm text-danger-text-bright">{error}</p>
            ) : null}
            <Button className="w-full" disabled={busy} onClick={() => void onEnter()}>
              {busy ? "Entrando…" : "Entrar"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (state.session.status === "finished") {
    return (
      <div className="space-y-4 px-4 py-8">
        <p className="text-center text-lg font-black text-text">Sessão encerrada</p>
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase text-accent">
            Ranking · tempo nas corretas
          </p>
          {state.ranking.slice(0, 10).map((r, i) => {
            const { main, sub } = formatRankingRowSummary(r);
            return (
              <div
                key={r.userId}
                className="flex items-center justify-between gap-2 rounded-lg border border-border bg-card px-3 py-2"
              >
                <span className="text-muted">{i + 1}</span>
                <span className="min-w-0 flex-1 truncate font-bold">{r.name}</span>
                <div className="shrink-0 text-right">
                  <span className="font-mono font-black text-accent">{main}</span>
                  {sub ? (
                    <span className="ml-1 block text-[10px] font-bold text-muted">{sub}</span>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
        <Button variant="secondary" className="w-full" onClick={onLeave}>
          Sair
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <p className="text-center text-sm text-muted">
        PIN {state.session.code} ·{" "}
        {state.session.status === "waiting" ? "Aguardando" : "Em andamento"}
      </p>
      {state.session.status === "waiting" ? (
        <p className="mt-4 text-center text-muted">Aguardando o professor iniciar…</p>
      ) : null}
      {currentQ ? (
        <div className="mt-6 space-y-4">
          <h3 className="text-lg font-black text-text">{currentQ.statement}</h3>
          {lastAck?.accepted === true ? (
            <p className="text-sm text-accent">Resposta registrada.</p>
          ) : null}
          {lastAck?.accepted === false && lastAck.reason ? (
            <p className="text-sm text-danger-text-bright">{lastAck.reason}</p>
          ) : null}
          <div className="grid grid-cols-2 gap-3">
            {currentQ.options.map((label, i) => {
              const disabled = alreadyAnswered || busy;
              return (
                <button
                  key={i}
                  type="button"
                  disabled={disabled}
                  onClick={() => void onPick(i)}
                  className="min-h-[72px] rounded-xl border border-border bg-card p-3 text-left text-sm font-bold text-text-secondary transition-colors hover:border-accent-border disabled:opacity-50"
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      ) : (
        <p className="mt-8 text-center text-muted">Carregando pergunta…</p>
      )}
      <Button variant="ghost" className="mt-8 w-full" onClick={onLeave}>
        Sair da sessão
      </Button>
    </div>
  );
}
