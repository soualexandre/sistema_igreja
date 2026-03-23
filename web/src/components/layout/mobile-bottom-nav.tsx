"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MOBILE_TAB_BAR, navItemActive } from "@/config/navigation";
import { cn } from "@/lib/utils";

/**
 * Tab bar igual ao Expo: `app-ad/app/(tabs)/_layout.tsx`
 * — 3 abas (Salas, Competição, Perfil), ícone 26pt, label 11px / font-weight 700,
 * cores ativo accent / inativo mutedDark, fundo bgElevated, borda superior.
 */
export function MobileBottomNav() {
  const pathname = usePathname();

  return (
    <nav
      className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-bg-elevated md:hidden"
      style={{
        paddingTop: 8,
        paddingBottom: "max(10px, env(safe-area-inset-bottom, 0px))",
      }}
      aria-label="Principal"
    >
      <div className="mx-auto flex min-h-[48px] max-w-lg items-center justify-around px-1">
        {MOBILE_TAB_BAR.map(({ href, label, Icon }) => {
          const active = navItemActive(pathname, href);
          return (
            <Link
              key={href}
              href={href}
              className={cn(
                "flex min-h-[48px] min-w-0 flex-1 flex-col items-center justify-center gap-1 px-1",
                active ? "text-accent" : "text-muted-dark",
              )}
            >
              <Icon
                className="size-[26px] shrink-0"
                strokeWidth={active ? 2.25 : 2}
                aria-hidden
              />
              <span className="text-center text-[11px] font-bold leading-none">
                {label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
