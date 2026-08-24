import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const getCategories = () => client.get("/categories").then((r) => r.data);
export const getCategory = (slug) => client.get(`/categories/${slug}`).then((r) => r.data);
export const getLesson = (situationSlug) => client.get(`/lessons/${situationSlug}`).then((r) => r.data);

// Taxonomy / reference data (backend is the single source of truth).
export const getProfessionalProfiles = () => client.get("/professional-profiles").then((r) => r.data);
export const getVenueTypes = () => client.get("/venue-types").then((r) => r.data);
export const getTargetCountries = () => client.get("/target-countries").then((r) => r.data);
export const getLearningGoals = () => client.get("/learning-goals").then((r) => r.data);

export const createGuest = (payload = {}) => client.post("/guests", payload).then((r) => r.data);
export const getGuest = (id) => client.get(`/guests/${id}`).then((r) => r.data);
export const updateOnboarding = (id, payload) => client.put(`/guests/${id}/onboarding`, payload).then((r) => r.data);
export const updateProfile = (id, payload) => client.put(`/guests/${id}/profile`, payload).then((r) => r.data);
export const recordFlashcard = (id, payload) => client.post(`/guests/${id}/flashcard`, payload).then((r) => r.data);
export const recordCompletion = (id, payload) => client.post(`/guests/${id}/complete`, payload).then((r) => r.data);

export default client;
