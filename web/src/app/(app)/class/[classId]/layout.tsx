import { ClassStackHeader } from "@/components/layout/class-stack-header";

export default async function ClassLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ classId: string }>;
}) {
  const { classId } = await params;
  return (
    <div className="min-h-screen bg-bg">
      <ClassStackHeader classId={classId} />
      <div className="mx-auto max-w-3xl md:max-w-6xl md:px-5 lg:px-8">
        {children}
      </div>
    </div>
  );
}
