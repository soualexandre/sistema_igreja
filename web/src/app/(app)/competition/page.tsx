"use client";

import Link from "next/link";
import { QuizShareLinkPanel } from "@/components/competition/quiz-share-link-panel";
import { TeacherCompetitionsWeb } from "@/components/competition/teacher-competitions-web";
import { Button } from "@/components/ui/button";
import { useAuthStore } from "@/stores/auth-store";

export default function CompetitionPage() {
  const { token, user } = useAuthStore();

  if (!user || !token) {
    return null;
  }

  if (user.role === "student") {
    return (
      <div className="px-4 py-8 md:px-0">
        <h1 className="text-2xl font-black text-text">Competição</h1>
        <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted">
          Na web, o quiz em tempo real é independente do cadastro: use só o PIN que o
          professor passar e o seu nome. No app mobile, alunos logados continuam
          podendo entrar com a conta vinculada à turma.
        </p>
        <QuizShareLinkPanel className="mt-6 max-w-xl" />
        <Button className="mt-4" asChild>
          <Link href="/quiz">Abrir quiz (convidado — sem login)</Link>
        </Button>
        <p className="mt-6 text-xs text-muted">
          Professor ou admin: use a área logada para criar competições e gerar o PIN.
        </p>
      </div>
    );
  }

  return <TeacherCompetitionsWeb token={token} />;
}
