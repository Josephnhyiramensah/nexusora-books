import api from './api';

const noteService = {
  getAll: async (type) => {
    const params = type ? `?type=${type}` : '';
    const { data } = await api.get(`/notes${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/notes/${id}`); return data; },
  create: async (d) => { const { data } = await api.post('/notes', d); return data; },
  update: async (id, d) => { const { data } = await api.put(`/notes/${id}`, d); return data; },
  delete: async (id) => { const { data } = await api.delete(`/notes/${id}`); return data; },
  pin: async (id) => { const { data } = await api.patch(`/notes/${id}/pin`); return data; },
  addComment: async (id, text) => { const { data } = await api.post(`/notes/${id}/comments`, { text }); return data; },
};

export default noteService;