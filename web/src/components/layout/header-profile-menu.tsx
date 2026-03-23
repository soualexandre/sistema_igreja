"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserRound } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import type { AppRole } from "@/config/navigation";

function roleLabel(role: AppRole | undefined) {
  if (role === "admin") return "Admin";
  if (role === "teacher") return "Professor";
  return "Aluno";
}

export function HeaderProfileMenu({
  variant = "desktop",
}: {
  /** desktop: texto + seta; compact: só avatar (ex.: header da turma no mobile) */
  variant?: "desktop" | "compact";
}) {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const signOut = useAuthStore((s) => s.signOut);
  const role = user?.role as AppRole | undefined;

  const initial = (user?.name?.trim()?.[0] ?? user?.email?.[0] ?? "?").toUpperCase();

  const onSignOut = () => {
    signOut();
    router.replace("/login");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex items-center gap-2 rounded-xl border border-border bg-card/80 outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-accent",
            variant === "desktop" && "px-3 py-2",
            variant === "compact" && "size-10 justify-center p-0",
          )}
          aria-label="Menu da conta"
        >
          <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-accent-muted text-sm font-black text-accent ring-1 ring-accent-border">
            {initial}
          </span>
          {variant === "desktop" ? (
            <span className="min-w-0 flex-1 text-left">
              <span className="block truncate text-xs font-bold text-text-secondary">
                {user?.name ?? "Conta"}
              </span>
              <span className="block truncate text-[10px] font-semibold uppercase tracking-wide text-muted">
                {roleLabel(role)}
              </span>
            </span>
          ) : null}
          {variant === "desktop" ? (
            <span className="text-muted" aria-hidden>
              ▾
            </span>
          ) : null}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem asChild>
          <Link href="/profile" className="flex cursor-pointer items-center gap-2">
            <UserRound className="size-4 text-accent" />
            Ver e editar perfil
          </Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          className="gap-2 text-danger-text-bright focus:bg-danger-muted focus:text-danger-text-bright"
          onSelect={(e) => {
            e.preventDefault();
            onSignOut();
          }}
        >
          <LogOut className="size-4" />
          Sair da conta
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
