"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import {
  classesApi,
  type ClassAccessRequestDetailed,
} from "@/lib/classes-api";
import { useAuthStore } from "@/stores/auth-store";

function isPending(r: ClassAccessRequestDetailed) {
  return r.status === "PENDING_ADMIN" || r.status === "PENDING_TEACHER";
}

export default function PedidosPage() {
  const { token, user } = useAuthStore();
  const [list, setList] = useState<ClassAccessRequestDetailed[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || !user) return;
    if (user.role !== "admin" && user.role !== "teacher") return;
    setLoading(true);
    setError(null);
    try {
      const all = await classesApi.listStaffAccessRequests(token);
      setList(all.filter(isPending));
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [token, user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !token) return null;

  if (user.role !== "admin" && user.role !== "teacher") {
    return (
      <div className="px-4 py-8">
        <PageHeading title="Pedidos de acesso" />
        <p className="text-sm text-muted">
          Esta área é para professores e administradores.
        </p>
        <Button variant="secondary" className="mt-4" asChild>
          <Link href="/">Voltar às salas</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-0">
      <PageHeading
        title="Pedidos de acesso"
        description="Solicitações pendentes de alunos ou professores para entrar numa turma. Abra a turma para aprovar ou recusar."
      />
      {error ? (
        <p className="text-sm text-danger-text-bright">{error}</p>
      ) : null}
      {loading ? (
        <p className="mt-6 text-muted">Carregando…</p>
      ) : list.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-border bg-card px-4 py-6 text-center text-sm text-muted">
          Nenhum pedido pendente no momento.
        </p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl border border-border bg-card p-4"
            >
              <p className="font-extrabold text-text">
                {r.user?.name ?? "Usuário"}{" "}
                <span className="text-xs font-semibold text-muted">
                  ({r.requestKind === "teacher" ? "Professor" : "Aluno"})
                </span>
              </p>
              <p className="text-xs text-muted">{r.user?.email}</p>
              <p className="mt-2 text-sm text-text-secondary">
                Turma:{" "}
                <span className="font-bold text-accent">
                  {r.classroom?.name ?? r.classId}
                </span>
              </p>
              <p className="text-xs text-muted">
                Status: {r.status.replace(/_/g, " ")}
              </p>
              <Button variant="secondary" size="sm" className="mt-3" asChild>
                <Link href={`/class/${r.classId}/students`}>
                  Abrir turma · alunos
                </Link>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
