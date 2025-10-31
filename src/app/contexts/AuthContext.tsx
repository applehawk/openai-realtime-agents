'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';

export interface User {
  id: string;
  username: string;
  email: string;
  google_connected: boolean;
  created_at: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  googleConnected: boolean;
  login: (username: string, password: string) => Promise<void>;
  register: (username: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
  clearError: () => void;
  connectGoogle: () => Promise<void>;
  disconnectGoogle: () => Promise<void>;
  checkGoogleStatus: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [googleConnected, setGoogleConnected] = useState(false);
  const router = useRouter();

  // Check authentication status on mount
  useEffect(() => {
    checkAuth();
  }, []);

  // Check URL params for Google connection status
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('google_connected') === 'true') {
      checkGoogleStatus();
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    } else if (params.get('google_error')) {
      setError(`Google connection failed: ${params.get('google_error')}`);
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Check Google status when user changes
  useEffect(() => {
    if (user) {
      checkGoogleStatus();
    } else {
      setGoogleConnected(false);
    }
  }, [user]);

  const checkAuth = async () => {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const userData = await response.json();
        setUser(userData);
      } else {
        // 401 is expected when not authenticated - no need to log
        if (response.status !== 401) {
          console.error('Auth check failed:', response.status, response.statusText);
        }
        setUser(null);
      }
    } catch (err) {
      console.error('Auth check failed:', err);
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  const login = async (username: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Login failed');
      }

      setUser(data.user);
      router.push('/');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const register = async (username: string, email: string, password: string) => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({ username, email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.detail || 'Registration failed');
      }

      // Registration successful - don't auto-login, let user login manually
      return;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Registration failed';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const logout = async () => {
    setLoading(true);

    try {
      await fetch('/api/auth/logout', {
        method: 'POST',
        credentials: 'include',
      });
    } catch (err) {
      console.error('Logout error:', err);
    } finally {
      setUser(null);
      setLoading(false);
      router.push('/auth/login');
    }
  };

  const refreshUser = async () => {
    await checkAuth();
  };

  const clearError = () => {
    setError(null);
  };

  const connectGoogle = async () => {
    setError(null);
    setLoading(true);

    try {
      // Get access token from cookie
      const authResponse = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (!authResponse.ok) {
        throw new Error('Not authenticated');
      }

      // Get current page URL for return
      const returnUrl = window.location.href;
      
      // Get auth URL directly from backend
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/'}google/auth/url`, {
        headers: {
          'X-Return-URL': returnUrl
        },
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to get auth URL');
      }

      const { auth_url } = await response.json();
      
      // Redirect to Google OAuth
      window.location.href = auth_url;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to connect Google';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const disconnectGoogle = async () => {
    setError(null);
    setLoading(true);

    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/'}google/disconnect/all`, {
        method: 'DELETE',
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('Failed to disconnect Google');
      }

      setGoogleConnected(false);
      await refreshUser(); // Refresh user data
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to disconnect Google';
      setError(message);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  const checkGoogleStatus = async () => {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_AUTH_API_URL || 'https://rndaibot.ru/apib/v1/'}google/status`, {
        credentials: 'include',
      });

      if (response.ok) {
        const status = await response.json();
        setGoogleConnected(status.gmail_connected || status.calendar_connected);
        
        // Also update user object if it exists
        if (user) {
          setUser({
            ...user,
            google_connected: status.gmail_connected || status.calendar_connected
          });
        }
      }
    } catch (err) {
      console.error('Check Google status error:', err);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        googleConnected,
        login,
        register,
        logout,
        refreshUser,
        clearError,
        connectGoogle,
        disconnectGoogle,
        checkGoogleStatus,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
