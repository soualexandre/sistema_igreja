"use client";

import Link from "next/link";
import { memo, useCallback, useEffect, useState } from "react";
import {
  CalendarX,
  CheckSquare,
  ChevronRight,
  Mail,
  School,
  Trophy,
  UserPlus,
} from "lucide-react";
import {
  attendanceApi,
  type AttendanceComboLeaderboardRow,
} from "@/lib/attendance-api";
import { classesApi, type Classroom } from "@/lib/classes-api";
import { lessonsApi, type LessonDto } from "@/lib/lessons-api";
import { useAuthStore } from "@/stores/auth-store";
import { cn } from "@/lib/utils";

const PODIUM_COLORS = ["#eab308", "#94a3b8", "#ea580c"] as const;

type DashboardSnapshot = {
  className: string;
  classroom: Classroom | null;
  enrolledCount: number;
  pendingCount: number;
  lessonsCount: number;
  focusLesson: LessonDto | null;
  cpadYear: number | null;
  topThree: AttendanceComboLeaderboardRow[];
};

const PodiumRow = memo(function PodiumRow({
  row,
  rank,
}: {
  row: AttendanceComboLeaderboardRow;
  rank: number;
}) {
  const medalColor = PODIUM_COLORS[rank - 1] ?? "#94a3b8";
  return (
    <div className="flex items-center gap-3 py-1.5">
      <div
        className="flex size-8 items-center justify-center rounded-[10px] border-2 bg-bg-elevated text-[15px] font-black"
        style={{ borderColor: medalColor, color: medalColor }}
      >
        {rank}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-bold text-text">{row.name}</p>
      </div>
      <span className="shrink-0 text-sm font-extrabold text-accent">
        {row.comboScore} combo
      </span>
    </div>
  );
});

function RankingBlock({
  topThree,
  variant = "inline",
}: {
  topThree: AttendanceComboLeaderboardRow[];
  /** aside: coluna direita no desktop (staff). inline: mesmo fluxo do app no mobile e aluno. */
  variant?: "inline" | "aside";
}) {
  return (
    <section
      className={cn(
        "mt-1 border-t border-border pt-1",
        variant === "aside" &&
          "md:mt-0 md:border-t-0 md:border-l md:border-border md:pt-0 md:pl-6 lg:pl-8",
      )}
    >
      <div
        className={cn(
          "mb-1.5 mt-3 flex items-center gap-2",
          variant === "aside" && "md:mt-0",
        )}
      >
        <Trophy className="size-5 shrink-0 text-accent" strokeWidth={2.2} />
        <h2 className="text-base font-extrabold text-text">Top 3 presença em aula</h2>
      </div>
      <p className="mb-3 text-[11px] leading-4 text-muted">
        Combo por aula: presença + pontualidade + itens de participação (revista,
        Bíblia, lição, oferta). Não inclui pontos de quiz ou competição.
      </p>
      {topThree.length === 0 ? (
        <div className="rounded-[14px] border border-border bg-input px-4 py-4">
          <p className="text-center text-[13px] text-muted">
            Ainda não há presenças registradas para montar o ranking.
          </p>
        </div>
      ) : (
        <div className="space-y-2 rounded-2xl border border-border bg-card p-3">
          {topThree.map((row, i) => (
            <PodiumRow key={row.userId} row={row} rank={i + 1} />
          ))}
        </div>
      )}
    </section>
  );
}

