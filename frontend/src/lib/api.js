import axios from "axios";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
export const API = `${BACKEND_URL}/api`;

const client = axios.create({ baseURL: API });

export const getCategories = () => client.get("/categories").then((r) => r.data);
export const getCategory = (slug) => client.get(`/categories/${slug}`).then((r) => r.data);
export const getLesson = (situationSlug) => client.get(`/lessons/${situationSlug}`).then((r) => r.data);

export const createGuest = (payload) => client.post("/guests", payload).then((r) => r.data);
export const getGuest = (id) => client.get(`/guests/${id}`).then((r) => r.data);
export const updateOnboarding = (id, payload) => client.put(`/guests/${id}/onboarding`, payload).then((r) => r.data);
export const recordFlashcard = (id, payload) => client.post(`/guests/${id}/flashcard`, payload).then((r) => r.data);
export const recordCompletion = (id, payload) => client.post(`/guests/${id}/complete`, payload).then((r) => r.data);

export default client;
