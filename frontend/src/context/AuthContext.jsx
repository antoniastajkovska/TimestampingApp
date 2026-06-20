import React, { createContext, useContext, useState, useEffect } from 'react';
import { api } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [username, setUsername] = useState(null);
  const [roles, setRoles] = useState([]);
  const [auditorExpiresAt, setAuditorExpiresAt] = useState(null);
  const [deleteExpiresAt, setDeleteExpiresAt] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getMe()
      .then(me => {
        setUsername(me.username);
        setRoles(me.roles || []);
        if (me.auditorExpiresAt) setAuditorExpiresAt(new Date(me.auditorExpiresAt).getTime());
        if (me.deleteExpiresAt)  setDeleteExpiresAt(new Date(me.deleteExpiresAt).getTime());
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function logout() {
    await api.logout().catch(() => {});
    setUsername(null);
    setRoles([]);
    setAuditorExpiresAt(null);
    setDeleteExpiresAt(null);
  }

  async function requestAuditor(password) {
    const data = await api.requestAuditor(password);
    setAuditorExpiresAt(data.expiresAt);
    setRoles(prev => [...new Set([...prev, 'JIT_AUDITOR'])]);
    return data.expiresAt;
  }

  async function requestDelete(password) {
    const data = await api.requestDelete(password);
    setDeleteExpiresAt(data.expiresAt);
    setRoles(prev => [...new Set([...prev, 'JIT_DELETE'])]);
    return data.expiresAt;
  }

  const hasRole = (role) => roles.includes(role);

  return (
    <AuthContext.Provider value={{
      username, setUsername, roles, setRoles,
      auditorExpiresAt, setAuditorExpiresAt,
      deleteExpiresAt, setDeleteExpiresAt,
      logout, requestAuditor, requestDelete, hasRole, loading,
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
