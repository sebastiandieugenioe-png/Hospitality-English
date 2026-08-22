import { Link, useNavigate } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { useApp } from "@/context/AppContext";

export function Navbar() {
  const { hasOnboarded } = useApp();
  const navigate = useNavigate();

  return (
    <header
      data-testid="app-navbar"
      className="sticky top-0 z-40 backdrop-blur-xl bg-brand-sand/80 border-b border-black/5"
    >
      <nav className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between">
        <Link
          to={hasOnboarded ? "/home" : "/"}
          data-testid="navbar-logo"
          className="flex items-center gap-2 group"
        >
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-brand-forest text-white">
            <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
          </span>
          <span className="font-serif text-lg text-brand-espresso tracking-tight">
            Inglés para Hostelería
          </span>
        </Link>
        <button
          data-testid="navbar-cta"
          onClick={() => navigate(hasOnboarded ? "/home" : "/onboarding")}
          className="text-sm font-medium text-brand-forest hover:text-brand-forest-hover transition-colors"
        >
          {hasOnboarded ? "Mi aprendizaje" : "Empezar gratis"}
        </button>
      </nav>
    </header>
  );
}

export default Navbar;
