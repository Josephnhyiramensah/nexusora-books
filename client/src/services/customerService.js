import api from './api';

const customerService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive);
    const { data } = await api.get(`/customers?${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/customers/${id}`); return data; },
  create: async (d) => { const { data } = await api.post('/customers', d); return data; },
  update: async (id, d) => { const { data } = await api.put(`/customers/${id}`, d); return data; },
  deactivate: async (id) => { const { data } = await api.delete(`/customers/${id}`); return data; },
};

export default customerService;