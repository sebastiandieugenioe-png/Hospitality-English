// UI text and static presentation metadata (Spanish UI).
// Content itself (categories, lessons) comes from the backend.

export const FEATURED_SITUATION = "taking-an-order";
export const FEATURED_CATEGORY = "restaurant";

// Maps the professional role to a primary category for Home recommendations.
export const roleToCategory = { bartender: "bar", waiter: "restaurant" };

// Safe prefill of the role step from a legacy guest's old `workplace` selection.
export const legacyWorkplaceToRole = { bar: "bartender", restaurant: "waiter" };

// 4-step professional onboarding (questions + subtitles are UI copy in Spanish).
export const onboardingSteps = [
  {
    id: "role",
    field: "role",
    question: "¿Cuál es tu puesto?",
    subtitle: "Adaptaremos las situaciones y el vocabulario a tu trabajo.",
  },
  {
    id: "venue",
    field: "venue_type",
    question: "¿Dónde trabajas?",
    subtitle: "El inglés cambia según el tipo de servicio.",
  },
  {
    id: "country",
    field: "target_country",
    question: "¿Dónde quieres usar tu inglés?",
    subtitle: "Te enseñaremos vocabulario y expresiones habituales en ese país.",
  },
  {
    id: "goal",
    field: "goal",
    question: "¿Qué quieres conseguir?",
    subtitle: "Personalizaremos tu plan según tu objetivo.",
  },
];


export const workplaceOptions = [
  { id: "restaurant", label: "Restaurante" },
  { id: "bar", label: "Bar" },
  { id: "hotel", label: "Hotel / Recepción" },
  { id: "coffee", label: "Cafetería" },
  { id: "kitchen", label: "Cocina" },
  { id: "housekeeping", label: "Housekeeping" },
  { id: "other", label: "Otro" },
];

export const goalOptions = [
  { id: "serve", label: "Atender a clientes" },
  { id: "understand", label: "Entender mejor a los clientes" },
  { id: "vocabulary", label: "Vocabulario" },
  { id: "confidence", label: "Sentirme más seguro hablando inglés" },
  { id: "all", label: "Todo" },
];

// Ordered category recommendation based on the chosen workplace.
export const recommendationMap = {
  restaurant: ["restaurant", "general", "bar"],
  bar: ["bar", "general", "restaurant"],
  hotel: ["hotel", "general", "restaurant"],
  coffee: ["coffee", "general", "restaurant"],
  kitchen: ["kitchen", "general", "restaurant"],
  housekeeping: ["housekeeping", "hotel", "general"],
  other: ["general", "restaurant", "bar"],
};

export const targetProfiles = [
  "Camareros/as",
  "Bartenders",
  "Barbacks",
  "Personal de hotel",
  "Recepcionistas",
  "Housekeeping",
  "Personal de cocina",
  "Baristas",
  "Estudiantes de hostelería",
];

export const landingImages = {
  hero: "https://images.unsplash.com/photo-1573052905904-34ad8c27f0cc?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjAzMjh8MHwxfHNlYXJjaHwxfHxib3V0aXF1ZSUyMGhvdGVsJTIwaW50ZXJpb3J8ZW58MHx8fHwxNzg3NDI0NTEzfDA&ixlib=rb-4.1.0&q=85",
  coffee: "https://images.unsplash.com/photo-1532713107108-dfb5d8d2fc42?crop=entropy&cs=srgb&fm=jpg&ixid=M3w4NjA1MTN8MHwxfHNlYXJjaHwxfHxiYXJpc3RhJTIwcG91cmluZyUyMGNvZmZlZXxlbnwwfHx8fDE3ODc0MjQ1MTN8MA&ixlib=rb-4.1.0&q=85",
  restaurant: "https://images.pexels.com/photos/3769740/pexels-photo-3769740.jpeg?auto=compress&cs=tinysrgb&dpr=2&h=650&w=940",
};

export const situations = [
  "Welcoming a guest",
  "Taking an order",
  "Explaining the menu",
  "Handling allergies",
  "Recommending drinks",
  "Handling complaints",
  "Checking in a hotel guest",
  "Making coffee orders",
];
