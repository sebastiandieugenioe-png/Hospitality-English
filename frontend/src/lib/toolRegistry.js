// Profession-aware registry of secondary tools surfaced in More (official order).
import { ClipboardCheck, Moon, Briefcase, CalendarCheck, Siren } from "lucide-react";

export const TOOL_REGISTRY = {
  hospitality: [
    { id: "assessment", route: "/assessment", icon: ClipboardCheck },
    { id: "tonight_shift", route: "/tonights-shift", icon: Moon },
    { id: "job_interview", route: "/job-interview", icon: Briefcase },
    { id: "first_week", route: "/first-week", icon: CalendarCheck },
    { id: "emergency_phrases", route: "/emergency", icon: Siren },
  ],
};

export const toolsFor = (professionId) => TOOL_REGISTRY[professionId] || [];
