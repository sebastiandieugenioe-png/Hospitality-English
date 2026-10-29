import "@/App.css";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/context/AppContext";
import { BillingProvider } from "@/context/BillingContext";
import { PremiumProvider } from "@/components/PremiumGate";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import Learn from "@/pages/Learn";
import Skill from "@/pages/Skill";
import Progress from "@/pages/Progress";
import Practice from "@/pages/Practice";
import Lesson from "@/pages/Lesson";
import Assessment from "@/pages/Assessment";
import EmergencyPhrases from "@/pages/EmergencyPhrases";
import TonightsShift from "@/pages/TonightsShift";
import JobInterview from "@/pages/JobInterview";
import FirstWeek from "@/pages/FirstWeek";
import ListeningPractice from "@/pages/ListeningPractice";
import SpeakingPractice from "@/pages/SpeakingPractice";
import Account from "@/pages/Account";
import More from "@/pages/More";
import Profile from "@/pages/Profile";
import LearningPreferences from "@/pages/LearningPreferences";
import Language from "@/pages/Language";
import Subscription from "@/pages/Subscription";
import Legal from "@/pages/Legal";
import { Support, Feedback } from "@/pages/Support";

function App() {
  return (
    <div className="App">
      <AppProvider>
        <BillingProvider>
        <PremiumProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/skill/:slug" element={<Skill />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/practice" element={<Practice />} />
            {/* Retired legacy category page: old saved URLs land on the current Learn experience. */}
            <Route path="/category/:slug" element={<Navigate to="/learn" replace />} />
            <Route path="/category" element={<Navigate to="/learn" replace />} />
            <Route path="/lesson/:slug" element={<Lesson />} />
            <Route path="/assessment" element={<Assessment />} />
            <Route path="/emergency" element={<EmergencyPhrases />} />
            <Route path="/tonights-shift" element={<TonightsShift />} />
            <Route path="/job-interview" element={<JobInterview />} />
            <Route path="/first-week" element={<FirstWeek />} />
            <Route path="/listening-practice" element={<ListeningPractice />} />
            <Route path="/speaking-practice" element={<SpeakingPractice />} />
            <Route path="/account" element={<Account />} />
            <Route path="/more" element={<More />} />
            <Route path="/profile" element={<Profile />} />
            <Route path="/learning-preferences" element={<LearningPreferences />} />
            <Route path="/language" element={<Language />} />
            <Route path="/subscription" element={<Subscription />} />
            <Route path="/support" element={<Support />} />
            <Route path="/support/feedback" element={<Feedback />} />
            <Route path="/privacy" element={<Legal />} />
            <Route path="/terms" element={<Legal />} />
            <Route path="/account-deletion" element={<Legal />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
        </PremiumProvider>
        </BillingProvider>
      </AppProvider>
    </div>
  );
}

export default App;
