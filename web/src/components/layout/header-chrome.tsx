import Link from "next/link";
import { BookOpen } from "lucide-react";
import { cn } from "@/lib/utils";

/** Barra superior compartilhada (cores / blur / borda iguais em todo o app logado + auth). */
export const headerChromeClass =
  "border-b border-border bg-bg-elevated/95 shadow-[0_1px_0_0_rgba(89,244,168,0.06)] backdrop-blur-xl";

export function AppBrandLink({
  className,
  compact,
  href = "/",
}: {
  className?: string;
  compact?: boolean;
  /** Padrão `/` (app). Use `/quiz` em fluxos públicos só com PIN. */
  href?: string;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "flex shrink-0 items-center gap-2 rounded-xl py-1.5 pr-2 transition-opacity hover:opacity-90",
        className,
      )}
    >
      <span className="flex size-9 items-center justify-center rounded-xl bg-accent-muted text-accent ring-1 ring-accent-border">
        <BookOpen className="size-5" strokeWidth={2.25} />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-tight">
          <span className="text-sm font-black tracking-tight text-text lg:text-base">
            EBD
          </span>
          <span className="hidden text-[10px] font-semibold uppercase tracking-widest text-muted lg:block">
            Painel web
          </span>
        </span>
      ) : null}
    </Link>
  );
}
