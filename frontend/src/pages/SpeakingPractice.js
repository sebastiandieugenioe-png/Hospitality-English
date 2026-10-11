import { Mic } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { getSpeakingMeta, getSpeakingPractice } from "@/lib/api";
import { PracticeSessionPage } from "@/components/focus/PracticeSessionPage";
import { SpeakingExercise } from "@/components/focus/PracticeExercises";

export default function SpeakingPractice() {
  const { t } = useApp();
  return (
    <PracticeSessionPage
      kind="sp"
      getMeta={getSpeakingMeta}
      getPool={getSpeakingPractice}
      Exercise={SpeakingExercise}
      icon={Mic}
      introTitle={() => t("home.speaking")}
      introSub={t("practiceSession.speakingIntro")}
      introMeta={(n) => t("practice.speakingCount", { n })}
      introNotes={[t("practiceSession.speakNaturally"), t("practiceSession.privacyNote")]}
      completionTitle={t("practiceSession.speakingComplete")}
      completionStat={({ answered }) => (answered === 1 ? t("practiceSession.practicedOne") : t("practiceSession.practicedOther", { n: answered }))}
      isSuccess={(r) => r.overall === "strong"}
    />
  );
}
