import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [hospital, setHospital] = useState(null);
  const [patient, setPatient] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('medtransfer_token') || null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  // Initialize and verify existing session
  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('medtransfer_token');
      if (storedToken) {
        try {
          const res = await api.get('/auth/me');
          if (res.data.success) {
            setUser(res.data.user);
            setHospital(res.data.hospital);
            setPatient(res.data.patient);
            fetchNotifications();
          }
        } catch (err) {
          console.warn('Session expired or invalid, logging out.');
          logout();
        }
      }
      setLoading(false);
    };

    initAuth();

    const handleUnauthorized = () => {
      setUser(null);
      setHospital(null);
      setPatient(null);
      setToken(null);
    };

    window.addEventListener('auth:unauthorized', handleUnauthorized);
    return () => window.removeEventListener('auth:unauthorized', handleUnauthorized);
  }, []);

  const fetchNotifications = async () => {
    try {
      const res = await api.get('/notifications');
      if (res.data.success) {
        setNotifications(res.data.data);
        setUnreadCount(res.data.unread_count || 0);
      }
    } catch (err) {
      console.error('Error fetching notifications:', err);
    }
  };

  const login = async (email, password) => {
    setError(null);
    try {
      const res = await api.post('/auth/login', { email, password });
      if (res.data.success) {
        const { token, user, hospital, patient } = res.data;
        localStorage.setItem('medtransfer_token', token);
        localStorage.setItem('medtransfer_user', JSON.stringify(user));
        if (hospital) localStorage.setItem('medtransfer_hospital', JSON.stringify(hospital));
        if (patient) localStorage.setItem('medtransfer_patient', JSON.stringify(patient));
        
        setToken(token);
        setUser(user);
        setHospital(hospital);
        setPatient(patient);
        fetchNotifications();
        return { success: true, user, hospital, patient };
      }
    } catch (err) {
      const msg = err.response?.data?.message || 'Login failed. Please check credentials or server connection.';
      setError(msg);
      return { success: false, error: msg };
    }
  };

  const logout = async () => {
    try {
      if (token) {
        await api.post('/auth/logout').catch(() => {});
      }
    } finally {
      localStorage.removeItem('medtransfer_token');
      localStorage.removeItem('medtransfer_user');
      localStorage.removeItem('medtransfer_hospital');
      localStorage.removeItem('medtransfer_patient');
      setUser(null);
      setHospital(null);
      setPatient(null);
      setToken(null);
      setNotifications([]);
      setUnreadCount(0);
    }
  };

  const switchAccount = async (email, password) => {
    logout();
    return login(email, password);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        hospital,
        patient,
        token,
        isAuthenticated: !!user,
        loading,
        error,
        setError,
        login,
        logout,
        switchAccount,
        notifications,
        unreadCount,
        refreshNotifications: fetchNotifications
      }}
    >
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
