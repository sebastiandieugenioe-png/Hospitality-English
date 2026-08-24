import { useState, useRef, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { GraduationCap, Globe, Check } from "lucide-react";
import { useApp } from "@/context/AppContext";
import { SUPPORTED_LANGUAGES } from "@/lib/i18n";

function LanguageSwitcher() {
  const { language, setLanguage, t } = useApp();
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const onClick = (e) => ref.current && !ref.current.contains(e.target) && setOpen(false);
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const current = SUPPORTED_LANGUAGES.find((l) => l.code === language) || SUPPORTED_LANGUAGES[0];

  return (
    <div className="relative" ref={ref}>
      <button
        data-testid="language-switcher-btn"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("nav.language")}
        className="flex items-center gap-1.5 text-sm font-medium text-brand-charcoal/70 hover:text-brand-forest transition-colors"
      >
        <Globe className="w-4 h-4" strokeWidth={1.75} />
        <span className="hidden sm:inline">{current.native_name}</span>
        <span className="sm:hidden">{current.flag}</span>
      </button>
      {open && (
        <div
          data-testid="language-menu"
          className="absolute right-0 mt-2 w-44 rounded-xl bg-white border border-black/5 shadow-lg overflow-hidden z-50"
        >
          {SUPPORTED_LANGUAGES.map((l) => (
            <button
              key={l.code}
              data-testid={`language-option-${l.code}`}
              onClick={() => {
                setLanguage(l.code);
                setOpen(false);
              }}
              className={`flex items-center gap-2 w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-brand-sand ${
                l.code === language ? "text-brand-forest font-medium" : "text-brand-charcoal/80"
              }`}
            >
              <span aria-hidden="true">{l.flag}</span>
              <span className="flex-1">{l.native_name}</span>
              {l.code === language && <Check className="w-4 h-4" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function Navbar() {
  const { onboardingCompleted, t } = useApp();
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
                {t("nav.home")}
              </Link>
              <Link
                to="/learn"
                data-testid="navbar-learn-link"
                className="text-sm font-medium text-brand-charcoal/70 hover:text-brand-forest transition-colors"
              >
                {t("nav.learn")}
              </Link>
              <Link
                to="/progress"
                data-testid="navbar-progress-link"
                className="text-sm font-medium text-brand-charcoal/70 hover:text-brand-forest transition-colors"
              >
                {t("nav.progress")}
              </Link>
              <Link
                to="/practice"
                data-testid="navbar-practice-link"
                className="text-sm font-medium text-brand-forest hover:text-brand-forest-hover transition-colors"
              >
                {t("nav.practice")}
              </Link>
            </>
          )}
          {!onboardingCompleted && (
            <button
              data-testid="navbar-cta"
              onClick={() => navigate("/onboarding")}
              className="text-sm font-medium text-brand-forest hover:text-brand-forest-hover transition-colors"
            >
              {t("nav.startFree")}
            </button>
          )}
          <LanguageSwitcher />
        </div>
      </nav>
    </header>
  );
}

export default Navbar;
