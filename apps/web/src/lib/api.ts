import axios from 'axios'
import { useAuthStore } from '../stores/auth.store.js'

export const api = axios.create({
  baseURL: import.meta.env['VITE_API_URL'] ?? 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' },
})

// Inject fresh token on every request
api.interceptors.request.use(async (config) => {
  try {
    const token = await useAuthStore.getState().getToken()
    if (token) config.headers['Authorization'] = `Bearer ${token}`
  } catch {
    // Not authenticated — let request proceed, server will 401
  }
  return config
})

// Handle 401 globally
api.interceptors.response.use(
  (r) => r,
  (err) => {
    if (err?.response?.status === 401) {
      useAuthStore.getState().login()
    }
    return Promise.reject(err)
  }
)

// ── Typed API calls ──────────────────────────────────────────────────────────

export const courseApi = {
  list:    (params?: Record<string, unknown>) => api.get('/api/v1/courses', { params }),
  get:     (id: string)   => api.get(`/api/v1/courses/${id}`),
  create:  (data: unknown) => api.post('/api/v1/courses', data),
  update:  (id: string, data: unknown) => api.patch(`/api/v1/courses/${id}`, data),
  delete:  (id: string)   => api.delete(`/api/v1/courses/${id}`),
  publish: (id: string)   => api.post(`/api/v1/courses/${id}/publish`),
}

export const enrollmentApi = {
  enroll:    (courseId: string) => api.post('/api/v1/enrollments', { courseId }),
  myEnrollments: ()             => api.get('/api/v1/enrollments/me'),
  progress:  (enrollmentId: string) => api.get(`/api/v1/enrollments/${enrollmentId}/progress`),
  completeLesson: (enrollmentId: string, lessonId: string) =>
    api.post(`/api/v1/enrollments/${enrollmentId}/lessons/${lessonId}/complete`),
}

export const aiCopilotApi = {
  generateQuiz: (data: unknown) =>
    api.post('/api/v1/ai-copilot/generate-quiz', data),
  enrichMedia: (data: unknown) =>
    api.post('/api/v1/ai-copilot/enrich-media', data),
}

export const integrationApi = {
  list:   () => api.get('/api/v1/integrations'),
  create: (data: unknown) => api.post('/api/v1/integrations', data),
  test:   (id: string) => api.post(`/api/v1/integrations/${id}/test`),
  delete: (id: string) => api.delete(`/api/v1/integrations/${id}`),
}

export const tenantApi = {
  me:     () => api.get('/api/v1/tenants/me'),
  update: (data: unknown) => api.patch('/api/v1/tenants/me', data),
  aiConfig: {
    list:   () => api.get('/api/v1/tenants/me/ai-config'),
    upsert: (data: unknown) => api.put('/api/v1/tenants/me/ai-config', data),
  },
}

export const paymentApi = {
  createCheckout: (data: unknown) => api.post('/api/v1/payments/checkout', data),
  listInvoices:   ()              => api.get('/api/v1/payments/invoices'),
}
