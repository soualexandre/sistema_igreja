import { AttendancePageClient } from "./attendance-client";

export default async function AttendancePage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <AttendancePageClient classId={classId} />;
}
