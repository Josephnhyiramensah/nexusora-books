import axios from 'axios';

const getSubdomain = () => {
  const hostname = window.location.hostname;

  // Check URL query param first (?tenant=kgr)
  const urlParams = new URLSearchParams(window.location.search);
  const tenantParam = urlParams.get('tenant');
  if (tenantParam) {
    sessionStorage.setItem('dev_tenant', tenantParam);
    return tenantParam;
  }

  // Check sessionStorage (persists across navigations in same tab)
  const stored = sessionStorage.getItem('dev_tenant');
  if (stored) return stored;

  // Development: kgr.localhost
  if (hostname.endsWith('.localhost')) {
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[0] !== 'www' && parts[0] !== 'localhost') {
      return parts[0];
    }
  }

  // Production: kgr.nexusorabooks.com
  const parts = hostname.split('.');
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0];
  }

  // Final fallback for plain localhost
  return 'kgr';
};

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  timeout: 30000,
});

// ─── REQUEST INTERCEPTOR ──────────────────────────────────────────────────────
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('accessToken');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    const subdomain = getSubdomain();
    if (subdomain) {
      config.headers['X-Tenant-ID'] = subdomain;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// ─── RESPONSE INTERCEPTOR — auto-refresh on 401 ───────────────────────────────
let isRefreshing = false;
let failedQueue = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((prom) => {
    if (error) prom.reject(error);
    else prom.resolve(token);
  });
  failedQueue = [];
};

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      if (
        originalRequest.url?.includes('/auth/refresh') ||
        originalRequest.url?.includes('/auth/login')
      ) {
        return Promise.reject(error);
      }

      if (isRefreshing) {
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        })
          .then((token) => {
            originalRequest.headers.Authorization = `Bearer ${token}`;
            return api(originalRequest);
          })
          .catch((err) => Promise.reject(err));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        const refreshToken = localStorage.getItem('refreshToken');
        if (!refreshToken) throw new Error('No refresh token');

        const { data } = await api.post('/auth/refresh', { refreshToken });

        if (data.success) {
          localStorage.setItem('accessToken', data.data.accessToken);
          localStorage.setItem('refreshToken', data.data.refreshToken);
          processQueue(null, data.data.accessToken);
          originalRequest.headers.Authorization = `Bearer ${data.data.accessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        processQueue(refreshError, null);
        localStorage.removeItem('accessToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('user');
        window.location.href = '/login';
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    return Promise.reject(error);
  }
);

export { getSubdomain };
export default api;