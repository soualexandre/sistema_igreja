"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { Trophy } from "lucide-react";
import {
  attendanceApi,
  type AttendanceComboLeaderboardRow,
  type MyAttendanceSummary,
} from "@/lib/attendance-api";
import {
  classesApi,
  type ClassAccessRequest,
  type Classroom,
} from "@/lib/classes-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useAuthStore } from "@/stores/auth-store";

const Podium = memo(function Podium({
  row,
  rank,
}: {
  row: AttendanceComboLeaderboardRow;
  rank: number;
}) {
  const colors = ["#eab308", "#94a3b8", "#ea580c", "#94a3b8"];
  const c = colors[rank - 1] ?? "#94a3b8";
  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-bg-elevated px-3 py-2">
      <div
        className="flex size-9 items-center justify-center rounded-lg border-2 text-sm font-black"
        style={{ borderColor: c, color: c }}
      >
        {rank}
      </div>
      <span className="min-w-0 flex-1 truncate font-bold text-text-secondary">
        {row.name}
      </span>
      <span className="text-sm font-extrabold text-muted">{row.comboScore} combo</span>
    </div>
  );
});

const ClassRow = memo(function ClassRow({
  c,
  onRequest,
  busy,
}: {
  c: Classroom;
  onRequest: (id: string) => void;
  busy: boolean;
}) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4">
      <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-muted text-lg font-black text-accent">
        {c.name.slice(0, 2).toUpperCase()}
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-extrabold text-text">{c.name}</p>
        <p className="text-xs text-muted">Solicite vínculo à turma</p>
      </div>
      <Button size="sm" disabled={busy} onClick={() => onRequest(c.id)}>
        {busy ? "…" : "Pedir acesso"}
      </Button>
    </div>
  );
});

