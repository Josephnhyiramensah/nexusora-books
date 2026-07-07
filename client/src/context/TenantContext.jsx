import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import api from '../services/api';

const TenantContext = createContext({});

export function TenantProvider({ children }) {
  const [subdomain, setSubdomain] = useState('');
  const [companyName, setCompanyName] = useState('');
  const [plan, setPlan] = useState('trial');
  const [settings, setSettings] = useState({});
  const [loading, setLoading] = useState(true);

  const extractSubdomain = () => {
    // Check URL query param first (?tenant=kgr)
    const urlParams = new URLSearchParams(window.location.search);
    const tenantParam = urlParams.get('tenant');
    if (tenantParam) {
      sessionStorage.setItem('dev_tenant', tenantParam);
      return tenantParam;
    }

    // Check sessionStorage (persists across navigations in dev)
    const stored = sessionStorage.getItem('dev_tenant');
    if (stored) return stored;

    // Production subdomain routing
    const hostname = window.location.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 3 && parts[0] !== 'www') return parts[0];

    // Final fallback for dev
    return 'kgr';
  };

  const fetchTenant = useCallback(async () => {
    try {
      const sub = extractSubdomain();
      setSubdomain(sub);
      const { data } = await api.get(`/tenants/${sub}`);
      if (data.success) {
        setCompanyName(data.data.companyName || '');
        setPlan(data.data.plan || 'trial');
        setSettings(data.data.settings || {});
      }
    } catch (error) {
      console.warn('[Tenant] Could not fetch tenant info:', error.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTenant(); }, [fetchTenant]);

  // 👇 ADDED: Apply white-label branding dynamically
  useEffect(() => {
    const wl = settings?.whiteLabel;
    if (wl?.enabled) {
      if (wl.primaryColor) document.documentElement.style.setProperty('--deep-navy', wl.primaryColor);
      if (wl.accentColor) document.documentElement.style.setProperty('--nexusora-gold', wl.accentColor);
    }
  }, [settings]);

  // Call this after saving settings to immediately update context without reload
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
      subdomain, companyName, plan, settings, loading,
      updateSettings, updateTenantInfo, refreshTenant: fetchTenant,
    }}>
      {children}
    </TenantContext.Provider>
  );
}

export function useTenant() {
  return useContext(TenantContext);
}