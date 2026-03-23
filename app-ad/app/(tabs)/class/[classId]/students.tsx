import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { router, useLocalSearchParams } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppTheme } from '@/constants/app-theme';
import {
  classesApi,
  type ClassAccessRequestDetailed,
  type ClassStudent,
  type ClassTeacher,
} from '@/lib/classes-api';
import { listChurchUsers, patchUserRole, type ChurchUserListItem } from '@/lib/users-api';
import { useAuth } from '@/providers/auth-provider';

const ACCENT = AppTheme.accent;
const BG = AppTheme.bg;
const CARD = AppTheme.card;
const BORDER = AppTheme.border;
const MUTED = AppTheme.muted;
const DANGER = AppTheme.danger;
const SUCCESS_BG = AppTheme.successMuted;
const SUCCESS_BORDER = 'rgba(34, 197, 94, 0.35)';

type ConfirmPayload = {
  requestId: string;
  approve: boolean;
  studentName: string;
  studentEmail: string;
  requestKind?: string;
};

type Feedback = { type: 'success' | 'error'; message: string };

type SectionRow =
  | { k: 'r'; row: ClassAccessRequestDetailed }
  | { k: 's'; row: ClassStudent }
  | { k: 't'; row: ClassTeacher };

export default function ClassManageStudentsScreen() {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();
  const { token, user } = useAuth();
  const raw = useLocalSearchParams<{ classId: string }>().classId;
  const classId = Array.isArray(raw) ? raw[0] : raw;

  const [className, setClassName] = useState('');
  const [pendingRows, setPendingRows] = useState<ClassAccessRequestDetailed[]>([]);
  const [students, setStudents] = useState<ClassStudent[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<ClassTeacher[]>([]);
  const [addTeacherOpen, setAddTeacherOpen] = useState(false);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [churchTeachers, setChurchTeachers] = useState<ChurchUserListItem[]>([]);
  const [churchStudents, setChurchStudents] = useState<ChurchUserListItem[]>([]);
  const [churchNonAdmins, setChurchNonAdmins] = useState<ChurchUserListItem[]>([]);
  const [addAdminOpen, setAddAdminOpen] = useState(false);
  const [promoteAdminTarget, setPromoteAdminTarget] = useState<ChurchUserListItem | null>(null);
  const promoteAdminTargetRef = useRef<ChurchUserListItem | null>(null);
  promoteAdminTargetRef.current = promoteAdminTarget;
  const [promoteAdminBusy, setPromoteAdminBusy] = useState(false);
  const [pickerLoading, setPickerLoading] = useState(false);
  const [renameOpen, setRenameOpen] = useState(false);
  const [renameText, setRenameText] = useState('');
  const [renameBusy, setRenameBusy] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [removeStu, setRemoveStu] = useState<ClassStudent | null>(null);
  const [removeTea, setRemoveTea] = useState<ClassTeacher | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);

  const [confirm, setConfirm] = useState<ConfirmPayload | null>(null);
  const [modalBusy, setModalBusy] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearFeedbackSoon = useCallback((next: Feedback) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(next);
    feedbackTimer.current = setTimeout(() => {
      setFeedback(null);
      feedbackTimer.current = null;
    }, 4200);
  }, []);

  useEffect(() => {
    return () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    };
  }, []);

  const load = useCallback(async () => {
    if (!token || !classId || !user) return;
    try {
      setError(null);
      const [classesList, allReqs, roster, teachersList] = await Promise.all([
        classesApi.list(token),
        user.role === 'admin'
          ? classesApi.listStaffAccessRequests(token)
          : Promise.resolve([] as ClassAccessRequestDetailed[]),
        classesApi.listStudents(token, classId),
        user.role === 'admin'
          ? classesApi.listTeachers(token, classId).catch(() => [] as ClassTeacher[])
          : Promise.resolve([] as ClassTeacher[]),
      ]);
      const c = classesList.find((x) => x.id === classId);
      setClassName(c?.name ?? 'Turma');
      setStudents(roster);
      setTeachers(teachersList);

      if (user.role === 'admin') {
        const forClass = allReqs.filter((r) => r.classId === classId);
        setPendingRows(
          forClass.filter(
            (r) => r.status === 'PENDING_ADMIN' || r.status === 'PENDING_TEACHER',
          ),
        );
      } else {
        setPendingRows([]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao carregar');
      setPendingRows([]);
      setStudents([]);
      setTeachers([]);
    } finally {
      setLoading(false);
    }
  }, [token, classId, user]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = useCallback(async () => {
    if (!token) return;
    try {
      setRefreshing(true);
      await load();
    } finally {
      setRefreshing(false);
    }
  }, [token, load]);

  useLayoutEffect(() => {
    navigation.setOptions({ title: className ? `Turma · ${className}` : 'Gerenciar alunos' });
  }, [navigation, className]);

  const closeModal = useCallback(() => {
    if (modalBusy) return;
    setConfirm(null);
    setModalError(null);
  }, [modalBusy]);

  const openConfirm = useCallback((payload: ConfirmPayload) => {
    setModalError(null);
    setConfirm(payload);
  }, []);

  const submitModeration = useCallback(async () => {
    if (!token || !user) return;
    const payload = confirm;
    if (!payload) return;
    const { requestId, approve } = payload;
    setModalBusy(true);
    setModalError(null);
    setBusyId(requestId);
    try {
      await classesApi.moderateByAdmin(token, { requestId, approve });
      await load();
      try {
        if (approve) {
          await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
      } catch {
        /* opcional */
      }
      setConfirm(null);
      clearFeedbackSoon({
        type: 'success',
        message: approve
          ? payload.requestKind === 'teacher'
            ? 'Professor vinculado à turma com sucesso.'
            : 'Aluno vinculado à turma com sucesso.'
          : 'Pedido recusado. A pessoa pode solicitar novamente depois.',
      });
    } catch (e) {
      try {
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
      } catch {
        /* ignore */
      }
      setModalError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente de novo.');
    } finally {
      setModalBusy(false);
      setBusyId(null);
    }
  }, [token, user, confirm, load, clearFeedbackSoon]);

  const openTeacherPicker = useCallback(async () => {
    if (!token || !classId) return;
    setAddTeacherOpen(true);
    setPickerLoading(true);
    try {
      const all = await listChurchUsers(token);
      setChurchTeachers(all.filter((u) => !u.teacherClassIds.includes(classId)));
    } catch {
      setChurchTeachers([]);
    } finally {
      setPickerLoading(false);
    }
  }, [token, classId]);

  const openStudentPicker = useCallback(async () => {
    if (!token || !classId) return;
    setAddStudentOpen(true);
    setPickerLoading(true);
    try {
      const all = await listChurchUsers(token, 'student');
      setChurchStudents(all.filter((u) => u.classId !== classId));
    } catch {
      setChurchStudents([]);
    } finally {
      setPickerLoading(false);
    }
  }, [token, classId]);

  const openAdminPicker = useCallback(async () => {
    if (!token) return;
    setAddAdminOpen(true);
    setPickerLoading(true);
    try {
      const all = await listChurchUsers(token);
      setChurchNonAdmins(all.filter((u) => u.role !== 'admin'));
    } catch {
      setChurchNonAdmins([]);
    } finally {
      setPickerLoading(false);
    }
  }, [token]);

  const submitPromoteToAdmin = useCallback(async () => {
    if (!token) return;
    const target = promoteAdminTargetRef.current;
    if (!target) return;
    setPromoteAdminBusy(true);
    try {
      await patchUserRole(token, target.id, 'admin');
      setPromoteAdminTarget(null);
      setAddAdminOpen(false);
      await load();
      clearFeedbackSoon({
        type: 'success',
        message: `${target.name} agora é administrador da igreja.`,
      });
    } catch (e) {
      clearFeedbackSoon({
        type: 'error',
        message: e instanceof Error ? e.message : 'Não foi possível promover.',
      });
    } finally {
      setPromoteAdminBusy(false);
    }
  }, [token, load, clearFeedbackSoon]);

  const submitRename = useCallback(async () => {
    if (!token || !classId) return;
    const name = renameText.trim();
    if (!name) return;
    setRenameBusy(true);
    try {
      await classesApi.patchClass(token, classId, { name });
      setClassName(name);
      setRenameOpen(false);
      clearFeedbackSoon({ type: 'success', message: 'Nome da turma atualizado.' });
    } catch (e) {
      clearFeedbackSoon({
        type: 'error',
        message: e instanceof Error ? e.message : 'Não foi possível renomear.',
      });
    } finally {
      setRenameBusy(false);
    }
  }, [token, classId, renameText, clearFeedbackSoon]);

  const submitDeleteClass = useCallback(async () => {
    if (!token || !classId) return;
    setDeleteBusy(true);
    try {
      await classesApi.deleteClass(token, classId);
      setDeleteOpen(false);
      router.replace('/(tabs)');
    } catch (e) {
      clearFeedbackSoon({
        type: 'error',
        message: e instanceof Error ? e.message : 'Não foi possível excluir a turma.',
      });
    } finally {
      setDeleteBusy(false);
    }
  }, [token, classId, clearFeedbackSoon]);

  const submitRemoveStudent = useCallback(async () => {
    if (!token || !classId || !removeStu) return;
    setRemoveBusy(true);
    try {
      await classesApi.removeStudentFromClass(token, classId, removeStu.id);
      setRemoveStu(null);
      await load();
      clearFeedbackSoon({ type: 'success', message: 'Aluno removido da turma.' });
    } catch (e) {
      clearFeedbackSoon({
        type: 'error',
        message: e instanceof Error ? e.message : 'Falha ao remover aluno.',
      });
    } finally {
      setRemoveBusy(false);
    }
  }, [token, classId, removeStu, load, clearFeedbackSoon]);

  const submitRemoveTeacher = useCallback(async () => {
    if (!token || !classId || !removeTea) return;
    setRemoveBusy(true);
    try {
      await classesApi.removeTeacherFromClass(token, classId, removeTea.id);
      setRemoveTea(null);
      await load();
      clearFeedbackSoon({ type: 'success', message: 'Professor removido da turma.' });
    } catch (e) {
      clearFeedbackSoon({
        type: 'error',
        message: e instanceof Error ? e.message : 'Falha ao remover professor.',
      });
    } finally {
      setRemoveBusy(false);
    }
  }, [token, classId, removeTea, load, clearFeedbackSoon]);

  const assignTeacherPick = useCallback(
    async (userId: string) => {
      if (!token || !classId) return;
      try {
        await classesApi.assignTeacherToClass(token, classId, userId);
        setAddTeacherOpen(false);
        await load();
        clearFeedbackSoon({ type: 'success', message: 'Professor vinculado à turma.' });
      } catch (e) {
        clearFeedbackSoon({
          type: 'error',
          message: e instanceof Error ? e.message : 'Falha ao vincular professor.',
        });
      }
    },
    [token, classId, load, clearFeedbackSoon],
  );

  const assignStudentPick = useCallback(
    async (userId: string) => {
      if (!token || !classId) return;
      try {
        await classesApi.assignStudentToClass(token, classId, userId);
        setAddStudentOpen(false);
        await load();
        clearFeedbackSoon({ type: 'success', message: 'Aluno vinculado à turma.' });
      } catch (e) {
        clearFeedbackSoon({
          type: 'error',
          message: e instanceof Error ? e.message : 'Falha ao vincular aluno.',
        });
      }
    },
    [token, classId, load, clearFeedbackSoon],
  );

  if (!user || !token || !classId) {
    return null;
  }

  if (user.role === 'student') {
    return (
      <View style={[styles.center, { paddingTop: insets.top + 24 }]}>
        <Text style={styles.denied}>Apenas equipe da turma gerencia alunos e pedidos.</Text>
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

  const adminSections: { title: string; data: SectionRow[] }[] = [
    {
      title: `Pedidos pendentes · ${pendingRows.length}`,
      data: pendingRows.map((row) => ({ k: 'r' as const, row })),
    },
    {
      title: `Professores · ${teachers.length}`,
      data: teachers.map((row) => ({ k: 't' as const, row })),
    },
    {
      title: `Alunos na turma · ${students.length}`,
      data: students.map((row) => ({ k: 's' as const, row })),
    },
  ];
  const teacherSections: { title: string; data: SectionRow[] }[] = [
    {
      title: `Alunos na turma · ${students.length}`,
      data: students.map((row) => ({ k: 's' as const, row })),
    },
  ];
  const sections = user.role === 'admin' ? adminSections : teacherSections;

  const emptyPendingHint =
    'Pedidos de alunos ou professores para esta sala aparecem aqui. Só o administrador aprova ou recusa.';
  const emptyTeachersHint =
    'Nenhum professor vinculado além do titular, ou use “+ Professor” para adicionar.';

  const isApprove = confirm?.approve === true;

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      {feedback ? (
        <View
          style={[
            styles.feedbackBanner,
            feedback.type === 'success' ? styles.feedbackOk : styles.feedbackErr,
          ]}>
          <View
            style={[
              styles.feedbackIconCircle,
              feedback.type === 'success' ? styles.feedbackIconOk : styles.feedbackIconBad,
            ]}>
            <Text style={styles.feedbackIconGlyph}>{feedback.type === 'success' ? '✓' : '!'}</Text>
          </View>
          <Text style={styles.feedbackText}>{feedback.message}</Text>
          <Pressable
            hitSlop={12}
            onPress={() => {
              if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
              setFeedback(null);
            }}>
            <Text style={styles.feedbackDismiss}>Fechar</Text>
          </Pressable>
        </View>
      ) : null}

      {error ? <Text style={styles.err}>{error}</Text> : null}

      {user.role === 'admin' ? (
        <View style={styles.adminBar}>
          <Pressable
            style={styles.adminBarBtn}
            onPress={() => {
              setRenameText(className);
              setRenameOpen(true);
            }}>
            <Text style={styles.adminBarBtnText}>Renomear</Text>
          </Pressable>
          <Pressable style={styles.adminBarBtn} onPress={() => void openTeacherPicker()}>
            <Text style={styles.adminBarBtnText}>+ Professor</Text>
          </Pressable>
          <Pressable style={styles.adminBarBtn} onPress={() => void openStudentPicker()}>
            <Text style={styles.adminBarBtnText}>+ Aluno</Text>
          </Pressable>
          <Pressable style={styles.adminBarBtnAccent} onPress={() => void openAdminPicker()}>
            <Text style={styles.adminBarBtnAccentText}>+ Admin</Text>
          </Pressable>
          <Pressable
            style={styles.adminBarBtnDanger}
            onPress={() => setDeleteOpen(true)}>
            <Text style={styles.adminBarBtnDangerText}>Excluir turma</Text>
          </Pressable>
        </View>
      ) : null}

      <Text style={styles.intro}>
        {user.role === 'admin'
          ? 'Gerencie pedidos, professores e alunos. Use + Admin para promover alguém a administrador da igreja. Remover aluno ou professor desfaz o vínculo com esta turma. Para marcar presença, volte à sala.'
          : 'Somente o administrador da igreja aprova pedidos de acesso. Abaixo estão os alunos já vinculados a esta turma.'}
      </Text>

      <SectionList
        sections={sections}
        keyExtractor={(item) =>
          item.k === 'r' ? `req-${item.row.id}` : item.k === 's' ? `stu-${item.row.id}` : `tea-${item.row.id}`
        }
        stickySectionHeadersEnabled={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => void onRefresh()} tintColor={ACCENT} />
        }
        contentContainerStyle={styles.listContent}
        renderSectionHeader={({ section: { title, data } }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>{title}</Text>
            {title.startsWith('Pedidos') && data.length === 0 ? (
              <Text style={styles.sectionEmpty}>{emptyPendingHint}</Text>
            ) : null}
            {title.startsWith('Professores') && data.length === 0 ? (
              <Text style={styles.sectionEmpty}>{emptyTeachersHint}</Text>
            ) : null}
            {title.startsWith('Alunos') && data.length === 0 ? (
              <Text style={styles.sectionEmpty}>
                Ninguém vinculado ainda. Adicione alunos ou aprove um pedido acima.
              </Text>
            ) : null}
          </View>
        )}
        renderItem={({ item }) => {
          if (item.k === 'r') {
            const row = item.row;
            const name = row.user?.name?.trim() || 'Aluno (sem nome)';
            const email = row.user?.email?.trim() ?? '';
            const busy = busyId === row.id;
            const rk = row.requestKind === 'teacher' ? 'teacher' : 'student';
            return (
              <View style={styles.requestCard}>
                <View style={styles.requestKindRow}>
                  <Text style={styles.requestKindPill}>
                    {rk === 'teacher' ? 'Pedido · Professor' : 'Pedido · Aluno'}
                  </Text>
                </View>
                <Text style={styles.requestName}>{name}</Text>
                <Text style={styles.requestEmail} numberOfLines={2}>
                  {email || '—'}
                </Text>
                <Text style={styles.requestWhen}>{new Date(row.createdAt).toLocaleString()}</Text>
                <View style={styles.requestActions}>
                  <Pressable
                    style={[styles.requestRejectBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={() =>
                      openConfirm({
                        requestId: row.id,
                        approve: false,
                        studentName: name,
                        studentEmail: email,
                        requestKind: rk,
                      })
                    }>
                    <Text style={styles.requestRejectText}>Recusar</Text>
                  </Pressable>
                  <Pressable
                    style={[styles.requestApproveBtn, busy && styles.btnDisabled]}
                    disabled={busy}
                    onPress={() =>
                      openConfirm({
                        requestId: row.id,
                        approve: true,
                        studentName: name,
                        studentEmail: email,
                        requestKind: rk,
                      })
                    }>
                    {busy ? (
                      <ActivityIndicator color={AppTheme.onAccent} />
                    ) : (
                      <Text style={styles.requestApproveText}>Aceitar</Text>
                    )}
                  </Pressable>
                </View>
              </View>
            );
          }

          if (item.k === 't') {
            const tea = item.row;
            return (
              <View style={styles.teacherCard}>
                <View style={styles.cardLeft}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{tea.name.slice(0, 2).toUpperCase()}</Text>
                  </View>
                  <View style={styles.cardBody}>
                    <View style={styles.teacherTitleRow}>
                      <Text style={styles.enrolledName}>{tea.name}</Text>
                      {tea.isPrimary ? (
                        <View style={styles.titularPill}>
                          <Text style={styles.titularPillText}>Titular</Text>
                        </View>
                      ) : null}
                      {tea.role === 'admin' ? (
                        <View style={styles.adminPill}>
                          <Text style={styles.adminPillText}>Admin</Text>
                        </View>
                      ) : null}
                    </View>
                    <Text style={styles.enrolledEmail} numberOfLines={1}>
                      {tea.email}
                    </Text>
                  </View>
                </View>
                {user.role === 'admin' ? (
                  <View style={styles.teacherActions}>
                    {!tea.isPrimary ? (
                      <Pressable
                        style={styles.rowSecondaryBtn}
                        onPress={async () => {
                          if (!token || !classId) return;
                          try {
                            await classesApi.patchClass(token, classId, { teacherId: tea.id });
                            await load();
                            clearFeedbackSoon({
                              type: 'success',
                              message: 'Professor titular atualizado.',
                            });
                          } catch (e) {
                            clearFeedbackSoon({
                              type: 'error',
                              message:
                                e instanceof Error ? e.message : 'Não foi possível atualizar o titular.',
                            });
                          }
                        }}>
                        <Text style={styles.rowSecondaryText}>Titular</Text>
                      </Pressable>
                    ) : null}
                    <Pressable style={styles.rowRemoveBtn} onPress={() => setRemoveTea(tea)}>
                      <Text style={styles.rowRemoveText}>Remover</Text>
                    </Pressable>
                  </View>
                ) : null}
              </View>
            );
          }

          const stu = item.row;
          return (
            <View style={styles.cardMuted}>
              <View style={styles.cardLeft}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{stu.name.slice(0, 2).toUpperCase()}</Text>
                </View>
                <View style={styles.cardBody}>
                  <Text style={styles.enrolledName}>{stu.name}</Text>
                  <Text style={styles.enrolledEmail} numberOfLines={1}>
                    {stu.email}
                  </Text>
                </View>
              </View>
              {user.role === 'admin' ? (
                <Pressable style={styles.rowRemoveBtn} onPress={() => setRemoveStu(stu)}>
                  <Text style={styles.rowRemoveText}>Remover</Text>
                </Pressable>
              ) : null}
            </View>
          );
        }}
      />

      <Modal
        visible={confirm !== null}
        transparent
        animationType="fade"
        statusBarTranslucent
        onRequestClose={closeModal}>
        <View style={[styles.modalRoot, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable style={styles.modalBackdrop} onPress={closeModal} accessibilityLabel="Fechar" />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <View style={[styles.modalAccentBar, isApprove ? styles.modalBarOk : styles.modalBarDanger]} />
              <View style={[styles.modalIconWrap, isApprove ? styles.modalIconWrapOk : styles.modalIconWrapDanger]}>
                <Text style={[styles.modalIconEmoji, !isApprove && styles.modalIconEmojiDanger]}>
                  {isApprove ? '✓' : '✕'}
                </Text>
              </View>
              <Text style={styles.modalTitle}>
                {isApprove
                  ? confirm?.requestKind === 'teacher'
                    ? 'Vincular professor à turma?'
                    : 'Vincular aluno à turma?'
                  : 'Recusar este pedido?'}
              </Text>
              <View style={styles.modalStudentBox}>
                <Text style={styles.modalStudentLabel}>Quem pediu acesso</Text>
                <Text style={styles.modalStudentName}>{confirm?.studentName}</Text>
                {confirm?.studentEmail ? (
                  <Text style={styles.modalStudentEmail} numberOfLines={2}>
                    {confirm.studentEmail}
                  </Text>
                ) : null}
              </View>
              <Text style={styles.modalBody}>
                {isApprove
                  ? confirm?.requestKind === 'teacher'
                    ? 'O professor passará a ter acesso a esta turma (presença, alunos, aulas) assim que você confirmar.'
                    : 'O aluno passará a fazer parte desta sala, com acesso às aulas e à lista de presença.'
                  : confirm?.requestKind === 'teacher'
                    ? 'O pedido será encerrado. O professor continua sem esta turma e pode solicitar de novo depois.'
                    : 'O pedido será encerrado. O aluno continua sem turma e pode enviar um novo pedido depois, se desejar.'}
              </Text>
              {modalError ? (
                <View style={styles.modalErrorBox}>
                  <Text style={styles.modalErrorText}>{modalError}</Text>
                </View>
              ) : null}
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtnGhost, modalBusy && styles.btnMuted]}
                  onPress={closeModal}
                  disabled={modalBusy}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[isApprove ? styles.modalBtnPrimary : styles.modalBtnDanger, modalBusy && styles.btnMuted]}
                  onPress={() => void submitModeration()}
                  disabled={modalBusy}>
                  {modalBusy ? (
                    <ActivityIndicator color={isApprove ? AppTheme.onAccent : AppTheme.text} />
                  ) : (
                    <Text style={isApprove ? styles.modalBtnPrimaryText : styles.modalBtnDangerText}>
                      {isApprove ? 'Sim, vincular' : 'Sim, recusar'}
                    </Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={renameOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !renameBusy && setRenameOpen(false)}>
        <View style={[styles.modalRoot, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !renameBusy && setRenameOpen(false)}
            accessibilityLabel="Fechar"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Renomear turma</Text>
              <TextInput
                value={renameText}
                onChangeText={setRenameText}
                placeholder="Nome da turma"
                placeholderTextColor={AppTheme.placeholder}
                style={styles.renameInput}
              />
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtnGhost, renameBusy && styles.btnMuted]}
                  disabled={renameBusy}
                  onPress={() => setRenameOpen(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnPrimary, renameBusy && styles.btnMuted]}
                  disabled={renameBusy}
                  onPress={() => void submitRename()}>
                  {renameBusy ? (
                    <ActivityIndicator color={AppTheme.onAccent} />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>Salvar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={deleteOpen}
        transparent
        animationType="fade"
        onRequestClose={() => !deleteBusy && setDeleteOpen(false)}>
        <View style={[styles.modalRoot, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !deleteBusy && setDeleteOpen(false)}
            accessibilityLabel="Fechar"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Excluir turma?</Text>
              <Text style={styles.modalBody}>
                Isso apaga aulas, presenças, pedidos e vínculos desta turma. Alunos e professores
                permanecem no sistema, mas sem esta sala. Não dá para desfazer.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtnGhost, deleteBusy && styles.btnMuted]}
                  disabled={deleteBusy}
                  onPress={() => setDeleteOpen(false)}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnDanger, deleteBusy && styles.btnMuted]}
                  disabled={deleteBusy}
                  onPress={() => void submitDeleteClass()}>
                  {deleteBusy ? (
                    <ActivityIndicator color={AppTheme.text} />
                  ) : (
                    <Text style={styles.modalBtnDangerText}>Excluir</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addTeacherOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddTeacherOpen(false)}>
        <View style={[styles.pickerModalRoot, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Adicionar professor</Text>
            <Text style={styles.pickerHint}>
              Qualquer usuário da igreja ainda sem esta turma. Alunos passam a ser professores; administradores
              ganham acesso à sala sem perder o papel de admin.
            </Text>
            {pickerLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={churchTeachers}
                keyExtractor={(x) => x.id}
                style={styles.pickerList}
                ListEmptyComponent={
                  <Text style={styles.sectionEmpty}>
                    Todos os usuários da igreja já estão nesta turma como professores ou não há mais contas.
                  </Text>
                }
                renderItem={({ item: u }) => (
                  <Pressable
                    style={styles.pickerRow}
                    onPress={() => void assignTeacherPick(u.id)}>
                    <View style={styles.pickerRowTop}>
                      <Text style={styles.pickerRowName}>{u.name}</Text>
                      <Text style={styles.pickerRolePill}>
                        {u.role === 'student'
                          ? 'Aluno'
                          : u.role === 'admin'
                            ? 'Admin'
                            : u.role === 'teacher'
                              ? 'Professor'
                              : u.role}
                      </Text>
                    </View>
                    <Text style={styles.pickerRowEmail} numberOfLines={1}>
                      {u.email}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            <Pressable style={styles.pickerClose} onPress={() => setAddTeacherOpen(false)}>
              <Text style={styles.pickerCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addStudentOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddStudentOpen(false)}>
        <View style={[styles.pickerModalRoot, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Adicionar aluno</Text>
            <Text style={styles.pickerHint}>
              Alunos desta igreja que não estão nesta turma (podem estar em outra ou sem turma).
            </Text>
            {pickerLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={churchStudents}
                keyExtractor={(x) => x.id}
                style={styles.pickerList}
                ListEmptyComponent={
                  <Text style={styles.sectionEmpty}>Nenhum aluno disponível para adicionar.</Text>
                }
                renderItem={({ item: u }) => (
                  <Pressable
                    style={styles.pickerRow}
                    onPress={() => void assignStudentPick(u.id)}>
                    <Text style={styles.pickerRowName}>{u.name}</Text>
                    <Text style={styles.pickerRowEmail} numberOfLines={1}>
                      {u.email}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            <Pressable style={styles.pickerClose} onPress={() => setAddStudentOpen(false)}>
              <Text style={styles.pickerCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={addAdminOpen}
        transparent
        animationType="slide"
        onRequestClose={() => setAddAdminOpen(false)}>
        <View style={[styles.pickerModalRoot, { paddingBottom: Math.max(insets.bottom, 16) }]}>
          <View style={styles.pickerSheet}>
            <Text style={styles.pickerTitle}>Promover a administrador</Text>
            <Text style={styles.pickerHint}>
              Usuários que ainda não são admin. Passam a gerenciar toda a igreja (turmas, usuários,
              pedidos). Alunos deixam de estar matriculados como alunos.
            </Text>
            {pickerLoading ? (
              <ActivityIndicator color={ACCENT} style={{ marginVertical: 24 }} />
            ) : (
              <FlatList
                data={churchNonAdmins}
                keyExtractor={(x) => x.id}
                style={styles.pickerList}
                ListEmptyComponent={
                  <Text style={styles.sectionEmpty}>Todos os usuários já são administradores.</Text>
                }
                renderItem={({ item: u }) => (
                  <Pressable
                    style={styles.pickerRow}
                    onPress={() => {
                      setAddAdminOpen(false);
                      setPromoteAdminTarget(u);
                    }}>
                    <View style={styles.pickerRowTop}>
                      <Text style={styles.pickerRowName}>{u.name}</Text>
                      <Text style={styles.pickerRolePill}>
                        {u.role === 'student'
                          ? 'Aluno'
                          : u.role === 'teacher'
                            ? 'Professor'
                            : u.role}
                      </Text>
                    </View>
                    <Text style={styles.pickerRowEmail} numberOfLines={1}>
                      {u.email}
                    </Text>
                  </Pressable>
                )}
              />
            )}
            <Pressable style={styles.pickerClose} onPress={() => setAddAdminOpen(false)}>
              <Text style={styles.pickerCloseText}>Fechar</Text>
            </Pressable>
          </View>
        </View>
      </Modal>

      <Modal
        visible={promoteAdminTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !promoteAdminBusy && setPromoteAdminTarget(null)}>
        <View style={[styles.modalRoot, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !promoteAdminBusy && setPromoteAdminTarget(null)}
            accessibilityLabel="Fechar"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Tornar administrador?</Text>
              <Text style={styles.modalBody}>
                {promoteAdminTarget?.name} passará a ter papel de administrador nesta igreja: todas as
                turmas, pedidos e usuários. Se for aluno, será desvinculado da turma como estudante.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtnGhost, promoteAdminBusy && styles.btnMuted]}
                  disabled={promoteAdminBusy}
                  onPress={() => setPromoteAdminTarget(null)}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnPrimary, promoteAdminBusy && styles.btnMuted]}
                  disabled={promoteAdminBusy}
                  onPress={() => void submitPromoteToAdmin()}>
                  {promoteAdminBusy ? (
                    <ActivityIndicator color={AppTheme.onAccent} />
                  ) : (
                    <Text style={styles.modalBtnPrimaryText}>Confirmar</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={removeStu !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !removeBusy && setRemoveStu(null)}>
        <View style={[styles.modalRoot, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !removeBusy && setRemoveStu(null)}
            accessibilityLabel="Fechar"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Remover aluno da turma?</Text>
              <Text style={styles.modalBody}>
                {removeStu?.name} deixará de ver esta sala. O histórico de presenças já registrado
                permanece no banco.
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtnGhost, removeBusy && styles.btnMuted]}
                  disabled={removeBusy}
                  onPress={() => setRemoveStu(null)}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnDanger, removeBusy && styles.btnMuted]}
                  disabled={removeBusy}
                  onPress={() => void submitRemoveStudent()}>
                  {removeBusy ? (
                    <ActivityIndicator color={AppTheme.text} />
                  ) : (
                    <Text style={styles.modalBtnDangerText}>Remover</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>

      <Modal
        visible={removeTea !== null}
        transparent
        animationType="fade"
        onRequestClose={() => !removeBusy && setRemoveTea(null)}>
        <View style={[styles.modalRoot, { paddingBottom: Math.max(insets.bottom, 20) }]}>
          <Pressable
            style={styles.modalBackdrop}
            onPress={() => !removeBusy && setRemoveTea(null)}
            accessibilityLabel="Fechar"
          />
          <View style={styles.modalCenter} pointerEvents="box-none">
            <View style={styles.modalCard}>
              <Text style={styles.modalTitle}>Remover professor da turma?</Text>
              <Text style={styles.modalBody}>
                {removeTea?.isPrimary && teachers.length > 1
                  ? 'Este é o titular. Outro professor da lista será definido como titular automaticamente.'
                  : removeTea?.isPrimary
                    ? 'É o único professor: adicione outro antes de remover, ou exclua a turma.'
                    : 'Este professor perderá acesso a esta sala.'}
              </Text>
              <View style={styles.modalActions}>
                <Pressable
                  style={[styles.modalBtnGhost, removeBusy && styles.btnMuted]}
                  disabled={removeBusy}
                  onPress={() => setRemoveTea(null)}>
                  <Text style={styles.modalBtnGhostText}>Cancelar</Text>
                </Pressable>
                <Pressable
                  style={[styles.modalBtnDanger, removeBusy && styles.btnMuted]}
                  disabled={removeBusy || (!!removeTea?.isPrimary && teachers.length <= 1)}
                  onPress={() => void submitRemoveTeacher()}>
                  {removeBusy ? (
                    <ActivityIndicator color={AppTheme.text} />
                  ) : (
                    <Text style={styles.modalBtnDangerText}>Remover</Text>
                  )}
                </Pressable>
              </View>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: BG, paddingHorizontal: 16 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: BG },
  denied: { color: MUTED, padding: 24, textAlign: 'center' },
  feedbackBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 12,
  },
  feedbackOk: { backgroundColor: SUCCESS_BG, borderColor: SUCCESS_BORDER },
  feedbackErr: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  feedbackIconCircle: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  feedbackIconOk: { backgroundColor: 'rgba(89, 244, 168, 0.2)' },
  feedbackIconBad: { backgroundColor: 'rgba(248, 113, 113, 0.2)' },
  feedbackIconGlyph: { fontSize: 15, fontWeight: '900', color: '#F8FAFC' },
  feedbackText: { flex: 1, color: '#E2E8F0', fontSize: 14, lineHeight: 20, fontWeight: '600' },
  feedbackDismiss: { color: ACCENT, fontWeight: '800', fontSize: 13 },
  err: { color: '#FB7185', marginBottom: 8 },
  adminBar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 12,
  },
  adminBarBtn: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: AppTheme.inputBg,
    borderWidth: 1,
    borderColor: BORDER,
  },
  adminBarBtnText: { color: ACCENT, fontWeight: '800', fontSize: 13 },
  adminBarBtnDanger: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: DANGER,
  },
  adminBarBtnDangerText: { color: DANGER, fontWeight: '800', fontSize: 13 },
  adminBarBtnAccent: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(167, 139, 250, 0.18)',
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.45)',
  },
  adminBarBtnAccentText: { color: '#C4B5FD', fontWeight: '800', fontSize: 13 },
  intro: { color: MUTED, fontSize: 13, lineHeight: 20, marginBottom: 14 },
  listContent: { paddingBottom: 40 },
  sectionHeader: { marginBottom: 8, marginTop: 8 },
  sectionTitle: { color: ACCENT, fontWeight: '900', fontSize: 13, letterSpacing: 0.4 },
  sectionEmpty: { color: MUTED, fontSize: 13, lineHeight: 19, marginTop: 6 },
  requestCard: {
    backgroundColor: CARD,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    paddingVertical: 14,
    paddingHorizontal: 16,
    marginBottom: 10,
  },
  requestKindRow: { marginBottom: 8 },
  requestKindPill: {
    alignSelf: 'flex-start',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.4,
    color: ACCENT,
    textTransform: 'uppercase',
  },
  requestName: {
    color: AppTheme.text,
    fontWeight: '800',
    fontSize: 17,
    marginBottom: 4,
  },
  requestEmail: {
    color: MUTED,
    fontSize: 14,
    lineHeight: 20,
    marginBottom: 8,
  },
  requestWhen: {
    color: MUTED,
    fontSize: 13,
    marginBottom: 14,
  },
  requestActions: { flexDirection: 'row', gap: 10 },
  requestRejectBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  requestRejectText: { color: DANGER, fontWeight: '800', fontSize: 15 },
  requestApproveBtn: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  requestApproveText: { color: AppTheme.onAccent, fontWeight: '900', fontSize: 15 },
  cardMuted: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 8,
  },
  teacherCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 10,
    backgroundColor: CARD,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 8,
  },
  teacherTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flexWrap: 'wrap',
  },
  titularPill: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.35)',
  },
  titularPillText: { color: '#7DD3FC', fontSize: 11, fontWeight: '800' },
  adminPill: {
    backgroundColor: 'rgba(167, 139, 250, 0.2)',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(167, 139, 250, 0.4)',
  },
  adminPillText: { color: '#C4B5FD', fontSize: 11, fontWeight: '800' },
  teacherActions: { alignItems: 'flex-end', gap: 4 },
  rowSecondaryBtn: { paddingVertical: 6, paddingHorizontal: 8 },
  rowSecondaryText: { color: ACCENT, fontWeight: '800', fontSize: 13 },
  rowRemoveBtn: { paddingVertical: 8, paddingHorizontal: 10 },
  rowRemoveText: { color: DANGER, fontWeight: '800', fontSize: 14 },
  btnDisabled: { opacity: 0.55 },
  btnMuted: { opacity: 0.65 },
  cardLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12, minWidth: 0 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: AppTheme.surfaceMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: ACCENT, fontWeight: '900', fontSize: 14 },
  cardBody: { flex: 1, minWidth: 0 },
  enrolledName: { color: AppTheme.text, fontWeight: '800', fontSize: 16 },
  enrolledEmail: { color: MUTED, fontSize: 13, marginTop: 4 },

  renameInput: {
    backgroundColor: AppTheme.inputBg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: BORDER,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: AppTheme.text,
    marginBottom: 4,
  },
  pickerModalRoot: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: AppTheme.overlay,
  },
  pickerSheet: {
    backgroundColor: AppTheme.modalSurface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 16,
    paddingTop: 16,
    maxHeight: '85%',
    borderWidth: 1,
    borderColor: BORDER,
  },
  pickerTitle: {
    color: AppTheme.text,
    fontSize: 18,
    fontWeight: '900',
    marginBottom: 6,
  },
  pickerHint: { color: MUTED, fontSize: 13, lineHeight: 18, marginBottom: 12 },
  pickerList: { maxHeight: 360 },
  pickerRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: BORDER,
  },
  pickerRowTop: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  pickerRowName: { color: AppTheme.text, fontWeight: '800', fontSize: 16, flex: 1, minWidth: 0 },
  pickerRolePill: {
    fontSize: 11,
    fontWeight: '800',
    color: ACCENT,
    textTransform: 'uppercase',
  },
  pickerRowEmail: { color: MUTED, fontSize: 13, marginTop: 4 },
  pickerClose: {
    alignItems: 'center',
    paddingVertical: 16,
    marginTop: 4,
  },
  pickerCloseText: { color: ACCENT, fontWeight: '800', fontSize: 16 },

  modalRoot: { flex: 1, justifyContent: 'center' },
  modalBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: AppTheme.overlay },
  modalCenter: { flex: 1, justifyContent: 'center', paddingHorizontal: 22 },
  modalCard: {
    backgroundColor: AppTheme.modalSurface,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.18)',
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 20,
    shadowColor: '#000',
    shadowOpacity: 0.45,
    shadowRadius: 28,
    shadowOffset: { width: 0, height: 16 },
    elevation: 12,
  },
  modalAccentBar: {
    alignSelf: 'center',
    width: 44,
    height: 4,
    borderRadius: 4,
    marginBottom: 18,
    opacity: 0.9,
  },
  modalBarOk: { backgroundColor: ACCENT },
  modalBarDanger: { backgroundColor: DANGER },
  modalIconWrap: {
    alignSelf: 'center',
    width: 56,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  modalIconWrapOk: {
    backgroundColor: 'rgba(89, 244, 168, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(89, 244, 168, 0.25)',
  },
  modalIconWrapDanger: {
    backgroundColor: 'rgba(248, 113, 113, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
  },
  modalIconEmoji: { fontSize: 26, fontWeight: '800', color: ACCENT },
  modalIconEmojiDanger: { color: DANGER },
  modalTitle: {
    color: '#F8FAFC',
    fontSize: 20,
    fontWeight: '900',
    textAlign: 'center',
    marginBottom: 16,
    letterSpacing: -0.3,
  },
  modalStudentBox: {
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    padding: 14,
    marginBottom: 14,
  },
  modalStudentLabel: {
    color: ACCENT,
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.9,
    marginBottom: 6,
  },
  modalStudentName: { color: '#F8FAFC', fontSize: 17, fontWeight: '800' },
  modalStudentEmail: { color: MUTED, fontSize: 13, marginTop: 6, lineHeight: 18 },
  modalBody: {
    color: '#94A3B8',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 16,
  },
  modalErrorBox: {
    backgroundColor: 'rgba(248, 113, 113, 0.1)',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(248, 113, 113, 0.35)',
    padding: 12,
    marginBottom: 14,
  },
  modalErrorText: { color: '#FCA5A5', fontSize: 13, lineHeight: 19, textAlign: 'center', fontWeight: '600' },
  modalActions: { flexDirection: 'row', gap: 12, marginTop: 4 },
  modalBtnGhost: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: BORDER,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  modalBtnGhostText: { color: '#E2E8F0', fontWeight: '800', fontSize: 15 },
  modalBtnPrimary: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: ACCENT,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalBtnPrimaryText: { color: AppTheme.onAccent, fontWeight: '900', fontSize: 15 },
  modalBtnDanger: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: DANGER,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  modalBtnDangerText: { color: AppTheme.text, fontWeight: '900', fontSize: 15 },
});
