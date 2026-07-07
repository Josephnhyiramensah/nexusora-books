import api from './api';

const dashboardService = {
  getSummary: async () => {
    const { data } = await api.get('/dashboard/summary');
    return data;
  },
};

export default dashboardService;