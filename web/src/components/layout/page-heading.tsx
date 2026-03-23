import { cn } from "@/lib/utils";

/** Título de página alinhado ao conteúdo principal (abaixo do header global). */
export function PageHeading({
  title,
  description,
  className,
}: {
  title: string;
  description?: string;
  className?: string;
}) {
  return (
    <div className={cn("mb-6 md:mb-8", className)}>
      <h1 className="text-2xl font-black tracking-tight text-text md:text-3xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted">
          {description}
        </p>
      ) : null}
    </div>
  );
}
