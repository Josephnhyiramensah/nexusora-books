import api from './api';

const reportService = {
  trialBalance: async () => {
    const { data } = await api.get('/reports/trial-balance');
    return data;
  },
  profitLoss: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const { data } = await api.get(`/reports/profit-loss?${params}`);
    return data;
  },
  balanceSheet: async () => {
    const { data } = await api.get('/reports/balance-sheet');
    return data;
  },
  cashFlow: async (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const { data } = await api.get(`/reports/cash-flow?${params}`);
    return data;
  },
  generalLedger: async (accountId, startDate, endDate) => {
    const params = new URLSearchParams();
    if (accountId) params.append('accountId', accountId);
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    const { data } = await api.get(`/reports/general-ledger?${params}`);
    return data;
  },
};

export default reportService;