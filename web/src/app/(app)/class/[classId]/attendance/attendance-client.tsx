"use client";

import { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  attendanceApi,
  type AttendanceRecordDto,
  type ParticipationPayload,
} from "@/lib/attendance-api";
import { classesApi, type ClassStudent } from "@/lib/classes-api";
import { lessonsApi, type LessonDto } from "@/lib/lessons-api";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

function parseParticipation(p: Record<string, unknown> | null | undefined) {
  if (!p || typeof p !== "object") {
    return {
      magazine: false,
      bible: false,
      lessonParticipation: false,
      offering: false,
    };
  }
  return {
    magazine: p.magazine === true,
    bible: p.bible === true,
    lessonParticipation: p.lessonParticipation === true,
    offering: p.offering === true,
  };
}

const StudentAttendanceRow = memo(function StudentAttendanceRow({
  s,
  record,
  busy,
  onTogglePresent,
  onSaveParticipation,
}: {
  s: ClassStudent;
  record: AttendanceRecordDto | undefined;
  busy: boolean;
  onTogglePresent: (studentId: string, next: boolean) => void;
  onSaveParticipation: (
    studentId: string,
    payload: ParticipationPayload,
  ) => void;
}) {
  const present = record?.present ?? false;
  const part = parseParticipation(record?.participation ?? null);
  const [local, setLocal] = useState(part);

  useEffect(() => {
    setLocal(parseParticipation(record?.participation ?? null));
  }, [record]);

  const chip = (
    key: keyof ParticipationPayload,
    label: string,
  ) => (
    <label className="flex cursor-pointer items-center gap-2 text-xs text-muted">
      <input
        type="checkbox"
        checked={local[key]}
        onChange={(e) => {
          const next = { ...local, [key]: e.target.checked };
          setLocal(next);
          void onSaveParticipation(s.id, next);
        }}
        className="accent-accent"
      />
      {label}
    </label>
  );

  return (
    <div className="rounded-xl border border-border bg-card p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-text-secondary">{s.name}</span>
        <label className="flex items-center gap-2 text-sm font-bold text-muted">
          <input
            type="checkbox"
            checked={present}
            disabled={busy}
            onChange={(e) => onTogglePresent(s.id, e.target.checked)}
            className="accent-accent"
          />
          Presente
        </label>
      </div>
      {present ? (
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2 border-t border-border pt-3">
          {chip("magazine", "Revista")}
          {chip("bible", "Bíblia")}
          {chip("lessonParticipation", "Lição")}
          {chip("offering", "Oferta")}
        </div>
      ) : null}
    </div>
  );
});

