"use client";

import { useCallback, useMemo, useState } from "react";
import { getQuizPublicUrl } from "@/lib/public-app-url";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = {
  className?: string;
  /** Menos texto e padding (ex.: lista de competições) */
  compact?: boolean;
};

export function QuizShareLinkPanel({ className, compact }: Props) {
  const url = useMemo(() => getQuizPublicUrl(), []);
  const [copied, setCopied] = useState(false);
  const [shareErr, setShareErr] = useState<string | null>(null);

  const copy = useCallback(async () => {
    setShareErr(null);
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setShareErr("Não foi possível copiar. Selecione o link e copie manualmente.");
    }
  }, [url]);

  const share = useCallback(async () => {
    setShareErr(null);
    if (!navigator.share) {
      void copy();
      return;
    }
    try {
      await navigator.share({
        title: "Quiz ao vivo",
        text: "Entre com o PIN que o professor passar e seu nome.",
        url,
      });
    } catch (e) {
      if ((e as Error).name === "AbortError") return;
      void copy();
    }
  }, [url, copy]);

  const usesEnv = Boolean(process.env.NEXT_PUBLIC_WEB_URL?.trim());

  return (
    <div
      className={cn(
        "rounded-2xl border border-accent-border/40 bg-chip-on-bg/80 p-4 ring-1 ring-accent-border/20",
        compact && "p-3",
        className,
      )}
    >
      <p className="text-xs font-black uppercase tracking-widest text-accent">
        Link do quiz (convidado)
      </p>
    
      <div className={cn("mt-3 flex flex-col gap-2 sm:flex-row sm:items-center")}>
        <Input
          readOnly
          value={url}
          className="font-mono text-xs sm:flex-1"
          onFocus={(e) => e.target.select()}
        />
        <div className="flex shrink-0 gap-2">
          <Button
            type="button"
            size="sm"
            variant="secondary"
            className="flex-1 sm:flex-none"
            onClick={() => void copy()}
          >
            {copied ? "Copiado!" : "Copiar"}
          </Button>
          <Button
            type="button"
            size="sm"
            className="flex-1 sm:flex-none"
            onClick={() => void share()}
          >
            Compartilhar
          </Button>
        </div>
      </div>
      {shareErr ? (
        <p className="mt-2 text-xs text-danger-text-bright">{shareErr}</p>
      ) : null}
    </div>
  );
}
