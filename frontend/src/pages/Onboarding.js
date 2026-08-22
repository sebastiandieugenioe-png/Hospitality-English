import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowRight, ArrowLeft, Check } from "lucide-react";
import Navbar from "@/components/Navbar";
import { workplaceOptions, goalOptions } from "@/lib/content";
import { useApp } from "@/context/AppContext";

export default function Onboarding() {
  const navigate = useNavigate();
  const { completeOnboarding } = useApp();
  const [step, setStep] = useState(1);
  const [workplace, setWorkplace] = useState(null);
  const [goal, setGoal] = useState(null);
  const [saving, setSaving] = useState(false);

  const finish = async () => {
    setSaving(true);
    await completeOnboarding({ workplace, goal });
    navigate("/home");
  };

  return (
    <div className="min-h-screen bg-brand-sand flex flex-col">
      <Navbar />
      <div className="flex-1 flex flex-col max-w-xl w-full mx-auto px-5 sm:px-8 py-10 sm:py-16">
        {/* progress */}
        <div className="flex items-center gap-2 mb-10">
          <div className="h-1 flex-1 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full bg-brand-forest transition-all duration-300"
              style={{ width: step === 1 ? "50%" : "100%" }}
            />
          </div>
          <span className="text-xs text-brand-charcoal/50 tabular-nums">{step}/2</span>
        </div>

        <AnimatePresence mode="wait">
          {step === 1 && (
            <motion.div
              key="q1"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
                ¿Dónde trabajas o dónde quieres trabajar?
              </h1>
              <div className="mt-8 grid gap-3" data-testid="onboarding-workplace-options">
                {workplaceOptions.map((opt) => (
                  <button
                    key={opt.id}
                    data-testid={`workplace-option-${opt.id}`}
                    onClick={() => setWorkplace(opt.id)}
                    className={`flex items-center justify-between w-full text-left rounded-xl border px-5 py-4 transition-all ${
                      workplace === opt.id
                        ? "border-brand-forest bg-brand-success-muted"
                        : "border-black/5 bg-white hover:border-brand-forest/30"
                    }`}
                  >
                    <span className="text-base text-brand-charcoal">{opt.label}</span>
                    {workplace === opt.id && (
                      <Check className="w-5 h-5 text-brand-forest" />
                    )}
                  </button>
                ))}
              </div>
              <button
                data-testid="onboarding-next-btn"
                disabled={!workplace}
                onClick={() => setStep(2)}
                className="mt-8 inline-flex items-center justify-center gap-2 w-full bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
              >
                Continuar <ArrowRight className="w-4 h-4" />
              </button>
            </motion.div>
          )}

          {step === 2 && (
            <motion.div
              key="q2"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
            >
              <h1 className="text-3xl sm:text-4xl font-serif text-brand-espresso tracking-tight">
                ¿Qué quieres mejorar?
              </h1>
              <div className="mt-8 grid gap-3" data-testid="onboarding-goal-options">
                {goalOptions.map((opt) => (
                  <button
                    key={opt.id}
                    data-testid={`goal-option-${opt.id}`}
                    onClick={() => setGoal(opt.id)}
                    className={`flex items-center justify-between w-full text-left rounded-xl border px-5 py-4 transition-all ${
                      goal === opt.id
                        ? "border-brand-forest bg-brand-success-muted"
                        : "border-black/5 bg-white hover:border-brand-forest/30"
                    }`}
                  >
                    <span className="text-base text-brand-charcoal">{opt.label}</span>
                    {goal === opt.id && <Check className="w-5 h-5 text-brand-forest" />}
                  </button>
                ))}
              </div>
              <div className="mt-8 flex gap-3">
                <button
                  data-testid="onboarding-back-btn"
                  onClick={() => setStep(1)}
                  className="inline-flex items-center justify-center gap-2 bg-white text-brand-forest border border-brand-forest/20 hover:bg-brand-sand transition-colors rounded-lg px-5 py-4 font-medium"
                >
                  <ArrowLeft className="w-4 h-4" />
                </button>
                <button
                  data-testid="onboarding-finish-btn"
                  disabled={!goal || saving}
                  onClick={finish}
                  className="flex-1 inline-flex items-center justify-center gap-2 bg-brand-forest text-white hover:bg-brand-forest-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors rounded-lg px-6 py-4 font-medium"
                >
                  {saving ? "Preparando..." : "Empezar a aprender"}
                  {!saving && <ArrowRight className="w-4 h-4" />}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
