// Generic authenticated app shell: simple root header + desktop top nav + mobile
// bottom nav. Reusable by EnglishToWork and future professions.
// Focus screens (lessons etc.) can hide navigation via showBottomNav={false}.
import { Link } from "react-router-dom";
import { GraduationCap } from "lucide-react";
import { BottomNavigation, DesktopNavigation } from "@/components/BottomNavigation";

export function AppHeader({ title }) {
  return (
    <header
      data-testid="app-header"
      className="sticky top-0 z-30 bg-[#F7F5F0]/90 backdrop-blur-xl border-b border-[#DEE2DE] pt-[env(safe-area-inset-top)]"
    >
      <div className="max-w-6xl mx-auto px-5 sm:px-8 h-16 flex items-center justify-between gap-4">
        <Link to="/home" data-testid="app-header-logo" className="flex items-center gap-2 shrink-0">
          <span className="grid place-items-center w-9 h-9 rounded-lg bg-[#173D31] text-white">
            <GraduationCap className="w-5 h-5" strokeWidth={1.75} />
          </span>
          {title ? (
            <span data-testid="app-header-title" className="font-serif text-xl text-[#222824] tracking-tight">
              {title}
            </span>
          ) : (
            <span className="font-serif text-lg text-[#222824] tracking-tight hidden sm:block">
              Hospitality English
            </span>
          )}
        </Link>
        <DesktopNavigation />
      </div>
    </header>
  );
}

export function AppShell({ title, showBottomNav = true, children }) {
  return (
    <div
      data-testid="app-shell"
      className={`min-h-screen bg-[#F7F5F0] ${showBottomNav ? "pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-0" : ""}`}
    >
      <AppHeader title={title} />
      {children}
      {showBottomNav && <BottomNavigation />}
    </div>
  );
}

export default AppShell;
