// client/src/context/AuthContext.jsx

import { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

const AUTH_ACTIONS = {
  SET_LOADING: 'SET_LOADING',
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGOUT: 'LOGOUT',
  SET_USER: 'SET_USER',
  AUTH_ERROR: 'AUTH_ERROR',
};

const initialState = {
  user: JSON.parse(localStorage.getItem('user') || 'null'),
  isAuthenticated: !!localStorage.getItem('accessToken'),
  isLoading: true,
  error: null,
};

function authReducer(state, action) {
  switch (action.type) {
    case AUTH_ACTIONS.SET_LOADING:
      return { ...state, isLoading: action.payload };
    case AUTH_ACTIONS.LOGIN_SUCCESS:
      return { ...state, user: action.payload.user, isAuthenticated: true, isLoading: false, error: null };
    case AUTH_ACTIONS.SET_USER:
      return { ...state, user: action.payload, isLoading: false };
    case AUTH_ACTIONS.LOGOUT:
      return { ...state, user: null, isAuthenticated: false, isLoading: false, error: null };
    case AUTH_ACTIONS.AUTH_ERROR:
      return { ...state, error: action.payload, isLoading: false };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(authReducer, initialState);

  useEffect(() => {
    const checkAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        dispatch({ type: AUTH_ACTIONS.LOGOUT });
        return;
      }
      try {
        const { data } = await api.get('/auth/me');
        if (data.success) {
          dispatch({ type: AUTH_ACTIONS.SET_USER, payload: data.data.user });
          localStorage.setItem('user', JSON.stringify(data.data.user));
          // Hand the tenant's full settings to TenantContext. The public tenant
          // endpoint exposes only logo + whiteLabel, so without this the
          // letterhead, address and TIN are lost on every refresh. Broadcasting
          // from here avoids a second /auth/me call racing this one with a
          // stale token — which is what was silently 401ing.
          if (data.data.tenant?.settings) {
            window.dispatchEvent(new CustomEvent('nexusora:tenant-settings', { detail: data.data.tenant.settings }));
          }
        }
      } catch {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
      }
    };
    checkAuth();
  }, []);

  const login = useCallback(async (email, password) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      const { data } = await api.post('/auth/login', { email, password });
 
      // Outcome 1: 2FA-enabled user. Password was correct but NO session is
      // issued yet — the server returned a short-lived challenge token. Hand it
      // back to the login page so it can collect the second factor. We set no
      // localStorage and dispatch no LOGIN_SUCCESS: not authenticated yet.
      if (data.success && data.twoFactorRequired) {
        dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: false });
        return { success: false, twoFactorRequired: true, challengeToken: data.data.challengeToken };
      }

      // Outcome 2: normal login (2FA off). Full session issued.
      if (data.success) {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        dispatch({ type: AUTH_ACTIONS.LOGIN_SUCCESS, payload: data.data });
        // twoFactorEnabled:false here → the login page may offer a skippable
        // "set up 2FA" prompt. That nudge is purely a frontend concern.
        return { success: true, twoFactorEnabled: !!data.data.user?.twoFactorEnabled };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.AUTH_ERROR, payload: message });
      return { success: false, message };
    }
  }, []);

  // Complete step 2 of login for a 2FA-enabled user. Accepts EITHER a 6-digit
  // TOTP (code) OR a backup code — pass whichever the user entered. On success
  // this is a fully completed login (same session writes as a normal login).
  const verifyTwoFactor = useCallback(async (challengeToken, { code, backupCode }) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      const body = { challengeToken };
      if (backupCode) body.backupCode = backupCode;
      else body.token = code;

      const { data } = await api.post('/auth/2fa/login', body);
      if (data.success) {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        dispatch({ type: AUTH_ACTIONS.LOGIN_SUCCESS, payload: data.data });
        return {
          success: true,
          usedBackupCode: !!data.data.usedBackupCode,
          backupCodesRemaining: data.data.backupCodesRemaining,
        };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Verification failed. Please try again.';
      dispatch({ type: AUTH_ACTIONS.AUTH_ERROR, payload: message });
      return { success: false, message };
    }
  }, []);

  const register = useCallback(async (userData) => {
    try {
      dispatch({ type: AUTH_ACTIONS.SET_LOADING, payload: true });
      const { data } = await api.post('/auth/register', userData);
      if (data.success) {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        dispatch({ type: AUTH_ACTIONS.LOGIN_SUCCESS, payload: data.data });
        return { success: true };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Registration failed.';
      dispatch({ type: AUTH_ACTIONS.AUTH_ERROR, payload: message });
      return { success: false, message };
    }
  }, []);

  const logout = useCallback(async () => {
    try { await api.post('/auth/logout'); } catch {}
    finally {
      localStorage.removeItem('accessToken');
      localStorage.removeItem('refreshToken');
      localStorage.removeItem('user');
      dispatch({ type: AUTH_ACTIONS.LOGOUT });
    }
  }, []);

  const clearError = useCallback(() => {
    dispatch({ type: AUTH_ACTIONS.AUTH_ERROR, payload: null });
  }, []);

  return (
<AuthContext.Provider value={{ ...state, login, verifyTwoFactor, register, logout, clearError }}>    
    {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}

export default AuthContext;