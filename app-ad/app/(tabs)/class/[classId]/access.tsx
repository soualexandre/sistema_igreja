import { Redirect, useLocalSearchParams } from 'expo-router';

/** Rota antiga: pedidos foram unificados em `students`. */
export default function ClassAccessRedirectScreen() {
  const raw = useLocalSearchParams<{ classId: string }>().classId;
  const classId = Array.isArray(raw) ? raw[0] : raw;
  if (!classId) {
    return <Redirect href="/(tabs)" />;
  }
  return <Redirect href={`/class/${classId}/students`} />;
}
