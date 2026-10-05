// client/src/services/voucherService.js
// API calls for Vouchers

import api from './api';

const voucherService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.type) params.append('type', filters.type);
    if (filters.status) params.append('status', filters.status);
    if (filters.page) params.append('page', filters.page);
    if (filters.limit) params.append('limit', filters.limit);
    const { data } = await api.get(`/vouchers?${params.toString()}`);
    return data;
  },

  getById: async (id) => {
    const { data } = await api.get(`/vouchers/${id}`);
    return data;
  },

  create: async (voucherData) => {
    const { data } = await api.post('/vouchers', voucherData);
    return data;
  },

  approve: async (id) => {
    const { data } = await api.post(`/vouchers/${id}/approve`);
    return data;
  },
  reject: async (id, reason) => {
    const { data } = await api.post(`/vouchers/${id}/reject`, { reason });
    return data;
  },
  post: async (id) => {
    const { data } = await api.post(`/vouchers/${id}/post`);
    return data;
  },

  reverse: async (id) => {
    const { data } = await api.post(`/vouchers/${id}/reverse`);
    return data;
  },

  delete: async (id) => {
    const { data } = await api.delete(`/vouchers/${id}`);
    return data;
  },
};

export default voucherService;
