"use client";

import { memo, useCallback, useEffect, useState } from "react";
import { competitionsApi, type CompetitionRunRow } from "@/lib/competitions-api";
import { classesApi, type Classroom } from "@/lib/classes-api";
import {
  realtimeApi,
  type RankingRow,
  type RealtimeQuestionDto,
  type SessionStatePayload,
} from "@/lib/realtime-api";
import { formatRankingRowSummary } from "@/lib/quiz-ranking-display";
import { useAuthStore } from "@/stores/auth-store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { QuizShareLinkPanel } from "@/components/competition/quiz-share-link-panel";
import { cn } from "@/lib/utils";

type Tab = "live" | "questions" | "history";

const QRow = memo(function QRow({
  q,
  onEdit,
  onDelete,
}: {
  q: RealtimeQuestionDto;
  onEdit: (q: RealtimeQuestionDto) => void;
  onDelete: (id: string) => void;
}) {
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="text-sm font-bold text-text-secondary">{q.statement}</p>
      <div className="mt-2 flex gap-2">
        <Button size="sm" variant="secondary" onClick={() => onEdit(q)}>
          Editar
        </Button>
        <Button size="sm" variant="danger" onClick={() => onDelete(q.id)}>
          Excluir
        </Button>
      </div>
    </div>
  );
});

