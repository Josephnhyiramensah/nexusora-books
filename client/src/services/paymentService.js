import api from './api';

const paymentService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    const { data } = await api.get(`/payments?${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/payments/${id}`); return data; },
  receive: async (d) => { const { data } = await api.post('/payments/receive', d); return data; },
  make: async (d) => { const { data } = await api.post('/payments/make', d); return data; },
};

export default paymentService;