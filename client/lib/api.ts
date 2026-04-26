import axios from "axios";
import { useAuthStore } from "@/stores/authStore";

const api = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || "http://localhost:4000",
  withCredentials: true,
});

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const original = error.config;
    if (error.response?.status === 401 && original && !original._retry) {
      original._retry = true;
      await useAuthStore.getState().refreshToken();
      const token = useAuthStore.getState().accessToken;
      original.headers.Authorization = `Bearer ${token}`;
      return api(original);
    }
    return Promise.reject(error);
  }
);

export const authAPI = {
  register: (data: { name: string; email: string; password: string }) =>
    api.post("/api/auth/register", data),
  login: (data: { email: string; password: string }) => api.post("/api/auth/login", data),
  logout: () => api.post("/api/auth/logout"),
  me: () => api.get("/api/auth/me"),
  refresh: () => api.post("/api/auth/refresh"),
};

export const ingestAPI = {
  create: (data: FormData | Record<string, unknown>) =>
    api.post("/api/ingest", data, {
      headers: data instanceof FormData ? { "Content-Type": "multipart/form-data" } : {},
    }),
};

export const analyzeAPI = {
  start: (documentId: string) => api.post("/api/analyze", { documentId }),
  getOne: (id: string) => api.get(`/api/analyses/${id}`),
  getAll: (params?: Record<string, unknown>) => api.get("/api/analyses", { params }),
  delete: (id: string) => api.delete(`/api/analyses/${id}`),
};

export const documentAPI = {
  getAll: (params?: Record<string, unknown>) => api.get("/api/documents", { params }),
  getOne: (id: string) => api.get(`/api/documents/${id}`),
  delete: (id: string) => api.delete(`/api/documents/${id}`),
  status: (id: string) => api.get(`/api/documents/${id}/status`),
};

export const statsAPI = {
  get: () => api.get("/api/stats"),
};

export const adminAPI = {
  requeue: (jobId: string) => api.post(`/api/admin/requeue/${jobId}`),
};

export default api;
