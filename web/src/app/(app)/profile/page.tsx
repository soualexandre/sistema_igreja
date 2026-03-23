"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { ChevronRight, Home, Inbox, Trophy, User, UsersRound } from "lucide-react";
import { PageHeading } from "@/components/layout/page-heading";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAuthHydrated, useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export default function ProfilePage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const refreshUser = useAuthStore((s) => s.refreshUser);
  const [busy, setBusy] = useState(false);

  if (!hydrated) return null;

  const onRefresh = async () => {
    setBusy(true);
    try {
      await refreshUser();
    } finally {
      setBusy(false);
    }
  };

  const onSignOut = () => {
    signOut();
    router.replace("/login");
  };

  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const isAdmin = user?.role === "admin";

  const navRows = [
    {
      href: "/",
      label: "Salas",
      sub: "Início — turmas e pedidos de acesso",
      Icon: Home,
    },
    {
      href: "/competition",
      label: "Competição",
      sub: "Conquistas ao vivo — mesmo fluxo do app",
      Icon: Trophy,
    },
    {
      href: "/profile",
      label: "Perfil",
      sub: "Esta tela — dados da conta",
      Icon: User,
    },
  ];

  return (
    <div className="px-4 py-6 md:px-0 md:py-0">
      <PageHeading
        title="Perfil"
        description="Mesmas áreas do app mobile: abas Salas, Competição e Perfil na barra inferior; aqui você atualiza dados e encerra a sessão."
      />

      <Card className="mt-4 border-border">
        <CardHeader className="pb-2">
          <CardTitle className="text-lg">{user?.name ?? "—"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted">
          <p>{user?.email}</p>
          <p>
            Papel: <span className="font-bold text-accent">{user?.role}</span>
          </p>
          {user?.classId ? (
            <p className="text-xs">Turma vinculada (aluno)</p>
          ) : null}
          {user?.teacherClassIds?.length ? (
            <p className="text-xs">
              Turmas como professor: {user.teacherClassIds.length}
            </p>
          ) : null}
          <div className="flex flex-col gap-2 pt-4">
            <Button variant="secondary" disabled={busy} onClick={() => void onRefresh()}>
              Atualizar dados
            </Button>
            <Button variant="danger" onClick={onSignOut}>
              Sair da conta
            </Button>
          </div>
        </CardContent>
      </Card>

      <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-wide text-muted">
        Menu do app (atalhos)
      </h2>
      <ul className="space-y-2">
        {navRows.map(({ href, label, sub, Icon }) => (
          <li key={href}>
            <Link
              href={href}
              className={cn(
                "flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-card-hover",
                href === "/profile" && "ring-1 ring-accent-border bg-accent-muted/20",
              )}
            >
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent ring-1 ring-accent-border">
                <Icon className="size-5" strokeWidth={2.2} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="font-extrabold text-text">{label}</p>
                <p className="text-xs text-muted">{sub}</p>
              </div>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </Link>
          </li>
        ))}
      </ul>

      {isStaff ? (
        <>
          <h2 className="mb-3 mt-8 text-[11px] font-extrabold uppercase tracking-wide text-muted">
            Professor / admin
          </h2>
          <ul className="space-y-2">
            <li>
              <Link
                href="/pedidos"
                className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-card-hover"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-text-secondary">
                  <Inbox className="size-5" strokeWidth={2.2} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-extrabold text-text">Pedidos de acesso</p>
                  <p className="text-xs text-muted">Na web também no menu superior (desktop)</p>
                </div>
                <ChevronRight className="size-5 shrink-0 text-muted" />
              </Link>
            </li>
            {isAdmin ? (
              <li>
                <Link
                  href="/users"
                  className="flex items-center gap-3 rounded-2xl border border-border bg-card p-3 transition-colors hover:bg-card-hover"
                >
                  <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-muted text-text-secondary">
                    <UsersRound className="size-5" strokeWidth={2.2} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="font-extrabold text-text">Usuários da igreja</p>
                    <p className="text-xs text-muted">Somente administrador</p>
                  </div>
                  <ChevronRight className="size-5 shrink-0 text-muted" />
                </Link>
              </li>
            ) : null}
          </ul>
        </>
      ) : null}
    </div>
  );
}
