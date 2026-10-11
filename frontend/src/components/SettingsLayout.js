// Shared settings primitives: secondary page shell (← Title, no bottom nav), sections and rows.
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { useApp } from "@/context/AppContext";

export const focusRing = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#173D31]";
export const btnDark = `inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] font-semibold text-[16px] bg-[#173D31] text-white hover:bg-[#102E25] disabled:opacity-40 disabled:cursor-not-allowed transition-colors ${focusRing}`;
export const btnLight = `inline-flex items-center justify-center gap-2 min-h-[48px] px-6 rounded-[15px] font-semibold text-[16px] border border-[#DEE2DE] bg-white text-[#173D31] hover:bg-[#EEF3EF] disabled:opacity-40 transition-colors ${focusRing}`;

export function SecondaryPage({ title, testid, back = "/more", children }) {
  const navigate = useNavigate();
  const { t } = useApp();
  const goBack = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(back));
  return (
    <div className="min-h-screen bg-[#F7F5F0]" data-testid={testid}>
      <header className="sticky top-0 z-30 bg-[#F7F5F0]/90 backdrop-blur-xl border-b border-[#DEE2DE]">
        <div className="max-w-2xl mx-auto px-5 sm:px-8 h-16 flex items-center gap-2">
          <button type="button" onClick={goBack} data-testid="secondary-back-btn" aria-label={t("settings.back")}
            className={`grid place-items-center w-11 h-11 -ml-3 rounded-full text-[#222824] hover:bg-[#EEF3EF] transition-colors ${focusRing}`}>
            <ArrowLeft className="w-5 h-5" aria-hidden="true" />
          </button>
          <h1 data-testid="secondary-title" className="font-serif text-[21px] font-semibold text-[#222824] tracking-tight truncate">{title}</h1>
        </div>
      </header>
      <main className="max-w-2xl mx-auto px-5 sm:px-8 pt-6 pb-12 space-y-8">{children}</main>
    </div>
  );
}

export function Section({ title, id, children }) {
  return (
    <section aria-labelledby={id}>
      {title && <h2 id={id} className="text-xs uppercase tracking-[0.15em] font-semibold text-[#6B736E] mb-3 px-1">{title}</h2>}
      <ul className="rounded-2xl border border-[#DEE2DE] bg-white divide-y divide-[#DEE2DE] overflow-hidden">{children}</ul>
    </section>
  );
}

export function Row({ to, onClick, icon: Icon, label, sub, value, testid, trailing }) {
  const inner = (
    <>
      {Icon && (
        <span className="grid place-items-center w-10 h-10 rounded-xl bg-[#EEF3EF] text-[#173D31] shrink-0">
          <Icon className="w-5 h-5" strokeWidth={1.75} aria-hidden="true" />
        </span>
      )}
      <span className="flex-1 min-w-0">
        <span className="block text-[16px] text-[#222824] font-medium leading-snug">{label}</span>
        {sub && <span className="block text-[13px] text-[#6B736E] leading-snug">{sub}</span>}
      </span>
      {value && <span className="text-[14px] text-[#6B736E] shrink-0 max-w-[45%] truncate text-right">{value}</span>}
      {trailing !== undefined ? trailing : (to || onClick) && <ChevronRight className="w-5 h-5 text-[#6B736E] shrink-0" aria-hidden="true" />}
    </>
  );
  const cls = "w-full min-h-[60px] flex items-center gap-3.5 px-4 py-3 text-left";
  const interactive = `${cls} hover:bg-[#F7F5F0] transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[#173D31]`;
  return (
    <li>
      {to ? (
        <Link to={to} data-testid={testid} className={interactive}>{inner}</Link>
      ) : onClick ? (
        <button type="button" onClick={onClick} data-testid={testid} className={interactive}>{inner}</button>
      ) : (
        <div data-testid={testid} className={cls}>{inner}</div>
      )}
    </li>
  );
}
