import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api, { getSubdomain } from '../services/api';

const TenantContext = createContext({});

export function TenantProvider({ children }) {
  const [subdomain, setSubdomain] = useState(null);
  const [companyName, setCompanyName] = useState('');
  const [plan, setPlan] = useState('trial');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  const fetchTenant = useCallback(async () => {
    const sub = getSubdomain();
    setSubdomain(sub);

    // Apex domain — no tenant. This is the public site, not a workspace.
    if (!sub) {
      setLoading(false);
      return;
    }

    try {
      const { data } = await api.get(`/tenants/${sub}/public`);
      if (data.success) {
        setCompanyName(data.data.companyName || '');
        setPlan(data.data.plan || 'trial');
        setSettings(data.data.settings || {});
      } else {
        setNotFound(true);
      }
    } catch (error) {
      console.warn('[Tenant] Could not fetch tenant info:', error.message);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  // Full settings arrive from AuthContext once /auth/me succeeds. The public
  // tenant endpoint exposes only logo + whiteLabel, so without this the
  // letterhead, address and TIN are lost on every refresh. Listening here
  // (rather than calling /auth/me directly) avoids a duplicate request racing
  // a stale token.
  useEffect(() => {
    const onSettings = (e) => {
      if (e.detail) setSettings((prev) => ({ ...prev, ...e.detail }));
    };
    window.addEventListener('nexusora:tenant-settings', onSettings);
    return () => window.removeEventListener('nexusora:tenant-settings', onSettings);
  }, []);

  // Apply white-label branding dynamically
  useEffect(() => {
    const wl = settings?.whiteLabel;
    if (wl?.enabled) {
      if (wl.primaryColor) document.documentElement.style.setProperty('--deep-navy', wl.primaryColor);
      if (wl.accentColor) document.documentElement.style.setProperty('--nexusora-gold', wl.accentColor);
    }
  }, [settings]);

  const updateSettings = useCallback((newSettings) => {
    setSettings((prev) => ({ ...prev, ...newSettings }));
  }, []);

  const updateTenantInfo = useCallback((info) => {
    if (info.companyName) setCompanyName(info.companyName);
    if (info.plan) setPlan(info.plan);
    if (info.settings) setSettings((prev) => ({ ...prev, ...info.settings }));
  }, []);

  return (
    <TenantContext.Provider value={{
      subdomain,
      companyName,
      plan,
      settings,
      loading,
      notFound,
      isPublic: !loading && !subdomain,   // true on the apex domain
      updateSettings,
      updateTenantInfo,
      refreshTenant: fetchTenant,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}6