export function ClassDashboardClient({ classId }: { classId: string }) {
  const { token, user } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [snap, setSnap] = useState<DashboardSnapshot | null>(null);

  const isStaff = user?.role === "teacher" || user?.role === "admin";

  const load = useCallback(async () => {
    if (!token || !classId || !user) return;
    try {
      setLoading(true);
      setError(null);

      const [classList, comboBoard] = await Promise.all([
        classesApi.list(token),
        attendanceApi
          .classComboLeaderboard(token, classId)
          .catch(() => [] as AttendanceComboLeaderboardRow[]),
      ]);

      const c = classList.find((x) => x.id === classId) ?? null;
      const className = c?.name ?? "Turma";
      const topThree = comboBoard.slice(0, 3);

      let enrolledCount = 0;
      let pendingCount = 0;
      let lessonsCount = 0;
      let focusLesson: LessonDto | null = null;
      let cpadYear: number | null = null;

      if (isStaff) {
        const roster = await classesApi.listStudents(token, classId);
        enrolledCount = roster.length;
        if (user.role === "admin") {
          const reqs = await classesApi.listStaffAccessRequests(token);
          const forClass = reqs.filter((r) => r.classId === classId);
          pendingCount = forClass.filter(
            (r) =>
              r.status === "PENDING_ADMIN" || r.status === "PENDING_TEACHER",
          ).length;
        }
      }

      if (isStaff && c) {
        if (c.useCpadSchedule === true) {
          const state = await lessonsApi.cpadState(token, classId);
          lessonsCount = state.lessons.length;
          cpadYear = state.cpadYear;
          focusLesson =
            state.lessons.length > 0
              ? state.lessons[state.lessons.length - 1]!
              : null;
        } else {
          const ls = await lessonsApi.list(token, classId);
          lessonsCount = ls.length;
          focusLesson = ls.length > 0 ? ls[0]! : null;
        }
      }

      setSnap({
        className,
        classroom: c,
        enrolledCount,
        pendingCount,
        lessonsCount,
        focusLesson,
        cpadYear,
        topThree,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
      setSnap(null);
    } finally {
      setLoading(false);
    }
  }, [token, classId, user, isStaff]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!user || !token) return null;

  /* ——— Aluno: fiel ao app (pilula + texto + ranking) ——— */
  if (user.role === "student") {
    if (loading) {
      return (
        <div className="flex min-h-[40vh] items-center justify-center px-5">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
        </div>
      );
    }
    if (!snap) {
      return (
        <div className="px-5 pt-6">
          <p className="text-danger-text-bright">
            {error ?? "Turma não encontrada."}
          </p>
        </div>
      );
    }
    return (
      <div className="px-5 pb-10 pt-2 md:px-0 md:pb-12 md:pt-0">
        <div className="mb-3.5 md:max-w-2xl">
          <span className="inline-block rounded-full border border-accent-border bg-accent-muted px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-accent">
            Sua turma
          </span>
        </div>
        <p className="mb-5 text-[15px] leading-[22px] text-text-secondary md:max-w-2xl">
          Você está nesta sala. O professor registra presença e acompanha pedidos
          de acesso.
        </p>
        <div className="md:max-w-2xl">
          <RankingBlock variant="inline" topThree={snap.topThree} />
        </div>
      </div>
    );
  }

  /* ——— Staff ——— */
  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-5">
        <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
      </div>
    );
  }

  if (!snap) {
    return (
      <div className="px-5 py-4">
        <p className="text-danger-text-bright">
          {error ?? "Turma não encontrada."}
        </p>
      </div>
    );
  }

  const modeLabel =
    snap.classroom?.useCpadSchedule === true
      ? `CPAD${snap.cpadYear != null ? ` · ${snap.cpadYear}` : ""}`
      : "Modo livre";

  const primaryCta = (
    <Link
      href={`/class/${classId}/attendance`}
      className="mb-2.5 flex items-center gap-3 rounded-2xl bg-accent px-3.5 py-3.5 text-on-accent transition-opacity hover:opacity-[0.96] active:opacity-90"
    >
      <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-[rgba(10,11,18,0.12)]">
        <CheckSquare className="size-6 text-on-accent" strokeWidth={2.2} />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[17px] font-black">Registrar presença</p>
        <p className="mt-0.5 text-xs font-semibold text-on-accent/70">
          Lição e alunos · {snap.lessonsCount}{" "}
          {snap.lessonsCount === 1 ? "lição liberada" : "lições liberadas"}
        </p>
      </div>
      <ChevronRight className="size-[26px] shrink-0 opacity-90" strokeWidth={2} />
    </Link>
  );

  const secondaryCta = (
    <Link
      href={`/class/${classId}/students`}
      className={cn(
        "mb-5 flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-3.5 py-3.5 transition-colors",
        "hover:bg-card-hover active:bg-surface-muted md:mb-0",
      )}
    >
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <UserPlus className="size-[22px] shrink-0 text-accent" strokeWidth={2.2} />
        <div className="min-w-0">
          <p className="text-[15px] font-extrabold text-text">Gerenciar alunos</p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">
            Lista · aceitar ou recusar pedidos
          </p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        {snap.pendingCount > 0 ? (
          <span className="flex min-w-[22px] items-center justify-center rounded-full bg-accent px-1.5 py-0.5 text-[11px] font-black text-on-accent">
            {snap.pendingCount}
          </span>
        ) : null}
        <ChevronRight className="size-[22px] text-muted" strokeWidth={2} />
      </div>
    </Link>
  );

  const staffMainColumn = (
    <>
      {error ? (
        <p className="mb-2.5 rounded-xl bg-danger-muted px-3 py-3 text-sm text-danger-text">
          {error}
        </p>
      ) : null}

      <div className="mb-3.5">
        <span className="inline-block rounded-full border border-accent-border bg-accent-muted px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wide text-accent">
          {modeLabel}
        </span>
      </div>

      <div className="mb-3.5 flex gap-2.5">
        <div className="flex flex-1 flex-col gap-1 rounded-[14px] border border-border bg-card p-3">
          <School className="size-5 text-muted" strokeWidth={2} />
          <p className="text-2xl font-black text-text">{snap.enrolledCount}</p>
          <p className="text-xs font-semibold text-muted">Alunos</p>
        </div>
        <div
          className={cn(
            "flex flex-1 flex-col gap-1 rounded-[14px] border bg-card p-3",
            snap.pendingCount > 0
              ? "border-accent-border bg-chip-on-bg"
              : "border-border",
          )}
        >
          <Mail
            className={cn(
              "size-5",
              snap.pendingCount > 0 ? "text-accent" : "text-muted",
            )}
            strokeWidth={2}
          />
          <p
            className={cn(
              "text-2xl font-black",
              snap.pendingCount > 0 ? "text-accent" : "text-text",
            )}
          >
            {snap.pendingCount}
          </p>
          <p className="text-xs font-semibold text-muted">Pendentes</p>
        </div>
      </div>

      {snap.focusLesson ? (
        <div className="mb-[18px] rounded-[14px] border border-border bg-card p-3.5">
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-muted">
            Lição em foco
          </p>
          <p className="mb-1 text-base font-extrabold text-text line-clamp-3">
            {snap.focusLesson.title}
          </p>
          <p className="text-xs leading-4 text-muted line-clamp-2">
            {(snap.focusLesson.location
              ? `${snap.focusLesson.location} · `
              : "") + new Date(snap.focusLesson.startsAt).toLocaleString()}
          </p>
        </div>
      ) : (
        <div className="mb-[18px] flex items-center gap-2.5 rounded-[14px] border border-border bg-input p-3.5">
          <CalendarX className="size-5 shrink-0 text-muted" strokeWidth={2} />
          <p className="flex-1 text-[13px] leading-[18px] text-muted">
            Nenhuma aula disponível ainda. Abra Presença para criar ou liberar
            lições.
          </p>
        </div>
      )}

      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
        Quiz ao vivo
      </p>
      <Link
        href="/competition"
        className="mb-5 flex items-center gap-3 rounded-2xl border border-accent-border bg-accent-muted/30 px-3.5 py-3.5 transition-colors hover:bg-accent-muted/50"
      >
        <span className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-accent-muted text-accent ring-1 ring-accent-border">
          <Trophy className="size-6" strokeWidth={2.2} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-extrabold text-text">Gerenciar quiz</p>
          <p className="mt-0.5 text-[11px] font-medium leading-snug text-muted">
            Competições, perguntas, PIN da sala e histórico de rodadas
          </p>
        </div>
        <ChevronRight className="size-[22px] shrink-0 text-accent" strokeWidth={2} />
      </Link>

      <p className="mb-2 text-[11px] font-extrabold uppercase tracking-wide text-muted">
        Ações
      </p>

      {primaryCta}
      {secondaryCta}
    </>
  );

  return (
    <div className="px-5 pb-10 pt-2 md:grid md:grid-cols-12 md:gap-8 md:px-0 md:pb-12 md:pt-0">
      {/* Título da turma: no app vem do header nativo; na web mostramos aqui */}
      <div className="mb-4 md:col-span-12 md:mb-2">
        <h1 className="text-2xl font-black tracking-tight text-text md:text-3xl">
          {snap.className}
        </h1>
      </div>

      {/* Mobile: coluna única (ordem = app). Desktop: principal + ranking lateral */}
      <div className="md:col-span-7 lg:col-span-7">{staffMainColumn}</div>

      <div className="md:col-span-5 lg:col-span-5">
        <RankingBlock variant="aside" topThree={snap.topThree} />
      </div>
    </div>
  );
}
