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
      if (data.success) {
        localStorage.setItem('accessToken', data.data.accessToken);
        localStorage.setItem('refreshToken', data.data.refreshToken);
        localStorage.setItem('user', JSON.stringify(data.data.user));
        dispatch({ type: AUTH_ACTIONS.LOGIN_SUCCESS, payload: data.data });
        return { success: true };
      }
    } catch (error) {
      const message = error.response?.data?.message || 'Login failed. Please try again.';
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
    <AuthContext.Provider value={{ ...state, login, register, logout, clearError }}>
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