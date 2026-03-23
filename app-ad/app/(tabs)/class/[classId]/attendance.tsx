import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useLocalSearchParams } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '@/constants/app-theme';
import {
  attendanceApi,
  type AttendanceRecordDto,
  type ParticipationPayload,
} from '@/lib/attendance-api';
import { classesApi, type ClassStudent } from '@/lib/classes-api';
import { lessonsApi, type CpadLessonsState, type LessonDto } from '@/lib/lessons-api';
import { useAuth } from '@/providers/auth-provider';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;

function pad2(n: number) {
  return n < 10 ? `0${n}` : `${n}`;
}

function defaultDateParts() {
  const d = new Date();
  return {
    dateStr: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    timeStr: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function localDateTimeToIso(dateStr: string, timeStr: string): string {
  const [y, m, day] = dateStr.split('-').map((x) => Number.parseInt(x, 10));
  const [hh, mm] = timeStr.split(':').map((x) => Number.parseInt(x, 10));
  if (!y || !m || !day || Number.isNaN(hh) || Number.isNaN(mm)) {
    throw new Error('Data ou hora inválida');
  }
  const local = new Date(y, m - 1, day, hh, mm, 0, 0);
  return local.toISOString();
}

function isoToDateParts(iso: string) {
  const d = new Date(iso);
  return {
    dateStr: `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`,
    timeStr: `${pad2(d.getHours())}:${pad2(d.getMinutes())}`,
  };
}

function parseParticipation(p: Record<string, unknown> | null | undefined) {
  if (!p || typeof p !== 'object') {
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

export default function ClassLessonAttendanceScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const raw = useLocalSearchParams<{ classId: string }>().classId;
  const classId = Array.isArray(raw) ? raw[0] : raw;

  const [className, setClassName] = useState('');
  const [lessons, setLessons] = useState<LessonDto[]>([]);
  const [lessonId, setLessonId] = useState<string | null>(null);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [attendanceRows, setAttendanceRows] = useState<AttendanceRecordDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyStudentId, setBusyStudentId] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [newTitle, setNewTitle] = useState('Aula');
  const [newDate, setNewDate] = useState(defaultDateParts().dateStr);
  const [newTime, setNewTime] = useState(defaultDateParts().timeStr);
  const [creating, setCreating] = useState(false);
  const [presenceCounts, setPresenceCounts] = useState<Map<string, number>>(new Map());
  const [expandedStudentId, setExpandedStudentId] = useState<string | null>(null);

  const [useCpadMode, setUseCpadMode] = useState(false);
  const [cpadMeta, setCpadMeta] = useState<Pick<
    CpadLessonsState,
    'cpadYear' | 'canUnlockNext' | 'releasedThroughLessonIndex' | 'maxLessonIndex'
  > | null>(null);
  const [unlockingCpad, setUnlockingCpad] = useState(false);
  const [enablingCpad, setEnablingCpad] = useState(false);

  const [editLessonOpen, setEditLessonOpen] = useState(false);
  const [editLocation, setEditLocation] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editTime, setEditTime] = useState('');
  const [editSaving, setEditSaving] = useState(false);
  const [editOriginalStartsAt, setEditOriginalStartsAt] = useState('');
  const [editOriginalLocation, setEditOriginalLocation] = useState('');

  const attendanceMap = useMemo(() => {
    const m = new Map<string, AttendanceRecordDto>();
    attendanceRows.forEach((r) => m.set(r.studentId, r));
    return m;
  }, [attendanceRows]);

  const loadAll = useCallback(async () => {
    if (!token || !classId) return;
    try {
      setLoading(true);
      setError(null);
      const [classList, roster, countRows] = await Promise.all([
        classesApi.list(token),
        classesApi.listStudents(token, classId),
        user?.role === 'teacher' || user?.role === 'admin'
          ? attendanceApi.countsByClass(token, classId).catch(() => [])
          : Promise.resolve([] as { studentId: string; presentCount: number }[]),
      ]);
      setPresenceCounts(new Map(countRows.map((r) => [r.studentId, r.presentCount])));
      const c = classList.find((x) => x.id === classId);
      setClassName(c?.name ?? 'Turma');
      setStudents(roster);

      const cpadOn = c?.useCpadSchedule === true;
      setUseCpadMode(cpadOn);

      let ls: LessonDto[];
      if (cpadOn) {
        const state = await lessonsApi.cpadState(token, classId);
        ls = state.lessons;
        setCpadMeta({
          cpadYear: state.cpadYear,
          canUnlockNext: state.canUnlockNext,
          releasedThroughLessonIndex: state.releasedThroughLessonIndex,
          maxLessonIndex: state.maxLessonIndex,
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
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
    } finally {
      setLoading(false);
    }
  }, [token, classId, user?.role]);

  useEffect(() => {
    setLessonId(null);
  }, [classId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const loadAttendanceOnly = useCallback(async () => {
    if (!token || !lessonId) return;
    try {
      const rows = await attendanceApi.listByLesson(token, lessonId);
      setAttendanceRows(rows);
    } catch {
      setAttendanceRows([]);
    }
  }, [token, lessonId]);

  useEffect(() => {
    if (lessonId) void loadAttendanceOnly();
    else setAttendanceRows([]);
  }, [lessonId, loadAttendanceOnly]);

  useEffect(() => {
    setExpandedStudentId(null);
  }, [lessonId]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: className || 'Presença' });
  }, [navigation, className]);

  const onCreateLesson = async () => {
    if (!token || !classId) return;
    try {
      setCreating(true);
      const startsAt = localDateTimeToIso(newDate, newTime);
      const created = await lessonsApi.create(token, {
        classId,
        title: newTitle.trim() || 'Aula',
        startsAt,
      });
      setModalOpen(false);
      setLessons((prev) => [created, ...prev]);
      setLessonId(created.id);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao criar aula');
    } finally {
      setCreating(false);
    }
  };

  const onUnlockNextCpad = async () => {
    if (!token || !classId) return;
    try {
      setUnlockingCpad(true);
      const state = await lessonsApi.unlockNextCpad(token, classId);
      setLessons(state.lessons);
      setCpadMeta({
        cpadYear: state.cpadYear,
        canUnlockNext: state.canUnlockNext,
        releasedThroughLessonIndex: state.releasedThroughLessonIndex,
        maxLessonIndex: state.maxLessonIndex,
      });
      const last = state.lessons[state.lessons.length - 1];
      if (last) setLessonId(last.id);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao liberar lição');
    } finally {
      setUnlockingCpad(false);
    }
  };

  const onEnableCpadSchedule = () => {
    if (!token || !classId) return;
    Alert.alert(
      'Calendário CPAD',
      'Ativar o modo CPAD para esta turma? As lições passarão a seguir o calendário anual (domingos) com liberação semanal.',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Ativar',
          onPress: () => void doEnableCpad(),
        },
      ],
    );
  };

  const doEnableCpad = async () => {
    if (!token || !classId) return;
    try {
      setEnablingCpad(true);
      await classesApi.patchClass(token, classId, {
        useCpadSchedule: true,
        cpadYear: new Date().getFullYear(),
        releasedThroughLessonIndex: 1,
      });
      await loadAll();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao ativar CPAD');
    } finally {
      setEnablingCpad(false);
    }
  };

  const openEditLesson = () => {
    const l = lessons.find((x) => x.id === lessonId);
    if (!l) return;
    const parts = isoToDateParts(l.startsAt);
    setEditLocation(l.location ?? '');
    setEditDate(parts.dateStr);
    setEditTime(parts.timeStr);
    setEditOriginalStartsAt(l.startsAt);
    setEditOriginalLocation(l.location ?? '');
    setEditLessonOpen(true);
  };

  const onSaveLessonEdit = async () => {
    if (!token || !lessonId) return;
    try {
      setEditSaving(true);
      const newStartsAt = localDateTimeToIso(editDate, editTime);
      const newLoc = editLocation.trim();
      const timeChanged = newStartsAt !== editOriginalStartsAt;
      const locChanged = newLoc !== editOriginalLocation;
      if (!timeChanged && !locChanged) {
        setEditLessonOpen(false);
        return;
      }
      const body: { startsAt?: string; location?: string } = {};
      if (timeChanged) body.startsAt = newStartsAt;
      if (locChanged) body.location = newLoc;
      const updated = await lessonsApi.patchLesson(token, lessonId, body);
      setLessons((prev) => prev.map((x) => (x.id === updated.id ? updated : x)));
      setEditLessonOpen(false);
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setEditSaving(false);
    }
  };

  const refreshPresenceCounts = useCallback(async () => {
    if (!token || !classId) return;
    try {
      const rows = await attendanceApi.countsByClass(token, classId);
      setPresenceCounts(new Map(rows.map((r) => [r.studentId, r.presentCount])));
    } catch {
      /* ignore */
    }
  }, [token, classId]);

  const onSaveStudent = async (
    student: ClassStudent,
    present: boolean,
    participation: ParticipationPayload,
  ) => {
    if (!token || !classId || !lessonId) return;
    if (attendanceMap.has(student.id)) {
      Alert.alert('Já registrado', 'A presença deste aluno já foi salva nesta aula.');
      return;
    }
    try {
      setBusyStudentId(student.id);
      setError(null);
      await attendanceApi.register(token, {
        classId,
        studentId: student.id,
        lessonId,
        present,
        participation,
      });
      await loadAttendanceOnly();
      await refreshPresenceCounts();
    } catch (e) {
      Alert.alert('Erro', e instanceof Error ? e.message : 'Falha ao salvar');
    } finally {
      setBusyStudentId(null);
    }
  };

  if (!user || !token || !classId) {
    return null;
  }

  if (user.role === 'student') {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.denied}>Apenas professores e administradores marcam presença.</Text>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 40 }]}>
        <ActivityIndicator color={ACCENT} size="large" />
      </View>
    );
  }

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <ScrollView
        style={styles.mainScroll}
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator>
        {error ? <Text style={styles.err}>{error}</Text> : null}

        <View style={styles.section}>
          {useCpadMode ? (
            <>
              <Text style={styles.sectionTitle}>
                Lições CPAD{cpadMeta?.cpadYear != null ? ` · ${cpadMeta.cpadYear}` : ''}
              </Text>
              <Text style={styles.sectionHint}>
                Só aparecem as lições já liberadas (começando pela 1). A pontuação de pontualidade usa o
                horário de início e o momento em que você salvar cada presença. Data e local vêm preenchidos;
                ajuste só se precisar.
              </Text>
            </>
          ) : (
            <>
              <Text style={styles.sectionTitle}>Aula (horário oficial)</Text>
              <Text style={styles.sectionHint}>
                Modo livre: crie aulas manualmente. A pontuação de pontualidade usa o horário de início da
                aula e o momento em que você salvar cada presença.
              </Text>
            </>
          )}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsRow}>
            {lessons.map((l) => (
              <Pressable
                key={l.id}
                onPress={() => setLessonId(l.id)}
                style={[styles.chip, lessonId === l.id && styles.chipOn]}>
                <Text style={[styles.chipTitle, lessonId === l.id && styles.chipTitleOn]} numberOfLines={2}>
                  {l.title}
                </Text>
                <Text style={styles.chipSub} numberOfLines={2}>
                  {(l.location ? `${l.location} · ` : '') + new Date(l.startsAt).toLocaleString()}
                </Text>
              </Pressable>
            ))}
          </ScrollView>
          {useCpadMode ? (
            <View style={styles.cpadActions}>
              {cpadMeta?.canUnlockNext ? (
                <Pressable
                  style={[styles.unlockBtn, unlockingCpad && { opacity: 0.6 }]}
                  disabled={unlockingCpad}
                  onPress={() => void onUnlockNextCpad()}>
                  {unlockingCpad ? (
                    <ActivityIndicator color={AppTheme.onAccent} />
                  ) : (
                    <Text style={styles.unlockBtnText}>Marcar presença da próxima semana</Text>
                  )}
                </Pressable>
              ) : null}
              {lessonId ? (
                <Pressable style={styles.secondaryBtn} onPress={openEditLesson}>
                  <Text style={styles.secondaryBtnText}>Ajustar data e local desta lição</Text>
                </Pressable>
              ) : null}
              {cpadMeta != null && cpadMeta.maxLessonIndex != null ? (
                <Text style={styles.cpadMetaLine}>
                  Liberadas: {cpadMeta.releasedThroughLessonIndex} de {cpadMeta.maxLessonIndex} lições
                </Text>
              ) : null}
            </View>
          ) : (
            <>
              <Pressable style={styles.newLessonBtn} onPress={() => setModalOpen(true)}>
                <Text style={styles.newLessonBtnText}>+ Nova aula</Text>
              </Pressable>
              <Pressable
                style={[styles.secondaryBtn, { marginTop: 10 }, enablingCpad && { opacity: 0.6 }]}
                disabled={enablingCpad}
                onPress={onEnableCpadSchedule}>
                <Text style={styles.secondaryBtnText}>Ativar calendário CPAD nesta turma</Text>
              </Pressable>
            </>
          )}
        </View>

        {!lessonId ? (
          <Text style={styles.empty}>
            {useCpadMode
              ? 'Não foi possível carregar lições CPAD. Verifique o arquivo do ano no servidor ou as configurações da turma.'
              : 'Crie uma aula para começar a marcar presenças.'}
          </Text>
        ) : (
          <>
            <Text style={styles.listHeader}>
              {students.length} aluno{students.length === 1 ? '' : 's'} · toque no nome para expandir
            </Text>
            {students.map((item) => (
              <StudentRow
                key={item.id}
                student={item}
                existing={attendanceMap.get(item.id)}
                busy={busyStudentId === item.id}
                presenceCount={presenceCounts.get(item.id) ?? 0}
                expanded={expandedStudentId === item.id}
                onToggleExpand={() =>
                  setExpandedStudentId((id) => (id === item.id ? null : item.id))
                }
                onSave={onSaveStudent}
              />
            ))}
          </>
        )}
      </ScrollView>

      <Modal visible={editLessonOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Data e local</Text>
            <Text style={styles.sectionHint}>
              Opcional: altere só se a aula não for no padrão. Com presenças já salvas, o horário não pode ser
              mudado (só o local).
            </Text>
            <Text style={styles.label}>Local</Text>
            <TextInput
              value={editLocation}
              onChangeText={setEditLocation}
              style={styles.input}
              placeholder="Ex: Igreja (nome)"
              placeholderTextColor={AppTheme.placeholder}
            />
            <Text style={styles.label}>Data (AAAA-MM-DD)</Text>
            <TextInput
              value={editDate}
              onChangeText={setEditDate}
              style={styles.input}
              placeholder="2026-01-04"
              placeholderTextColor={AppTheme.placeholder}
            />
            <Text style={styles.label}>Hora de início (HH:MM)</Text>
            <TextInput
              value={editTime}
              onChangeText={setEditTime}
              style={styles.input}
              placeholder="09:00"
              placeholderTextColor={AppTheme.placeholder}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setEditLessonOpen(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalOk, editSaving && { opacity: 0.6 }]}
                disabled={editSaving}
                onPress={() => void onSaveLessonEdit()}>
                {editSaving ? (
                  <ActivityIndicator color={AppTheme.onAccent} />
                ) : (
                  <Text style={styles.modalOkText}>Salvar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={modalOpen} animationType="slide" transparent>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Text style={styles.modalTitle}>Nova aula</Text>
            <Text style={styles.label}>Título</Text>
            <TextInput
              value={newTitle}
              onChangeText={setNewTitle}
              style={styles.input}
              placeholder="Ex: Lição 12"
              placeholderTextColor={AppTheme.placeholder}
            />
            <Text style={styles.label}>Data (AAAA-MM-DD)</Text>
            <TextInput
              value={newDate}
              onChangeText={setNewDate}
              style={styles.input}
              placeholder="2025-03-19"
              placeholderTextColor={AppTheme.placeholder}
            />
            <Text style={styles.label}>Hora de início (HH:MM)</Text>
            <TextInput
              value={newTime}
              onChangeText={setNewTime}
              style={styles.input}
              placeholder="09:00"
              placeholderTextColor={AppTheme.placeholder}
            />
            <View style={styles.modalActions}>
              <Pressable style={styles.modalCancel} onPress={() => setModalOpen(false)}>
                <Text style={styles.modalCancelText}>Cancelar</Text>
              </Pressable>
              <Pressable
                style={[styles.modalOk, creating && { opacity: 0.6 }]}
                disabled={creating}
                onPress={() => void onCreateLesson()}>
                {creating ? (
                  <ActivityIndicator color={AppTheme.onAccent} />
                ) : (
                  <Text style={styles.modalOkText}>Criar</Text>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

function StudentRow({
  student,
  existing,
  busy,
  presenceCount,
  expanded,
  onToggleExpand,
  onSave,
}: {
  student: ClassStudent;
  existing?: AttendanceRecordDto;
  busy: boolean;
  presenceCount: number;
  expanded: boolean;
  onToggleExpand: () => void;
  onSave: (s: ClassStudent, present: boolean, p: ParticipationPayload) => void;
}) {
  const [present, setPresent] = useState(true);
  const [magazine, setMagazine] = useState(false);
  const [bible, setBible] = useState(false);
  const [lessonParticipation, setLessonParticipation] = useState(false);
  const [offering, setOffering] = useState(false);

  const savedPart = existing ? parseParticipation(existing.participation) : null;

  const buildPayload = (): ParticipationPayload => ({
    ...(magazine ? { magazine: true } : {}),
    ...(bible ? { bible: true } : {}),
    ...(lessonParticipation ? { lessonParticipation: true } : {}),
    ...(offering ? { offering: true } : {}),
  });

  return (
    <View style={styles.studentCard}>
      <Pressable
        onPress={onToggleExpand}
        style={({ pressed }) => [styles.studentHeader, pressed && styles.studentHeaderPressed]}>
        <View style={styles.studentHeaderLeft}>
          <Text style={styles.studentHeaderName} numberOfLines={1}>
            {student.name}
          </Text>
          <View style={styles.presencePill}>
            <Text style={styles.presencePillText}>
              {presenceCount} presença{presenceCount === 1 ? '' : 's'}
            </Text>
          </View>
        </View>
        <Text style={styles.chevron}>{expanded ? '▲' : '▼'}</Text>
      </Pressable>

      {expanded ? (
        <View style={styles.studentBody}>
          {existing ? (
            <>
              <Text style={styles.savedHint}>
                Registrado nesta aula em {new Date(existing.recordedAt).toLocaleString()}
              </Text>
              <ToggleRow label="Presente" value={existing.present} disabled />
              <ToggleRow label="Trouxe revista" value={savedPart!.magazine} disabled />
              <ToggleRow label="Trouxe Bíblia" value={savedPart!.bible} disabled />
              <ToggleRow label="Participação" value={savedPart!.lessonParticipation} disabled />
              <ToggleRow label="Oferta" value={savedPart!.offering} disabled />
            </>
          ) : (
            <>
              <ToggleRow
                label="Presente"
                value={present}
                disabled={false}
                onValueChange={setPresent}
              />
              <ToggleRow
                label="Trouxe revista"
                value={magazine}
                disabled={!present}
                onValueChange={setMagazine}
              />
              <ToggleRow
                label="Trouxe Bíblia"
                value={bible}
                disabled={!present}
                onValueChange={setBible}
              />
              <ToggleRow
                label="Participação"
                value={lessonParticipation}
                disabled={!present}
                onValueChange={setLessonParticipation}
              />
              <ToggleRow
                label="Oferta"
                value={offering}
                disabled={!present}
                onValueChange={setOffering}
              />
              <Pressable
                style={[styles.saveBtn, busy && { opacity: 0.6 }]}
                disabled={busy}
                onPress={() => onSave(student, present, buildPayload())}>
                {busy ? (
                  <ActivityIndicator color={AppTheme.onAccent} />
                ) : (
                  <Text style={styles.saveBtnText}>Salvar presença</Text>
                )}
              </Pressable>
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

function ToggleRow({
  label,
  value,
  disabled,
  onValueChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onValueChange?: (v: boolean) => void;
}) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowLabel, disabled && styles.rowLabelMuted]}>{label}</Text>
      <Switch
        value={value}
        onValueChange={onValueChange}
        disabled={disabled || !onValueChange}
        trackColor={{ false: AppTheme.borderStrong, true: ACCENT }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  mainScroll: { flex: 1 },
  scrollContent: { paddingBottom: 48 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  denied: { color: MUTED, padding: 24, textAlign: 'center' },
  err: { color: AppTheme.danger, marginBottom: 8 },
  section: { marginBottom: 16 },
  sectionTitle: { color: AppTheme.text, fontWeight: '800', fontSize: 16 },
  sectionHint: { color: MUTED, fontSize: 12, marginTop: 6, lineHeight: 18 },
  chipsRow: { marginTop: 12, maxHeight: 88 },
  chip: {
    width: 200,
    padding: 12,
    borderRadius: 14,
    backgroundColor: CARD,
    borderWidth: 1,
    borderColor: BORDER,
    marginRight: 10,
  },
  chipOn: { borderColor: ACCENT, backgroundColor: AppTheme.chipOnBg },
  chipTitle: { color: AppTheme.textSecondary, fontWeight: '700' },
  chipTitleOn: { color: ACCENT },
  chipSub: { color: MUTED, fontSize: 11, marginTop: 4 },
  newLessonBtn: {
    marginTop: 12,
    alignSelf: 'flex-start',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(89, 244, 168, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(89, 244, 168, 0.4)',
  },
  newLessonBtnText: { color: ACCENT, fontWeight: '800' },
  cpadActions: { marginTop: 12, gap: 10 },
  unlockBtn: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
  },
  unlockBtnText: { color: AppTheme.onAccent, fontWeight: '900', fontSize: 15, textAlign: 'center' },
  secondaryBtn: {
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    backgroundColor: CARD,
    alignItems: 'center',
  },
  secondaryBtnText: { color: AppTheme.textSecondary, fontWeight: '700', fontSize: 14, textAlign: 'center' },
  cpadMetaLine: { color: MUTED, fontSize: 12, marginTop: 4 },
  empty: { color: MUTED, textAlign: 'center', marginTop: 32 },
  listHeader: { color: MUTED, marginBottom: 12, fontWeight: '600', fontSize: 13 },
  studentCard: {
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    marginBottom: 10,
    overflow: 'hidden',
  },
  studentHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 14,
    paddingHorizontal: 16,
    gap: 12,
  },
  studentHeaderPressed: { backgroundColor: AppTheme.surfaceMuted },
  studentHeaderLeft: { flex: 1, minWidth: 0, gap: 8 },
  studentHeaderName: { color: AppTheme.text, fontWeight: '800', fontSize: 17 },
  presencePill: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(89, 244, 168, 0.12)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: 'rgba(89, 244, 168, 0.35)',
  },
  presencePillText: { color: ACCENT, fontSize: 12, fontWeight: '800' },
  chevron: { color: MUTED, fontSize: 12, fontWeight: '800' },
  studentBody: {
    paddingHorizontal: 16,
    paddingBottom: 16,
    paddingTop: 4,
    borderTopWidth: 1,
    borderTopColor: BORDER,
  },
  savedHint: { color: MUTED, fontSize: 12, marginBottom: 12, lineHeight: 18 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 10,
  },
  rowLabel: { color: AppTheme.textSecondary, fontSize: 15, flex: 1, paddingRight: 12 },
  rowLabelMuted: { color: MUTED },
  saveBtn: {
    marginTop: 8,
    backgroundColor: ACCENT,
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
  },
  saveBtnText: { color: AppTheme.onAccent, fontWeight: '900' },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.6)',
    justifyContent: 'center',
    padding: 24,
  },
  modalCard: {
    backgroundColor: CARD,
    borderRadius: 18,
    padding: 20,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalTitle: { color: AppTheme.text, fontSize: 20, fontWeight: '900', marginBottom: 16 },
  label: { color: MUTED, fontSize: 12, marginBottom: 6, fontWeight: '600' },
  input: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    color: AppTheme.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    marginBottom: 12,
  },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 8 },
  modalCancel: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
  },
  modalCancelText: { color: MUTED, fontWeight: '700' },
  modalOk: {
    flex: 1,
    paddingVertical: 14,
    alignItems: 'center',
    borderRadius: 12,
    backgroundColor: ACCENT,
  },
  modalOkText: { color: AppTheme.onAccent, fontWeight: '900' },
});
