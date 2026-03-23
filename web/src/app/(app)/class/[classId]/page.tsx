import { ClassDashboardClient } from "./class-dashboard-client";

export default async function ClassPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <ClassDashboardClient classId={classId} />;
}
