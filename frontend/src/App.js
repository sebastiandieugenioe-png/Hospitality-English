import "@/App.css";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider } from "@/context/AppContext";
import Landing from "@/pages/Landing";
import Onboarding from "@/pages/Onboarding";
import Home from "@/pages/Home";
import Learn from "@/pages/Learn";
import Skill from "@/pages/Skill";
import Progress from "@/pages/Progress";
import Practice from "@/pages/Practice";
import Category from "@/pages/Category";
import Lesson from "@/pages/Lesson";
import Assessment from "@/pages/Assessment";
import EmergencyPhrases from "@/pages/EmergencyPhrases";
import TonightsShift from "@/pages/TonightsShift";
import JobInterview from "@/pages/JobInterview";
import FirstWeek from "@/pages/FirstWeek";
import ListeningPractice from "@/pages/ListeningPractice";
import SpeakingPractice from "@/pages/SpeakingPractice";

function App() {
  return (
    <div className="App">
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/onboarding" element={<Onboarding />} />
            <Route path="/home" element={<Home />} />
            <Route path="/learn" element={<Learn />} />
            <Route path="/skill/:slug" element={<Skill />} />
            <Route path="/progress" element={<Progress />} />
            <Route path="/practice" element={<Practice />} />
            <Route path="/category/:slug" element={<Category />} />
            <Route path="/lesson/:slug" element={<Lesson />} />
            <Route path="/assessment" element={<Assessment />} />
            <Route path="/emergency" element={<EmergencyPhrases />} />
            <Route path="/tonights-shift" element={<TonightsShift />} />
            <Route path="/job-interview" element={<JobInterview />} />
            <Route path="/first-week" element={<FirstWeek />} />
            <Route path="/listening-practice" element={<ListeningPractice />} />
            <Route path="/speaking-practice" element={<SpeakingPractice />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </AppProvider>
    </div>
  );
}

export default App;
