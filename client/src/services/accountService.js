// client/src/services/accountService.js
// API calls for Chart of Accounts

import api from './api';

const accountService = {
  // Get all accounts with optional filters
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.isActive !== undefined) params.append('isActive', filters.isActive);
    const { data } = await api.get(`/accounts?${params.toString()}`);
    return data;
  },

  // Get hierarchical tree
  getTree: async () => {
    const { data } = await api.get('/accounts/tree');
    return data;
  },

  // Get single account
  getById: async (id) => {
    const { data } = await api.get(`/accounts/${id}`);
    return data;
  },

  // Create new account
  create: async (accountData) => {
    const { data } = await api.post('/accounts', accountData);
    return data;
  },

  // Update account
  update: async (id, accountData) => {
    const { data } = await api.put(`/accounts/${id}`, accountData);
    return data;
  },

  // Deactivate account
  deactivate: async (id) => {
    const { data } = await api.patch(`/accounts/${id}/deactivate`);
    return data;
  },
};

export default accountService;