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

// "Can I Work in English?" assessment
export const getAssessmentMeta = () => client.get("/assessment/meta").then((r) => r.data);
export const startAssessment = (guest_id) =>
  client.post("/assessment/start", { guest_id }).then((r) => r.data);
export const submitAssessmentResponse = (attemptId, payload) =>
  client.put(`/assessment-attempts/${attemptId}/response`, payload).then((r) => r.data);
export const completeAssessment = (attemptId) =>
  client.post(`/assessment-attempts/${attemptId}/complete`).then((r) => r.data);
export const getAssessmentSummary = (guestId) =>
  client.get(`/guests/${guestId}/assessment-summary`).then((r) => r.data);

// Emergency Phrases
export const getEmergency = () => client.get("/emergency").then((r) => r.data);
export const saveEmergencyPhrase = (guestId, phrase_id) =>
  client.post(`/guests/${guestId}/saved-phrases`, { phrase_id }).then((r) => r.data);
export const removeEmergencyPhrase = (guestId, phrase_id) =>
  client.delete(`/guests/${guestId}/saved-phrases/${phrase_id}`).then((r) => r.data);

// Tonight's Shift (daily 5-question practice)
export const getTonightsShiftMeta = () => client.get("/tonights-shift/meta").then((r) => r.data);
export const startTonightsShift = (guestId, local_date) =>
  client.post(`/guests/${guestId}/tonights-shift/start`, { local_date }).then((r) => r.data);
export const getTonightsShiftToday = (guestId, params) =>
  client.get(`/guests/${guestId}/tonights-shift`, { params }).then((r) => r.data);
export const submitShiftResponse = (sessionId, payload) =>
  client.put(`/shift-sessions/${sessionId}/response`, payload).then((r) => r.data);
export const completeTonightsShift = (sessionId) =>
  client.post(`/shift-sessions/${sessionId}/complete`).then((r) => r.data);

// Job Interview English
export const getJobInterviewMeta = () => client.get("/job-interview/meta").then((r) => r.data);
export const getJobInterview = (guestId) =>
  client.get(`/guests/${guestId}/job-interview`).then((r) => r.data);
export const openJobInterviewScenario = (guestId, scenario_id) =>
  client.put(`/guests/${guestId}/job-interview/open`, { scenario_id }).then((r) => r.data);
export const submitJobInterviewPractice = (guestId, payload) =>
  client.post(`/guests/${guestId}/job-interview/practice`, payload).then((r) => r.data);

// First Week at Work
export const getFirstWeekMeta = () => client.get("/first-week/meta").then((r) => r.data);
export const getFirstWeek = (guestId) =>
  client.get(`/guests/${guestId}/first-week`).then((r) => r.data);
export const openFirstWeekScenario = (guestId, scenario_id) =>
  client.put(`/guests/${guestId}/first-week/open`, { scenario_id }).then((r) => r.data);
export const submitFirstWeekPractice = (guestId, payload) =>
  client.post(`/guests/${guestId}/first-week/practice`, payload).then((r) => r.data);
// Listening MVP
export const getListeningMeta = () => client.get("/listening/meta").then((r) => r.data);
export const getListeningItem = (situationSlug, lang) =>
  client.get(`/listening/item/${situationSlug}`, { params: { lang } }).then((r) => r.data);
export const getListeningPractice = (guestId) =>
  client.get(`/guests/${guestId}/listening-practice`).then((r) => r.data);
export const submitListeningAttempt = (guestId, payload) =>
  client.post(`/guests/${guestId}/listening-attempts`, payload).then((r) => r.data);
export const getListeningSummary = (guestId) =>
  client.get(`/guests/${guestId}/listening-summary`).then((r) => r.data);

// Speaking MVP
export const getSpeakingMeta = () => client.get("/speaking/meta").then((r) => r.data);
export const getSpeakingItem = (situationSlug, lang) =>
  client.get(`/speaking/item/${situationSlug}`, { params: { lang } }).then((r) => r.data);
export const getSpeakingPractice = (guestId) =>
  client.get(`/guests/${guestId}/speaking-practice`).then((r) => r.data);
export const getSpeakingSummary = (guestId) =>
  client.get(`/guests/${guestId}/speaking-summary`).then((r) => r.data);
export const submitSpeakingAttempt = (guestId, { speaking_item_id, duration_ms, blob, filename }) => {
  const fd = new FormData();
  fd.append("speaking_item_id", speaking_item_id);
  fd.append("duration_ms", String(duration_ms || 0));
  fd.append("audio", blob, filename || "response.webm");
  return client
    .post(`/guests/${guestId}/speaking-attempts`, fd, { headers: { "Content-Type": "multipart/form-data" }, timeout: 90000 })
    .then((r) => r.data);
};

export const updateLanguage = (id, interface_language) =>
  client.put(`/guests/${id}/language`, { interface_language }).then((r) => r.data);
export const getLanguages = () => client.get("/languages").then((r) => r.data);
export const updateOnboarding = (id, payload) => client.put(`/guests/${id}/onboarding`, payload).then((r) => r.data);
export const updateProfile = (id, payload) => client.put(`/guests/${id}/profile`, payload).then((r) => r.data);
export const recordFlashcard = (id, payload) => client.post(`/guests/${id}/flashcard`, payload).then((r) => r.data);
export const recordCompletion = (id, payload) => client.post(`/guests/${id}/complete`, payload).then((r) => r.data);

export default client;
