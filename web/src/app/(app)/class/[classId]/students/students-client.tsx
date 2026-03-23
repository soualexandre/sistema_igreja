"use client";

import { memo, useCallback, useEffect, useState } from "react";
import {
  classesApi,
  type ClassAccessRequestDetailed,
  type ClassStudent,
} from "@/lib/classes-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthStore } from "@/stores/auth-store";

const StudentLine = memo(function StudentLine({ s }: { s: ClassStudent }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-border bg-card px-3 py-2">
      <div>
        <p className="font-bold text-text-secondary">{s.name}</p>
        <p className="text-xs text-muted">{s.email}</p>
      </div>
    </div>
  );
});

const PendingRow = memo(function PendingRow({
  row,
  busy,
  onModerate,
}: {
  row: ClassAccessRequestDetailed;
  busy: boolean;
  onModerate: (id: string, approve: boolean) => void;
}) {
  const kind = row.requestKind === "teacher" ? "Professor" : "Aluno";
  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <p className="font-bold text-text-secondary">
        {row.user?.name ?? "Usuário"} · {kind}
      </p>
      <p className="text-xs text-muted">{row.user?.email}</p>
      <p className="mt-1 text-xs text-muted">Status: {row.status}</p>
      <div className="mt-2 flex gap-2">
        <Button
          size="sm"
          disabled={busy}
          onClick={() => onModerate(row.id, true)}
        >
          Aprovar
        </Button>
        <Button
          size="sm"
          variant="danger"
          disabled={busy}
          onClick={() => onModerate(row.id, false)}
        >
          Recusar
        </Button>
      </div>
    </div>
  );
});

export function StudentsPageClient({ classId }: { classId: string }) {
  const { token, user } = useAuthStore();
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [pending, setPending] = useState<ClassAccessRequestDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const load = useCallback(async () => {
    if (!token || !classId || !isStaff) return;
    try {
      setLoading(true);
      setError(null);
      const roster = await classesApi.listStudents(token, classId);
      setStudents(roster);
      if (isAdmin) {
        const all = await classesApi.listStaffAccessRequests(token);
        const forClass = all.filter(
          (r) =>
            r.classId === classId &&
            (r.status === "PENDING_ADMIN" || r.status === "PENDING_TEACHER"),
        );
        setPending(forClass);
      } else {
        setPending([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [token, classId, isStaff, isAdmin]);

  useEffect(() => {
    void load();
  }, [load]);

  const moderate = async (requestId: string, approve: boolean) => {
    if (!token) return;
    setBusyId(requestId);
    try {
      await classesApi.moderateByAdmin(token, { requestId, approve });
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusyId(null);
    }
  };

  if (!token) return null;

  if (!isStaff) {
    return (
      <div className="px-4 py-8 text-center text-muted">
        Esta área é para professores e administradores.
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-black text-text">Alunos e pedidos</h1>
      {error ? (
        <p className="mt-2 text-sm text-danger-text-bright">{error}</p>
      ) : null}
      {loading ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : (
        <div className="mt-6 space-y-6">
          {isAdmin && pending.length > 0 ? (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Pedidos pendentes</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {pending.map((row) => (
                  <PendingRow
                    key={row.id}
                    row={row}
                    busy={busyId === row.id}
                    onModerate={moderate}
                  />
                ))}
              </CardContent>
            </Card>
          ) : null}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">
                Matriculados ({students.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {students.length === 0 ? (
                <p className="text-sm text-muted">Nenhum aluno.</p>
              ) : (
                students.map((s) => <StudentLine key={s.id} s={s} />)
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
