"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { listChurchUsers, type ChurchUserListItem } from "@/lib/users-api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const rolePt: Record<string, string> = {
  admin: "Admin",
  teacher: "Professor",
  student: "Aluno",
};

export default function ChurchUsersPage() {
  const router = useRouter();
  const { token, user } = useAuthStore();
  const [items, setItems] = useState<ChurchUserListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!token || user?.role !== "admin") return;
    setLoading(true);
    setError(null);
    try {
      const rows = await listChurchUsers(token);
      setItems(rows);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [token, user?.role]);

  useEffect(() => {
    if (!user) return;
    if (user.role !== "admin") {
      setLoading(false);
      return;
    }
    void load();
  }, [user, load]);

  useEffect(() => {
    if (user && user.role !== "admin") router.replace("/");
  }, [user, router]);

  if (!user || !token) return null;

  if (user.role !== "admin") {
    return (
      <div className="flex min-h-[30vh] items-center justify-center text-muted">
        Redirecionando…
      </div>
    );
  }

  return (
    <div className="px-4 py-6 md:px-0">
      <PageHeading
        title="Usuários da igreja"
        description="Lista de contas ativas. Alteração de papéis pode ser feita pela API ou futura tela de edição."
      />
      {error ? (
        <p className="text-sm text-danger-text-bright">{error}</p>
      ) : null}
      {loading ? (
        <p className="mt-6 text-muted">Carregando…</p>
      ) : (
        <div className="mt-4 overflow-hidden rounded-2xl border border-border">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-border bg-bg-elevated text-xs font-extrabold uppercase tracking-wide text-muted">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="hidden px-4 py-3 sm:table-cell">E-mail</th>
                <th className="px-4 py-3">Papel</th>
              </tr>
            </thead>
            <tbody>
              {items.map((u) => (
                <tr
                  key={u.id}
                  className="border-b border-border/80 bg-card/50 last:border-0"
                >
                  <td className="px-4 py-3 font-bold text-text-secondary">
                    {u.name}
                  </td>
                  <td className="hidden px-4 py-3 text-muted sm:table-cell">
                    {u.email}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "rounded-full px-2 py-0.5 text-xs font-extrabold",
                        u.role === "admin" && "bg-accent-muted text-accent",
                        u.role === "teacher" && "bg-surface-muted text-text-secondary",
                        u.role === "student" && "text-muted",
                      )}
                    >
                      {rolePt[u.role] ?? u.role}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <Button variant="ghost" className="mt-6" asChild>
        <Link href="/">Voltar às salas</Link>
      </Button>
    </div>
  );
}
