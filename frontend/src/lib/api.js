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

// Skills & situations (role/skill/venue filtered).
export const getSkills = (params = {}) => client.get("/skills", { params }).then((r) => r.data);
export const getSituations = (params = {}) => client.get("/situations", { params }).then((r) => r.data);
export const getSituation = (slug) => client.get(`/situations/${slug}`).then((r) => r.data);

// Situation attempts + progress
export const startAttempt = (guest_id, situation_slug) =>
  client.post("/situation-attempts/start", { guest_id, situation_slug }).then((r) => r.data);
export const submitResponse = (attemptId, payload) =>
  client.put(`/situation-attempts/${attemptId}/response`, payload).then((r) => r.data);
export const completeAttempt = (attemptId) =>
  client.post(`/situation-attempts/${attemptId}/complete`).then((r) => r.data);
export const getAttempts = (guestId) => client.get(`/guests/${guestId}/attempts`).then((r) => r.data);
export const getSituationStats = (guestId) =>
  client.get(`/guests/${guestId}/situation-stats`).then((r) => r.data);
export const getRecommendedSituations = (guestId, params = {}) =>
  client.get(`/guests/${guestId}/recommended-situations`, { params }).then((r) => r.data);

// Spaced repetition / Mistake Bank
export const getReviewItems = (guestId, params = {}) =>
  client.get(`/guests/${guestId}/review-items`, { params }).then((r) => r.data);
export const getReviewSummary = (guestId) =>
  client.get(`/guests/${guestId}/review-summary`).then((r) => r.data);
export const answerReviewItem = (itemId, submitted_answer) =>
  client.post(`/review-items/${itemId}/answer`, { submitted_answer }).then((r) => r.data);
export const rateReviewItem = (itemId, rating) =>
  client.post(`/review-items/${itemId}/rate`, { rating }).then((r) => r.data);

export const createGuest = (payload = {}) => client.post("/guests", payload).then((r) => r.data);
export const getGuest = (id) => client.get(`/guests/${id}`).then((r) => r.data);
export const updateLanguage = (id, interface_language) =>
  client.put(`/guests/${id}/language`, { interface_language }).then((r) => r.data);
export const getLanguages = () => client.get("/languages").then((r) => r.data);
export const updateOnboarding = (id, payload) => client.put(`/guests/${id}/onboarding`, payload).then((r) => r.data);
export const updateProfile = (id, payload) => client.put(`/guests/${id}/profile`, payload).then((r) => r.data);
export const recordFlashcard = (id, payload) => client.post(`/guests/${id}/flashcard`, payload).then((r) => r.data);
export const recordCompletion = (id, payload) => client.post(`/guests/${id}/complete`, payload).then((r) => r.data);

export default client;
