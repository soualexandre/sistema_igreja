"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { competitionsApi, type CompetitionListItem } from "@/lib/competitions-api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { QuizShareLinkPanel } from "@/components/competition/quiz-share-link-panel";
import { Input } from "@/components/ui/input";

export function TeacherCompetitionsWeb({ token }: { token: string }) {
  const router = useRouter();
  const [items, setItems] = useState<CompetitionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!token) return;
    try {
      setError(null);
      const list = await competitionsApi.list(token);
      setItems(list);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    void load();
  }, [load]);

  const create = async () => {
    const n = name.trim();
    if (n.length < 2) return;
    setBusy(true);
    try {
      const c = await competitionsApi.create(token, n);
      setCreateOpen(false);
      setName("");
      await load();
      router.push(`/competition/${c.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="px-4 py-6">
      <div className="rounded-2xl border border-border bg-card p-4">
        <p className="text-xs font-extrabold uppercase tracking-widest text-accent">
          Professor / admin
        </p>
        <h1 className="mt-2 text-2xl font-black text-text">
          Quiz — gerenciamento
        </h1>
        <p className="mt-2 text-sm text-muted">
          Crie competições (modelos), edite perguntas e abra uma competição para a
          aba <span className="font-bold text-text-secondary">Ao vivo</span>: escolha
          a turma, gere o PIN e conduza as rodadas. Participantes podem entrar em{" "}
          <span className="font-semibold text-accent">/quiz</span> só com nome e
          código.
        </p>
        <QuizShareLinkPanel compact className="mt-4" />
      </div>
      <Button className="mt-4 w-full" onClick={() => setCreateOpen(true)}>
        + Nova competição
      </Button>
      {error ? <p className="mt-2 text-sm text-danger-text-bright">{error}</p> : null}
      {loading ? (
        <p className="mt-8 text-center text-muted">Carregando…</p>
      ) : (
        <div className="mt-6 space-y-3">
          {items.length === 0 ? (
            <p className="text-center text-muted">Nenhuma competição ainda.</p>
          ) : (
            items.map((c) => (
              <Link
                key={c.id}
                href={`/competition/${c.id}`}
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-opacity hover:opacity-95"
              >
                <div className="flex size-12 items-center justify-center rounded-2xl bg-surface-muted font-black text-accent">
                  {c.name.slice(0, 2).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-text">{c.name}</p>
                  <p className="text-xs text-muted">
                    {c._count.questions} pergunta(s) · {c._count.quizSessions}{" "}
                    rodada(s)
                  </p>
                </div>
                <span className="text-muted">›</span>
              </Link>
            ))
          )}
        </div>
      )}

      {createOpen ? (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
          <Card className="w-full max-w-md border-border">
            <CardHeader>
              <CardTitle>Nova competição</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Nome"
              />
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={() => setCreateOpen(false)}>
                  Cancelar
                </Button>
                <Button disabled={busy} onClick={() => void create()}>
                  Criar
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      ) : null}
    </div>
  );
}
