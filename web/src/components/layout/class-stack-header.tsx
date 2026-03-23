"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo } from "react";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { AppBrandLink, headerChromeClass } from "./header-chrome";
import { HeaderProfileMenu } from "./header-profile-menu";

export function ClassStackHeader({ classId }: { classId: string }) {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const base = `/class/${classId}`;

  const tabs = useMemo(() => {
    const core = [
      { href: base, label: "Início" },
      { href: `${base}/attendance`, label: "Presença" },
      { href: `${base}/students`, label: "Alunos" },
    ] as const;
    const staff =
      user?.role === "teacher" || user?.role === "admin"
        ? ([{ href: "/competition", label: "Quiz" }] as const)
        : [];
    return [...core, ...staff];
  }, [base, user?.role]);

  return (
    <header
      className={cn(
        "sticky top-0 z-40",
        headerChromeClass,
        "md:mx-auto md:max-w-6xl md:rounded-b-2xl md:border-x md:border-t-0 md:shadow-[0_8px_32px_rgba(0,0,0,0.25)]",
      )}
    >
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-3 px-4 py-3 md:flex-row md:items-center md:gap-4 md:px-6 lg:px-8">
        <div className="flex items-center justify-between gap-2 md:min-w-0 md:justify-start md:gap-4">
          <div className="flex flex-wrap items-center gap-2 md:gap-4">
            <AppBrandLink className="hidden md:flex" />
            <AppBrandLink compact className="md:hidden" />
            <Link
              href="/"
              className="text-sm font-extrabold text-accent transition-opacity hover:opacity-90"
            >
              ← Salas
            </Link>
          </div>
          <div className="shrink-0 md:hidden">
            <HeaderProfileMenu variant="compact" />
          </div>
        </div>
        <nav
          className="flex flex-wrap gap-1 text-xs font-bold sm:gap-2 sm:text-sm md:flex-1 md:justify-center"
          aria-label="Turma"
        >
          {tabs.map(({ href, label }) => {
            const active =
              href === "/competition"
                ? pathname === "/competition" ||
                  pathname.startsWith("/competition/")
                : href === base
                  ? pathname === base
                  : pathname === href || pathname.startsWith(`${href}/`);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "rounded-xl px-3 py-1.5 transition-colors",
                  active
                    ? "bg-accent-muted text-accent ring-1 ring-accent-border"
                    : "text-muted hover:bg-card hover:text-text",
                )}
              >
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="hidden shrink-0 md:block">
          <HeaderProfileMenu variant="compact" />
        </div>
      </div>
    </header>
  );
}
