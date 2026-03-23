import type { LucideIcon } from "lucide-react";
import { Home, Inbox, Trophy, User, UsersRound } from "lucide-react";

export type AppRole = "admin" | "teacher" | "student";

export type MainNavItem = {
  href: string;
  label: string;
  Icon: LucideIcon;
  roles?: AppRole[];
};

const everyone: AppRole[] = ["admin", "teacher", "student"];

/**
 * Barra inferior (mobile) — espelha `app-ad/app/(tabs)/_layout.tsx`:
 * Salas · Competição · Perfil (3 abas, SF Symbols → Lucide: house, trophy, person).
 */
export const MOBILE_TAB_BAR: MainNavItem[] = [
  { href: "/", label: "Salas", Icon: Home, roles: everyone },
  { href: "/competition", label: "Competição", Icon: Trophy, roles: everyone },
  { href: "/profile", label: "Perfil", Icon: User, roles: everyone },
];

/** Itens extras só no header desktop (não aparecem na tab bar do app). */
const STAFF_HEADER: MainNavItem[] = [
  { href: "/pedidos", label: "Pedidos", Icon: Inbox, roles: ["admin", "teacher"] },
  { href: "/users", label: "Usuários", Icon: UsersRound, roles: ["admin"] },
];

/** Header desktop: mesmas 3 áreas do app + atalhos staff/admin (Perfil fica no menu da conta). */
export function desktopHeaderNav(role: AppRole | undefined): MainNavItem[] {
  const r = role ?? "student";
  const core = MOBILE_TAB_BAR.filter(
    (i) => i.href !== "/profile",
  ) as MainNavItem[];
  const extras = STAFF_HEADER.filter((i) => !i.roles || i.roles.includes(r));
  return [...core, ...extras];
}

export function navItemActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}
