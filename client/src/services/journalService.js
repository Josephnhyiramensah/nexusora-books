// client/src/services/journalService.js
// API calls for Journal Entries

import api from './api';

const journalService = {
  // List entries with filters
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.journalType) params.append('journalType', filters.journalType);
    if (filters.startDate) params.append('startDate', filters.startDate);
    if (filters.endDate) params.append('endDate', filters.endDate);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    const { data } = await api.get(`/journals?${params.toString()}`);
    return data;
  },

  // Get single entry
  getById: async (id) => {
    const { data } = await api.get(`/journals/${id}`);
    return data;
  },

  // Create draft entry
  create: async (entryData) => {
    const { data } = await api.post('/journals', entryData);
    return data;
  },

  // Update draft entry
  update: async (id, entryData) => {
    const { data } = await api.put(`/journals/${id}`, entryData);
    return data;
  },

  // Post entry (updates account balances)
  post: async (id) => {
    const { data } = await api.post(`/journals/${id}/post`);
    return data;
  },

  // Reverse posted entry
  reverse: async (id) => {
    const { data } = await api.post(`/journals/${id}/reverse`);
    return data;
  },

  // Delete draft entry
  delete: async (id) => {
    const { data } = await api.delete(`/journals/${id}`);
    return data;
  },
};

export default journalService;