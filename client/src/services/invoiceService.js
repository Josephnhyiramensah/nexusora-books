import api from './api';

const invoiceService = {
  getAll: async (filters = {}) => {
    const params = new URLSearchParams();
    if (filters.status) params.append('status', filters.status);
    if (filters.customer) params.append('customer', filters.customer);
    const { data } = await api.get(`/invoices?${params}`);
    return data;
  },
  getById: async (id) => { const { data } = await api.get(`/invoices/${id}`); return data; },
  create: async (d) => { const { data } = await api.post('/invoices', d); return data; },
  update: async (id, d) => { const { data } = await api.put(`/invoices/${id}`, d); return data; },
  send: async (id) => { const { data } = await api.post(`/invoices/${id}/send`); return data; },
};

export default invoiceService;