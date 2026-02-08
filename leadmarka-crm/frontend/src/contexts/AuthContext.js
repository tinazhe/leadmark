import React, { createContext, useContext, useState, useEffect } from 'react';
import { authAPI, workspaceAPI, billingAPI } from '../services/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const initAuth = async () => {
      // Allow clearing session via ?clear=1 for testing (e.g. /register?clear=1)
      if (typeof window !== 'undefined' && window.location.search.includes('clear=1')) {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        setUser(null);
        window.history.replaceState({}, '', window.location.pathname || '/');
        setLoading(false);
        return;
      }
      const token = localStorage.getItem('token');
      if (token) {
        try {
          const { data } = await authAPI.getMe();
          let workspace = null;
          try {
            const workspaceRes = await workspaceAPI.getMe();
            workspace = workspaceRes?.data || null;
          } catch (err) {
            workspace = null;
          }
          let billing = null;
          try {
            const billingRes = await billingAPI.getMe();
            billing = billingRes?.data || null;
          } catch (err) {
            billing = null;
          }
          const mergedUser = { ...data, ...(workspace || {}), subscription: billing };
          setUser(mergedUser);
        } catch (error) {
          localStorage.removeItem('token');
          localStorage.removeItem('user');
        }
      }
      setLoading(false);
    };

    initAuth();
  }, []);

  const login = async (email, password) => {
    const { data } = await authAPI.login(email, password);
    localStorage.setItem('token', data.token);
    let workspace = null;
    try {
      const workspaceRes = await workspaceAPI.getMe();
      workspace = workspaceRes?.data || null;
    } catch (err) {
      workspace = null;
    }
    let billing = null;
    try {
      const billingRes = await billingAPI.getMe();
      billing = billingRes?.data || null;
    } catch (err) {
      billing = null;
    }
    const mergedUser = { ...data.user, ...(workspace || {}), subscription: billing };
    localStorage.setItem('user', JSON.stringify(mergedUser));
    setUser(mergedUser);
    return data;
  };

  const register = async (userData) => {
    const { data } = await authAPI.register(userData);
    localStorage.setItem('token', data.token);
    let workspace = null;
    try {
      const workspaceRes = await workspaceAPI.getMe();
      workspace = workspaceRes?.data || null;
    } catch (err) {
      workspace = null;
    }
    let billing = null;
    try {
      const billingRes = await billingAPI.getMe();
      billing = billingRes?.data || null;
    } catch (err) {
      billing = null;
    }
    const mergedUser = { ...data.user, ...(workspace || {}), subscription: billing };
    localStorage.setItem('user', JSON.stringify(mergedUser));
    setUser(mergedUser);
    return data;
  };

  const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    setUser(null);
  };

  const updateUser = async (updates) => {
    const { data } = await authAPI.updateProfile(updates);
    const updatedUser = { ...user, ...data };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const updateWorkspaceSettings = async (updates) => {
    const { data } = await workspaceAPI.updateSettings(updates);
    const updatedUser = { ...user, ...data };
    localStorage.setItem('user', JSON.stringify(updatedUser));
    setUser(updatedUser);
  };

  const value = {
    user,
    login,
    register,
    logout,
    updateUser,
    updateWorkspaceSettings,
    isAuthenticated: !!user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
