// Generic app navigation shared by the authenticated root screens.
// Mobile: fixed bottom tab bar. Desktop: top-level horizontal nav.
// Information architecture (same on all breakpoints): Home / Learn / Practice / Progress / More.
import { NavLink } from "react-router-dom";
import { Home, GraduationCap, Dumbbell, BarChart3, Menu } from "lucide-react";
import { useApp } from "@/context/AppContext";

export const ROOT_TABS = [
  { to: "/home", key: "nav.home", icon: Home, testid: "tab-home" },
  { to: "/learn", key: "nav.learn", icon: GraduationCap, testid: "tab-learn" },
  { to: "/practice", key: "nav.practice", icon: Dumbbell, testid: "tab-practice" },
  { to: "/progress", key: "nav.progress", icon: BarChart3, testid: "tab-progress" },
  { to: "/more", key: "nav.more", icon: Menu, testid: "tab-more" },
];

export function BottomNavigation() {
  const { t } = useApp();
  return (
    <nav
      data-testid="bottom-navigation"
      aria-label="Primary"
      className="md:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-[#DEE2DE] pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="flex items-stretch justify-around">
        {ROOT_TABS.map(({ to, key, icon: Icon, testid }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              data-testid={testid}
              aria-label={t(key)}
              className={({ isActive }) =>
                `relative flex flex-col items-center justify-center gap-1 min-h-[56px] px-1 pt-2 pb-1 transition-colors ${
                  isActive ? "text-[#173D31]" : "text-[#6B736E]"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    aria-hidden="true"
                    className={`absolute top-0 h-0.5 w-8 rounded-full transition-opacity ${
                      isActive ? "bg-[#173D31] opacity-100" : "opacity-0"
                    }`}
                  />
                  <Icon className="w-5 h-5" strokeWidth={isActive ? 2.25 : 1.75} aria-hidden="true" />
                  <span className={`text-[11px] leading-none ${isActive ? "font-semibold" : "font-medium"}`}>
                    {t(key)}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}

export function DesktopNavigation() {
  const { t } = useApp();
  return (
    <nav data-testid="desktop-navigation" aria-label="Primary" className="hidden md:flex items-center gap-1">
      {ROOT_TABS.map(({ to, key, icon: Icon, testid }) => (
        <NavLink
          key={to}
          to={to}
          data-testid={`${testid}-desktop`}
          className={({ isActive }) =>
            `inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors ${
              isActive ? "bg-[#EEF3EF] text-[#173D31] font-semibold" : "text-[#6B736E] hover:text-[#173D31]"
            }`
          }
        >
          <Icon className="w-4 h-4" strokeWidth={1.75} aria-hidden="true" />
          {t(key)}
        </NavLink>
      ))}
    </nav>
  );
}

export default BottomNavigation;
