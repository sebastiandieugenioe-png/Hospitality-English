import { Headphones } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getListeningMeta, getListeningPractice } from "@/lib/api";
import { PracticeSessionPage } from "@/components/focus/PracticeSessionPage";
import { ListeningExercise } from "@/components/focus/PracticeExercises";

export default function ListeningPractice() {
  const { t } = useApp();
  return (
    <PracticeSessionPage
      kind="lp"
      getMeta={getListeningMeta}
      getPool={getListeningPractice}
      Exercise={ListeningExercise}
      icon={Headphones}
      introTitle={() => t("home.listening")}
      introSub={t("practiceSession.listeningIntro")}
      introMeta={(n) => t("practiceSession.conversations", { n })}
      completionTitle={t("practiceSession.listeningComplete")}
      completionStat={({ success, total }) => t("lesson.quizCorrect", { n: success, total })}
      isSuccess={(r) => !!r.correct}
    />
  );
}
