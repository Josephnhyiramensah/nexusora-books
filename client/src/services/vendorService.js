import api from './api';

const vendorService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive);
    const { data } = await api.get(`/vendors?${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/vendors/${id}`); return data; },
  create: async (d) => { const { data } = await api.post('/vendors', d); return data; },
  update: async (id, d) => { const { data } = await api.put(`/vendors/${id}`, d); return data; },
  deactivate: async (id) => { const { data } = await api.delete(`/vendors/${id}`); return data; },
};

export default vendorService;