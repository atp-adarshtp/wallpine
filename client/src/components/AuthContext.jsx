import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const saved = localStorage.getItem('s3_auth_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  const [token, setToken] = useState(() => {
    return localStorage.getItem('s3_auth_token') || null;
  });

  const [loading, setLoading] = useState(true);

  const logout = useCallback(() => {
    setCurrentUser(null);
    setToken(null);
    localStorage.removeItem('s3_auth_user');
    localStorage.removeItem('s3_auth_token');
  }, []);

  // Authenticated fetch wrapper that automatically attaches the token
  // and handles 401 Unauthorized by logging out
  const authFetch = useCallback(async (url, options = {}) => {
    const currentToken = token || localStorage.getItem('s3_auth_token');
    const headers = {
      ...(options.headers || {}),
    };

    if (currentToken) {
      headers['Authorization'] = `Bearer ${currentToken}`;
    }

    const res = await fetch(url, { ...options, headers });

    if (res.status === 401) {
      logout();
      throw new Error('Session expired or unauthorized. Please log in.');
    }

    return res;
  }, [token, logout]);

  // Validate session on mount
  useEffect(() => {
    const checkAuth = async () => {
      const savedToken = localStorage.getItem('s3_auth_token');
      if (!savedToken) {
        setLoading(false);
        return;
      }
      try {
        const res = await fetch('/api/auth/me', {
          headers: { 'Authorization': `Bearer ${savedToken}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
          setCurrentUser(data.user);
          localStorage.setItem('s3_auth_user', JSON.stringify(data.user));
        } else {
          logout();
        }
      } catch (err) {
        console.error('Auth verification error:', err);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [logout]);

  const login = async (email, password) => {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success && data.user) {
      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem('s3_auth_user', JSON.stringify(data.user));
      localStorage.setItem('s3_auth_token', data.token);
      return { success: true, user: data.user, message: data.message };
    }
    return { success: false, error: data.error || 'Login failed' };
  };

  const register = async ({ email, password, name, role = 'user' }) => {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, role })
    });
    const data = await res.json();
    if (data.success && data.user) {
      setCurrentUser(data.user);
      setToken(data.token);
      localStorage.setItem('s3_auth_user', JSON.stringify(data.user));
      localStorage.setItem('s3_auth_token', data.token);
      return { success: true, user: data.user, message: data.message };
    }
    return { success: false, error: data.error || 'Registration failed' };
  };

  return (
    <AuthContext.Provider value={{ currentUser, token, authFetch, login, register, logout, loading }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
