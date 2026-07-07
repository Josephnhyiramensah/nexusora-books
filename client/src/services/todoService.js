import api from './api';

const todoService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.priority) params.append('priority', filters.priority);
    const { data } = await api.get(`/todos?${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/todos/${id}`); return data; },
  create: async (d) => { const { data } = await api.post('/todos', d); return data; },
  update: async (id, d) => { const { data } = await api.put(`/todos/${id}`, d); return data; },
  complete: async (id) => { const { data } = await api.patch(`/todos/${id}/complete`); return data; },
  delete: async (id) => { const { data } = await api.delete(`/todos/${id}`); return data; },
};

export default todoService;