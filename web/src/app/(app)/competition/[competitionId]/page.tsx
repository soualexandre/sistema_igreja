import { CompetitionDetailWeb } from "@/components/competition/competition-detail-web";

export default async function CompetitionDetailPage({
  params,
}: {
  params: Promise<{ competitionId: string }>;
}) {
  const { competitionId } = await params;
  return (
    <CompetitionDetailWeb competitionId={competitionId} initialName="Competição" />
  );
}
