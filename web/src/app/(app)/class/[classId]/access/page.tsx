import { redirect } from "next/navigation";

export default async function ClassAccessRedirect({
  params,
}: {
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  redirect(`/class/${classId}/students`);
}
