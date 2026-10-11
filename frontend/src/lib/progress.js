// Shared, profession-aware progress helpers (single source of truth for Learn + Progress).
import { canAccessSituation } from "@/lib/accessConfig";

const PRACTICED_STATUSES = new Set(["completed", "mastered"]);

// practiced | in_progress | not_started, derived from /situation-stats.
export function situationStatus(stats, slug) {
  const s = stats?.[slug]?.status;
  if (PRACTICED_STATUSES.has(s)) return "practiced";
  return s === "in_progress" ? "in_progress" : "not_started";
}

export const isPracticed = (stats, slug) => situationStatus(stats, slug) === "practiced";

export const countPracticed = (situations, stats) =>
  (situations || []).filter((s) => isPracticed(stats, s.slug)).length;

export const hasAnyActivity = (situations, stats) =>
  (situations || []).some((s) => situationStatus(stats, s.slug) !== "not_started");

// Each situation counted once, under its primary_skill, ordered by skill order.
export function groupBySkill(situations, skills) {
  const order = Object.fromEntries((skills || []).map((s) => [s.id, s.order ?? 999]));
  const map = {};
  (situations || []).forEach((s) => { (map[s.primary_skill] = map[s.primary_skill] || []).push(s); });
  return Object.entries(map).sort(([a], [b]) => (order[a] ?? 999) - (order[b] ?? 999));
}

// Free-tier progress for a profession/role (what is reachable without Premium).
export function freeProgress(situations, stats, { professionId, role }) {
  const free = (situations || []).filter((s) =>
    canAccessSituation({ professionId, role, situationSlug: s.slug, isPremium: false }));
  const practiced = countPracticed(free, stats);
  return { total: free.length, practiced, allDone: free.length > 0 && practiced === free.length };
}