function LiveHost({
  token,
  competitionId,
  competitionName,
  pickable,
}: {
  token: string;
  competitionId: string;
  competitionName: string;
  pickable: { id: string; name: string }[];
}) {
  const [questions, setQuestions] = useState<RealtimeQuestionDto[]>([]);
  const [session, setSession] = useState<SessionStatePayload | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedClassId, setSelectedClassId] = useState<string | null>(null);
  const [loadingQs, setLoadingQs] = useState(false);

  useEffect(() => {
    if (pickable.length === 1) setSelectedClassId(pickable[0]!.id);
    else
      setSelectedClassId((prev) =>
        prev && pickable.some((p) => p.id === prev) ? prev : null,
      );
  }, [pickable]);

  const fetchQs = useCallback(async () => {
    if (!token) return;
    setLoadingQs(true);
    try {
      const qs = await realtimeApi.listQuestions(token, { competitionId });
      setQuestions(qs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoadingQs(false);
    }
  }, [token, competitionId]);

  useEffect(() => {
    void fetchQs();
  }, [fetchQs]);

  useEffect(() => {
    if (!session?.session.id || !token) return;
    const id = setInterval(async () => {
      try {
        const s = await realtimeApi.getSessionState(token, session.session.id);
        setSession(s);
      } catch {
        /* ignore */
      }
    }, 1600);
    return () => clearInterval(id);
  }, [session?.session.id, token]);

  const startGame = async () => {
    if (!selectedClassId || !questions.length) {
      setError(
        !questions.length
          ? "Adicione perguntas na aba Perguntas."
          : "Selecione a turma do PIN.",
      );
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const created = await realtimeApi.startSession(token, {
        competitionId,
        classId: selectedClassId,
        questionIds: questions.map((q) => q.id),
      });
      const full = await realtimeApi.getSessionState(token, created.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao iniciar");
    } finally {
      setBusy(false);
    }
  };

  const className =
    session &&
    pickable.find((p) => p.id === session.session.classId)?.name;

  if (!session) {
    const canStart =
      questions.length > 0 && !!selectedClassId && pickable.length > 0;
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Ao vivo · {competitionName}. O PIN vale só para a turma escolhida.
        </p>
        {pickable.length > 1 ? (
          <div>
            <p className="mb-2 text-xs font-bold text-muted">Turma do PIN</p>
            <div className="flex flex-wrap gap-2">
              {pickable.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedClassId(p.id)}
                  className={cn(
                    "rounded-full border px-3 py-2 text-sm font-bold",
                    selectedClassId === p.id
                      ? "border-accent bg-accent-muted text-accent"
                      : "border-border text-muted",
                  )}
                >
                  {p.name}
                </button>
              ))}
            </div>
          </div>
        ) : pickable.length === 1 ? (
          <p className="text-sm text-muted">Turma: {pickable[0]!.name}</p>
        ) : (
          <p className="text-sm text-danger-text-bright">
            Nenhuma turma disponível.
          </p>
        )}
        {loadingQs ? <p className="text-muted">Carregando perguntas…</p> : null}
        <p className="text-center text-2xl font-black text-accent">
          {questions.length} pergunta(s)
        </p>
        <QuizShareLinkPanel className="mt-4" />
        {error ? (
          <p className="text-sm text-danger-text-bright">{error}</p>
        ) : null}
        <Button
          className="w-full"
          disabled={!canStart || busy}
          onClick={() => void startGame()}
        >
          {busy ? "…" : "Gerar PIN da sala"}
        </Button>
      </div>
    );
  }

  const s = session.session;
  const canBegin = s.status === "waiting";
  const canPause = s.status === "running" && !!session.currentQuestion;
  const canResume = s.status === "paused";

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    try {
      await fn();
      const full = await realtimeApi.getSessionState(token, s.id);
      setSession(full);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <QuizShareLinkPanel compact />
      <p className="text-center font-mono text-3xl font-black tracking-widest text-accent">
        {s.code}
      </p>
      <p className="text-center text-sm text-muted">
        {className ?? "Turma"} · {s.status} · {s.participantCount ?? 0} jogadores
      </p>
      {session.currentQuestion ? (
        <Card>
          <CardContent className="pt-4">
            <p className="text-sm font-bold text-accent">Pergunta atual</p>
            <p className="mt-2 text-text-secondary">
              {session.currentQuestion.statement}
            </p>
          </CardContent>
        </Card>
      ) : null}
      {error ? (
        <p className="text-sm text-danger-text-bright">{error}</p>
      ) : null}
      <div className="flex flex-col gap-2">
        {s.status !== "finished" ? (
          <>
            {canBegin ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await realtimeApi.nextQuestion(token, s.id);
                  })
                }
              >
                Iniciar perguntas
              </Button>
            ) : null}
            {canPause ? (
              <Button
                variant="secondary"
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await realtimeApi.pauseSession(token, s.id);
                  })
                }
              >
                Pausar
              </Button>
            ) : null}
            {canResume ? (
              <Button
                disabled={busy}
                onClick={() =>
                  void run(async () => {
                    await realtimeApi.resumeSession(token, s.id);
                  })
                }
              >
                Continuar
              </Button>
            ) : null}
            <Button
              variant="danger"
              disabled={busy}
              onClick={() =>
                void run(async () => {
                  await realtimeApi.endSession(token, s.id);
                })
              }
            >
              Encerrar sessão
            </Button>
          </>
        ) : (
          <Button variant="secondary" onClick={() => setSession(null)}>
            Nova sessão
          </Button>
        )}
      </div>
      <p className="text-xs font-bold uppercase text-muted">
        Ranking · menos tempo nas corretas
      </p>
      <div className="space-y-1">
        {session.ranking.slice(0, 10).map((r, i) => {
          const { main, sub } = formatRankingRowSummary(r);
          return (
            <div
              key={r.userId}
              className="flex items-center justify-between gap-2 rounded-lg border border-border px-2 py-1.5 text-sm"
            >
              <span className="shrink-0 text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1 truncate font-semibold">{r.name}</span>
              <div className="shrink-0 text-right">
                <span className="font-mono font-black text-accent">{main}</span>
                {sub ? (
                  <span className="ml-1.5 text-[10px] font-bold text-muted">{sub}</span>
                ) : null}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function QuestionsPanel({
  token,
  competitionId,
  onChanged,
}: {
  token: string;
  competitionId: string;
  onChanged: () => void;
}) {
  const [list, setList] = useState<RealtimeQuestionDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [statement, setStatement] = useState("");
  const [opts, setOpts] = useState(["", "", "", ""]);
  const [correct, setCorrect] = useState(0);
  const [timer, setTimer] = useState(20);
  const [editing, setEditing] = useState<RealtimeQuestionDto | null>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const qs = await realtimeApi.listQuestions(token, { competitionId });
      setList(qs);
    } finally {
      setLoading(false);
    }
  }, [token, competitionId]);

  useEffect(() => {
    void load();
  }, [load]);

  const submit = async () => {
    const st = statement.trim();
    const cleaned = opts.map((x) => x.trim()).filter(Boolean);
    if (st.length < 3 || cleaned.length < 2) return;
    setBusy(true);
    try {
      if (editing) {
        await realtimeApi.updateQuestion(token, editing.id, {
          statement: st,
          options: cleaned,
          correctOptionIndex: Math.min(correct, cleaned.length - 1),
          timeLimitSeconds: timer,
        });
      } else {
        await realtimeApi.createQuestion(token, {
          competitionId,
          statement: st,
          options: cleaned,
          correctOptionIndex: Math.min(correct, cleaned.length - 1),
          timeLimitSeconds: timer,
        });
      }
      setStatement("");
      setOpts(["", "", "", ""]);
      setCorrect(0);
      setEditing(null);
      await load();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (q: RealtimeQuestionDto) => {
    setEditing(q);
    setStatement(q.statement);
    const o = [...q.options];
    while (o.length < 4) o.push("");
    setOpts(o.slice(0, 4) as string[]);
    setCorrect(q.correctOptionIndex);
    setTimer(q.timeLimitSeconds);
  };

  const del = async (id: string) => {
    if (!confirm("Excluir pergunta?")) return;
    try {
      await realtimeApi.deleteQuestion(token, id);
      await load();
      onChanged();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Erro");
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">
            {editing ? "Editar" : "Nova"} pergunta
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Input
            placeholder="Enunciado"
            value={statement}
            onChange={(e) => setStatement(e.target.value)}
          />
          {opts.map((o, i) => (
            <Input
              key={i}
              placeholder={`Alternativa ${i + 1}`}
              value={o}
              onChange={(e) => {
                const n = [...opts];
                n[i] = e.target.value;
                setOpts(n);
              }}
            />
          ))}
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted">Correta (índice 0-based)</span>
            <Input
              type="number"
              min={0}
              max={3}
              className="w-20"
              value={correct}
              onChange={(e) => setCorrect(Number(e.target.value) || 0)}
            />
            <span className="text-xs text-muted">Tempo (s)</span>
            <Input
              type="number"
              min={5}
              max={240}
              className="w-20"
              value={timer}
              onChange={(e) => setTimer(Number(e.target.value) || 20)}
            />
          </div>
          <div className="flex gap-2">
            {editing ? (
              <Button variant="ghost" onClick={() => setEditing(null)}>
                Cancelar edição
              </Button>
            ) : null}
            <Button disabled={busy} onClick={() => void submit()}>
              Salvar
            </Button>
          </div>
        </CardContent>
      </Card>
      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : (
        <div className="space-y-2">
          {list.map((q) => (
            <QRow key={q.id} q={q} onEdit={startEdit} onDelete={del} />
          ))}
        </div>
      )}
    </div>
  );
}

function HistoryPanel({ token, competitionId }: { token: string; competitionId: string }) {
  const [runs, setRuns] = useState<CompetitionRunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState<CompetitionRunRow | null>(null);

  useEffect(() => {
    void (async () => {
      try {
        const page = await competitionsApi.listRuns(token, competitionId, {
          take: 40,
        });
        setRuns(page.runs);
      } finally {
        setLoading(false);
      }
    })();
  }, [token, competitionId]);

  return (
    <div className="space-y-3">
      {loading ? (
        <p className="text-muted">Carregando…</p>
      ) : runs.length === 0 ? (
        <p className="text-muted">Nenhuma rodada ainda.</p>
      ) : (
        runs.map((r) => (
          <button
            key={r.id}
            type="button"
            onClick={() => setOpen(r)}
            className="w-full rounded-xl border border-border bg-card p-3 text-left"
          >
            <p className="font-bold text-text-secondary">{r.className}</p>
            <p className="text-xs text-muted">
              {new Date(r.createdAt).toLocaleString()} · PIN {r.code}
            </p>
          </button>
        ))
      )}
      {open ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <Card className="max-h-[80vh] w-full max-w-md overflow-y-auto border-border">
            <CardHeader>
              <CardTitle>Resultado</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-xs text-muted">
                {open.className} · {open.code}
              </p>
              <div className="mt-4 space-y-2">
                {Array.isArray(open.finalRanking) &&
                open.finalRanking.length > 0 ? (
                  (open.finalRanking as RankingRow[]).map((x, i) => {
                    const { main, sub } = formatRankingRowSummary(x);
                    return (
                      <div
                        key={i}
                        className="flex flex-col gap-0.5 border-b border-border/60 py-2 text-sm last:border-0"
                      >
                        <div className="flex justify-between gap-2">
                          <span className="font-bold text-text-secondary">{x.name}</span>
                          <span className="font-mono font-black text-accent">{main}</span>
                        </div>
                        {sub ? (
                          <span className="text-xs text-muted">{sub}</span>
                        ) : null}
                      </div>
                    );
                  })
                ) : (
                  <p className="text-sm text-muted">Sem ranking salvo.</p>
                )}
              </div>
              <Button
                variant="secondary"
                className="mt-4 w-full"
                onClick={() => setOpen(null)}
              >
                Fechar
              </Button>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}

export function CompetitionDetailWeb({
  competitionId,
  initialName,
}: {
  competitionId: string;
  initialName: string;
}) {
  const { token, user } = useAuthStore();
  const [tab, setTab] = useState<Tab>("live");
  const [name, setName] = useState(initialName);
  const [pickable, setPickable] = useState<{ id: string; name: string }[]>([]);
  const [refresh, setRefresh] = useState(0);

  useEffect(() => {
    if (!token || !user) return;
    void classesApi.list(token).then((list: Classroom[]) => {
      if (user.role === "admin") {
        setPickable(list.map((c) => ({ id: c.id, name: c.name })));
      } else {
        const ids = user.teacherClassIds ?? [];
        setPickable(
          list
            .filter((c) => ids.includes(c.id))
            .map((c) => ({ id: c.id, name: c.name })),
        );
      }
    });
  }, [token, user]);

  useEffect(() => {
    if (!token) return;
    void competitionsApi.list(token).then((list) => {
      const c = list.find((x) => x.id === competitionId);
      if (c) setName(c.name);
    });
  }, [token, competitionId]);

  if (!token || !user) return null;

  if (user.role === "student") {
    return (
      <div className="px-4 py-8 text-center text-muted">
        Área exclusiva de professores/admin.
      </div>
    );
  }

  const tabBtn = (t: Tab, label: string) => (
    <button
      type="button"
      onClick={() => setTab(t)}
      className={cn(
        "flex-1 rounded-xl border px-2 py-2 text-center text-xs font-extrabold sm:text-sm",
        tab === t
          ? "border-accent-border bg-chip-on-bg text-accent"
          : "border-border text-muted",
      )}
    >
      {label}
    </button>
  );

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-black text-text">{name}</h1>
      <div className="mt-4 flex gap-2">
        {tabBtn("live", "Ao vivo")}
        {tabBtn("questions", "Perguntas")}
        {tabBtn("history", "Histórico")}
      </div>
      <div className="mt-6">
        {tab === "live" ? (
          <LiveHost
            key={refresh}
            token={token}
            competitionId={competitionId}
            competitionName={name}
            pickable={pickable}
          />
        ) : null}
        {tab === "questions" ? (
          <QuestionsPanel
            token={token}
            competitionId={competitionId}
            onChanged={() => setRefresh((n) => n + 1)}
          />
        ) : null}
        {tab === "history" ? (
          <HistoryPanel token={token} competitionId={competitionId} />
        ) : null}
      </div>
    </div>
  );
}
