"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  desktopHeaderNav,
  navItemActive,
  type AppRole,
} from "@/config/navigation";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";
import { AppBrandLink, headerChromeClass } from "./header-chrome";
import { HeaderProfileMenu } from "./header-profile-menu";

export function MainHeader() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const role = user?.role as AppRole | undefined;
  const items = desktopHeaderNav(role);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 hidden md:block",
        headerChromeClass,
      )}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-5 lg:h-16 lg:gap-4 lg:px-8">
        <AppBrandLink />

        <nav
          className="flex min-w-0 flex-1 items-center justify-center gap-1 overflow-x-auto lg:gap-2"
          aria-label="Principal"
        >
          {items.map(({ href, label, Icon }) => {
            const active = navItemActive(pathname, href);
            return (
              <Link
                key={href}
                href={href}
                className={cn(
                  "flex shrink-0 items-center gap-2 rounded-xl px-2.5 py-2 text-sm font-extrabold transition-colors lg:px-3",
                  active
                    ? "bg-accent-muted text-accent ring-1 ring-accent-border"
                    : "text-muted hover:bg-card hover:text-text-secondary",
                )}
              >
                <Icon className="size-[18px] shrink-0" strokeWidth={2.2} />
                <span className="max-w-[7.5rem] truncate lg:max-w-none">
                  {label}
                </span>
              </Link>
            );
          })}
        </nav>

        <HeaderProfileMenu variant="desktop" />
      </div>
    </header>
  );
}
