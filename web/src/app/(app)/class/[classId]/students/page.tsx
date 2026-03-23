import { StudentsPageClient } from "./students-client";

export default async function StudentsPage({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return <StudentsPageClient classId={classId} />;
}
