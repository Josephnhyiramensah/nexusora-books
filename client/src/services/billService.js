import api from './api';

const billService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.vendor) params.append('vendor', filters.vendor);
    const { data } = await api.get(`/bills?${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/bills/${id}`); return data; },
  create: async (d) => { const { data } = await api.post('/bills', d); return data; },
  approve: async (id) => { const { data } = await api.post(`/bills/${id}/approve`); return data; },
};

export default billService;