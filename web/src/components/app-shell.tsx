"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { MainHeader } from "@/components/layout/main-header";
import { MobileBottomNav } from "@/components/layout/mobile-bottom-nav";
import { useAuthHydrated, useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const hydrated = useAuthHydrated();
  const token = useAuthStore((s) => s.token);

  useEffect(() => {
    if (hydrated && !token) {
      router.replace("/login");
    }
  }, [hydrated, token, router]);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!token) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-bg">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  const hideNav = pathname.startsWith("/class/");

  return (
    <div
      className={cn(
        "flex min-h-screen flex-col bg-bg",
        /* Mobile: espaço para bottom bar — desktop não precisa */
        /* Altura próxima ao tab bar Expo (64–88pt) + safe area */
        !hideNav &&
          "pb-[calc(5.75rem+env(safe-area-inset-bottom,0px))] md:pb-0",
      )}
    >
      {!hideNav ? <MainHeader /> : null}

      <main
        className={cn(
          "flex-1",
          /* Área de conteúdo “desktop”: largura e respiro; mobile inalterado nas páginas */
          !hideNav &&
            "md:mx-auto md:w-full md:max-w-6xl md:px-5 md:py-6 lg:px-8 lg:py-8",
          hideNav && "md:min-h-0",
        )}
      >
        {children}
      </main>

      {!hideNav ? <MobileBottomNav /> : null}
    </div>
  );
}
