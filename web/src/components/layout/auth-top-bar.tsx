import Link from "next/link";
import { cn } from "@/lib/utils";
import { AppBrandLink, headerChromeClass } from "./header-chrome";

export function AuthTopBar({
  alternateHref,
  alternateLabel,
}: {
  alternateHref: string;
  alternateLabel: string;
}) {
  return (
    <header className={cn("sticky top-0 z-50", headerChromeClass)}>
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-5 lg:h-16 lg:px-8">
        <AppBrandLink />
        <div className="flex-1" />
        <Link
          href={alternateHref}
          className="text-sm font-extrabold text-muted transition-colors hover:text-accent"
        >
          {alternateLabel}
        </Link>
      </div>
    </header>
  );
}