export function AttendancePageClient({ classId }: { classId: string }) {
  const { token, user } = useAuthStore();
  const [className, setClassName] = useState("");
  const [lessons, setLessons] = useState<LessonDto[]>([]);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [rows, setRows] = useState<AttendanceRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [cpadUnlocking, setCpadUnlocking] = useState(false);
  const [cpadMeta, setCpadMeta] = useState<{
    canUnlockNext: boolean;
    releasedThroughLessonIndex: number;
  } | null>(null);

  const isStaff = user?.role === "teacher" || user?.role === "admin";
  const map = useMemo(() => {
    const m = new Map<string, AttendanceRecordDto>();
    rows.forEach((r) => m.set(r.studentId, r));
    return m;
  }, [rows]);

  const loadAll = useCallback(async () => {
    if (!token || !classId) return;
    try {
      setLoading(true);
      setError(null);
      const classList = await classesApi.list(token);
      const c = classList.find((x) => x.id === classId);
      setClassName(c?.name ?? "Turma");

      if (!isStaff) {
        setStudents([]);
        setLessons([]);
        setLessonId(null);
        setCpadMeta(null);
        return;
      }

      const roster = await classesApi.listStudents(token, classId);
      setStudents(roster);

      let ls: LessonDto[] = [];
      if (c?.useCpadSchedule) {
        const state = await lessonsApi.cpadState(token, classId);
        ls = state.lessons;
        setCpadMeta({
          canUnlockNext: state.canUnlockNext,
          releasedThroughLessonIndex: state.releasedThroughLessonIndex,
        });
      } else {
        ls = await lessonsApi.list(token, classId);
        setCpadMeta(null);
      }
      setLessons(ls);
      setLessonId((prev) => {
        if (ls.length === 0) return null;
        if (prev && ls.some((x) => x.id === prev)) return prev;
        return ls[0]!.id;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar");
    } finally {
      setLoading(false);
    }
  }, [token, classId, isStaff]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadRows = useCallback(async () => {
    if (!token || !lessonId) return;
    try {
      const r = await attendanceApi.listByLesson(token, lessonId);
      setRows(r);
    } catch {
      setRows([]);
    }
  }, [token, lessonId]);

  useEffect(() => {
    if (lessonId) void loadRows();
    else setRows([]);
  }, [lessonId, loadRows]);

  const register = async (
    studentId: string,
    present: boolean,
    participation?: ParticipationPayload,
  ) => {
    if (!token || !lessonId) return;
    setBusyId(studentId);
    try {
      await attendanceApi.register(token, {
        classId,
        studentId,
        lessonId,
        present,
        participation,
      });
      await loadRows();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao salvar");
    } finally {
      setBusyId(null);
    }
  };

  const onTogglePresent = (studentId: string, next: boolean) => {
    const rec = map.get(studentId);
    const participation = rec
      ? parseParticipation(rec.participation ?? null)
      : undefined;
    void register(studentId, next, participation);
  };

  const onSaveParticipation = (studentId: string, payload: ParticipationPayload) => {
    const rec = map.get(studentId);
    if (!rec?.present) return;
    void register(studentId, true, payload);
  };

  const unlockCpad = async () => {
    if (!token) return;
    setCpadUnlocking(true);
    try {
      await lessonsApi.unlockNextCpad(token, classId);
      await loadAll();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha ao liberar");
    } finally {
      setCpadUnlocking(false);
    }
  };

  if (!token) return null;

  if (!isStaff) {
    return (
      <div className="px-4 py-8 text-center text-muted">
        Apenas professores e administradores lançam presença nesta tela.
      </div>
    );
  }

  return (
    <div className="px-4 py-6">
      <h1 className="text-xl font-black text-text">Presença · {className}</h1>
      {error ? (
        <p className="mt-2 text-sm text-danger-text-bright">{error}</p>
      ) : null}
      {loading ? (
        <p className="mt-8 text-muted">Carregando…</p>
      ) : (
        <>
          {cpadMeta?.canUnlockNext ? (
            <div className="mt-4 flex items-center gap-3">
              <Button
                size="sm"
                disabled={cpadUnlocking}
                onClick={() => void unlockCpad()}
              >
                {cpadUnlocking ? "…" : "Liberar próxima lição CPAD"}
              </Button>
              <span className="text-xs text-muted">
                Liberadas até #{cpadMeta.releasedThroughLessonIndex}
              </span>
            </div>
          ) : null}
          <div className="mt-4">
            <label className="mb-1 block text-xs font-bold text-muted">
              Aula
            </label>
            <select
              className="h-11 w-full rounded-xl border border-input-border bg-input px-3 text-sm text-text-secondary"
              value={lessonId ?? ""}
              onChange={(e) => setLessonId(e.target.value || null)}
            >
              {lessons.length === 0 ? (
                <option value="">Nenhuma aula</option>
              ) : (
                lessons.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.title}
                  </option>
                ))
              )}
            </select>
          </div>
          <div className="mt-6 space-y-3">
            {students.map((s) => (
              <StudentAttendanceRow
                key={s.id}
                s={s}
                record={map.get(s.id)}
                busy={busyId === s.id}
                onTogglePresent={onTogglePresent}
                onSaveParticipation={onSaveParticipation}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
