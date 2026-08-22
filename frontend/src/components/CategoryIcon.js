import {
  Sparkles,
  Utensils,
  Wine,
  BedDouble,
  Coffee,
  ChefHat,
  Brush,
  GraduationCap,
} from "lucide-react";

const map = {
  sparkles: Sparkles,
  utensils: Utensils,
  wine: Wine,
  "bed-double": BedDouble,
  coffee: Coffee,
  "chef-hat": ChefHat,
  brush: Brush,
};

export function CategoryIcon({ name, className }) {
  const Icon = map[name] || GraduationCap;
  return <Icon className={className} strokeWidth={1.5} />;
}

export default CategoryIcon;
