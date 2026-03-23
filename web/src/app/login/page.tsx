"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { AuthTopBar } from "@/components/layout/auth-top-bar";
import { useAuthHydrated, useAuthStore } from "@/stores/auth-store";

export default function LoginPage() {
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);
  const signIn = useAuthStore((s) => s.signIn);
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
      await signIn(email.trim(), password);
      router.replace("/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao entrar");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-bg">
      <AuthTopBar alternateHref="/register" alternateLabel="Cadastrar" />
      <div className="flex flex-1 flex-col justify-center px-4 py-10">
      <Card className="mx-auto w-full max-w-md border-border bg-card">
        <CardHeader>
          <p className="text-xs font-extrabold uppercase tracking-widest text-accent">
            EBD
          </p>
          <CardTitle>Entrar</CardTitle>
          <CardDescription>
            Use o mesmo e-mail e senha do app mobile.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={onSubmit} className="flex flex-col gap-4">
            <div>
              <label className="mb-1.5 block text-xs font-bold text-muted">
                E-mail
              </label>
              <Input
                type="email"
                autoComplete="email"
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
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
            {error ? (
              <p className="text-sm text-danger-text-bright">{error}</p>
            ) : null}
            <Button type="submit" disabled={busy} className="w-full">
              {busy ? "Entrando…" : "Entrar"}
            </Button>
            <p className="text-center text-sm text-muted">
              Só vai participar do quiz com PIN?{" "}
              <Link href="/quiz" className="font-bold text-accent underline">
                Entrar sem cadastro
              </Link>
            </p>
            <p className="text-center text-sm text-muted">
              Não tem conta?{" "}
              <Link href="/register" className="font-bold text-accent underline">
                Cadastrar
              </Link>
            </p>
          </form>
        </CardContent>
      </Card>
      </div>
    </div>
  );
}
