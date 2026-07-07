import api from './api';

let cachedSettings = null;

export const getPlatformSettings = async () => {
  if (cachedSettings) return cachedSettings;
  try {
    const { data } = await api.get('/platform/settings');
    if (data.success) {
      cachedSettings = data.data;
      return cachedSettings;
    }
  } catch {}
  // Fallback defaults if API fails
  return {
    company: {
      name: 'Nexusora Technology',
      email: 'nexusoratechnologies@gmail.com',
      phone: '+233 548 211 310',
      whatsapp: '233548211310',
    },
    subscription: {
      trialDays: 30,
      starterPrice: 300,
      professionalPrice: 990,
      enterprisePrice: 2400,
      currency: 'GHS',
    },
    branding: { platformName: 'Nexusora Books' },
  };
};

export const clearSettingsCache = () => { cachedSettings = null; };