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
import Category from "@/pages/Category";
import Lesson from "@/pages/Lesson";

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
            <Route path="/category/:slug" element={<Category />} />
            <Route path="/lesson/:slug" element={<Lesson />} />
          </Routes>
        </BrowserRouter>
        <Toaster position="top-center" />
      </AppProvider>
    </div>
  );
}

export default App;
