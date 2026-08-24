import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function Navbar() {
  const { onboardingCompleted } = useApp();
  const navigate = useNavigate();

  return (
    <header
      data-testid="app-navbar"
      className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5"
    >
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link
          to={onboardingCompleted ? "/home" : "/"}
          data-testid="navbar-logo"
          className="flex items-center gap-2 group"
        >
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-forest text-white">
            <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-lg text-brand-espresso tracking-tight hidden sm:block">
            Inglés para Hostelería
          </span>
        </Link>
        <div className="flex items-center gap-5">
          {onboardingCompleted && (
            <>
              <Link
                to="/home"
                data-testid="navbar-home-link"
                className="text-sm font-medium text-brand-charcoal/70 hover:text-brand-forest transition-colors"
              >
                Inicio
              </Link>
              <Link
                to="/learn"
                data-testid="navbar-learn-link"
                className="text-sm font-medium text-brand-forest hover:text-brand-forest-hover transition-colors"
              >
                Aprender
              </Link>
            </>
          )}
          {!onboardingCompleted && (
            <button
              data-testid="navbar-cta"
              onClick={() => navigate("/onboarding")}
              className="text-sm font-medium text-brand-forest hover:text-brand-forest-hover transition-colors"
            >
              Empezar gratis
            </button>
          )}
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
