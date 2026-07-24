import axios from 'axios';

// Todas las llamadas van a /api/* → proxy de Vite → Express en :5000
const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
});

// Interceptor: adjunta el JWT a cada request si existe
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('erp_token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Interceptor: manejo global de 401 (sesión expirada).
// Excluye el propio /auth/login: su 401 significa "credenciales incorrectas"
// y debe llegar al formulario, no recargar la página (perdería el mensaje).
api.interceptors.response.use(
  (r) => r,
  (err) => {
    const esLogin = err.config?.url?.includes('/auth/login');
    if (err.response?.status === 401 && !esLogin) {
      localStorage.removeItem('erp_token');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(err);
  }
);

export default api;
