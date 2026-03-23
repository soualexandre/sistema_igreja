"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthTopBar } from "@/components/layout/auth-top-bar";
import { useAuthHydrated, useAuthStore } from "@/stores/auth-store";

export default function RegisterPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const signUp = useAuthStore((s) => s.signUp);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (hydrated && token) {
    router.replace("/");
    return null;
  }

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await signUp({ name: name.trim(), email: email.trim(), password });
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao cadastrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AuthTopBar alternateHref="/login" alternateLabel="Entrar" />
      <div className="flex flex-1 flex-col justify-center px-4 py-10">
      <Card className="mx-auto w-full max-w-md border-border bg-card">
        <CardHeader>
          <CardTitle>Criar conta</CardTitle>
          <CardDescription>
            Cadastro padrão como aluno. Administradores podem ajustar papéis
            depois.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted">
                Nome
              </label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted">
                E-mail
              </label>
              <Input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted">
                Senha
              </label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={4}
              />
            </div>
            {error ? (
              <p className="text-sm text-danger-text-bright">{error}</p>
            ) : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Criando…" : "Cadastrar"}
            </Button>
            <p className="text-center text-sm text-muted">
              Só precisa do quiz com PIN?{" "}
              <Link href="/quiz" className="font-bold text-accent underline">
                Acessar sem cadastro
              </Link>
            </p>
            <p className="text-center text-sm text-muted">
              Já tem conta?{" "}
              <Link href="/login" className="font-bold text-accent underline">
                Entrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
