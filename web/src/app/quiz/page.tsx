import type { Metadata } from "next";
import { QuizGuestClient } from "@/components/competition/quiz-guest-client";

export const metadata: Metadata = {
  title: "Quiz ao vivo (sem login) — EBD",
  description:
    "Participe do quiz em tempo real só com o PIN da sala e seu nome. Não precisa de conta.",
  openGraph: {
    title: "Quiz ao vivo — EBD",
    description: "Entre com PIN e nome, sem cadastro.",
  },
};

export default function QuizPublicPage() {
  return <QuizGuestClient />;
}