export default function HomePage() {
  const router = useRouter();
  const { user, token, refreshUser } = useAuthStore();
  const [classes, setClasses] = useState<Classroom[]>([]);
  const [requests, setRequests] = useState<ClassAccessRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [requestingId, setRequestingId] = useState<string | null>(null);
  const [dash, setDash] = useState<{
    className: string;
    topThree: AttendanceComboLeaderboardRow[];
    summary: MyAttendanceSummary | null;
  } | null>(null);

  const needsMyRequests =
    (user?.role === "student" && !user.classId) ||
    (user?.role === "teacher" && (user.teacherClassIds?.length ?? 0) === 0);
  const hasStudentHome =
    user?.role === "student" && !!user.classId && !!token;
  const teacherOneClassId =
    user?.role === "teacher" && user.teacherClassIds.length === 1
      ? user.teacherClassIds[0]
      : null;

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setLoading(true);
      setError(null);
      const [cls, req] = await Promise.all([
        classesApi.list(token),
        needsMyRequests
          ? classesApi.listMyRequests(token)
          : Promise.resolve([] as ClassAccessRequest[]),
      ]);
      setClasses(cls);
      setRequests(req);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao carregar");
    } finally {
      setLoading(false);
    }
  }, [token, needsMyRequests]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!teacherOneClassId || !token) return;
    router.replace(`/class/${teacherOneClassId}`);
  }, [teacherOneClassId, token, router]);

  useEffect(() => {
    const classId = user?.classId ?? null;
    if (!token || !hasStudentHome || !classId) {
      setDash(null);
      return;
    }
    void (async () => {
      try {
        const classList = await classesApi.list(token);
        const myClass = classList.find((c) => c.id === classId);
        const [comboBoard, summary] = await Promise.all([
          attendanceApi
            .classComboLeaderboard(token, classId)
            .catch(() => [] as AttendanceComboLeaderboardRow[]),
          attendanceApi.mySummary(token).catch(() => null),
        ]);
        setDash({
          className: myClass?.name ?? "Minha turma",
          topThree: comboBoard.slice(0, 3),
          summary,
        });
      } catch {
        setDash({ className: "Minha turma", topThree: [], summary: null });
      }
    })();
  }, [token, hasStudentHome, user?.classId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return classes;
    return classes.filter((c) => c.name.toLowerCase().includes(q));
  }, [classes, query]);

  const onRequestAccess = async (classId: string) => {
    if (!token || !user) return;
    setRequestingId(classId);
    setError(null);
    try {
      const requestKind: "student" | "teacher" =
        user.role === "teacher" ? "teacher" : "student";
      await classesApi.requestAccess(
        token,
        classId,
        "Solicitação via web",
        requestKind,
      );
      await load();
      await refreshUser();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao solicitar");
    } finally {
      setRequestingId(null);
    }
  };

  if (!user || !token) return null;

  if (user.role === "admin" || (user.role === "teacher" && !teacherOneClassId)) {
    return (
      <div className="px-4 pb-8 pt-6">
        <div className="mx-auto max-w-lg">
          <h1 className="text-2xl font-black text-text">Salas</h1>
          <p className="mt-2 text-sm text-muted">
            {user.role === "admin"
              ? "Todas as turmas da igreja."
              : "Suas turmas e pedidos de acesso."}
          </p>
          <Link
            href="/competition"
            className="mt-4 flex items-center gap-3 rounded-2xl border border-accent-border bg-accent-muted/25 px-4 py-3 transition-colors hover:bg-accent-muted/40"
          >
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent ring-1 ring-accent-border">
              <Trophy className="size-5" strokeWidth={2.2} />
            </span>
            <div className="min-w-0 flex-1 text-left">
              <p className="text-sm font-extrabold text-text">Quiz e competições</p>
              <p className="text-xs text-muted">
                Criar perguntas, gerar PIN e conduzir o jogo ao vivo
              </p>
            </div>
            <span className="text-accent">›</span>
          </Link>
          <div className="mt-4">
            <Input
              placeholder="Buscar turma…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          {error ? (
            <p className="mt-3 text-sm text-danger-text-bright">{error}</p>
          ) : null}
          {loading ? (
            <p className="mt-8 text-center text-muted">Carregando…</p>
          ) : (
            <div className="mt-6 flex flex-col gap-3">
              {filtered.map((c) => (
                <div key={c.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                  <Link
                    href={`/class/${c.id}`}
                    className="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-opacity hover:opacity-95"
                  >
                    <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted font-black text-accent">
                      {c.name.slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-extrabold text-text">{c.name}</p>
                      <p className="text-xs text-muted">Gerenciar turma</p>
                    </div>
                    <span className="text-muted">›</span>
                  </Link>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (hasStudentHome && !dash) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-muted">
        Carregando…
      </div>
    );
  }

  if (hasStudentHome && dash) {
    return (
      <div className="px-4 pb-8 pt-6">
        <div className="mx-auto max-w-lg space-y-4">
          <div>
            <h1 className="text-2xl font-black text-text">{dash.className}</h1>
            <p className="text-sm text-muted">Resumo e ranking combo</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Top 3 combo</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-2">
              {dash.topThree.length === 0 ? (
                <p className="text-sm text-muted">Sem dados ainda.</p>
              ) : (
                dash.topThree.map((row, i) => (
                  <Podium key={row.userId} row={row} rank={i + 1} />
                ))
              )}
            </CardContent>
          </Card>
          {dash.summary ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Suas presenças</CardTitle>
              </CardHeader>
              <CardContent className="text-sm text-muted">
                <p>
                  Presente: {dash.summary.presentCount} /{" "}
                  {dash.summary.totalRecorded} · Pontual:{" "}
                  {dash.summary.punctualCount}
                </p>
              </CardContent>
            </Card>
          ) : null}
          <Button variant="secondary" className="w-full" asChild>
            <Link href={`/class/${user.classId}`}>Abrir turma</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pb-8 pt-6">
      <div className="mx-auto max-w-lg">
        <h1 className="text-2xl font-black text-text">Salas</h1>
        <p className="mt-2 text-sm text-muted">
          Peça acesso a uma turma da sua igreja.
        </p>
        {requests.length > 0 ? (
          <p className="mt-2 text-xs text-accent">
            Você tem {requests.length} pedido(s) em análise.
          </p>
        ) : null}
        <div className="mt-4">
          <Input
            placeholder="Buscar…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {error ? (
          <p className="mt-3 text-sm text-danger-text-bright">{error}</p>
        ) : null}
        {loading ? (
          <p className="mt-8 text-center text-muted">Carregando…</p>
        ) : (
          <div className="mt-6 flex flex-col gap-3">
            {filtered.map((c) => (
              <ClassRow
                key={c.id}
                c={c}
                busy={requestingId === c.id}
                onRequest={onRequestAccess}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
