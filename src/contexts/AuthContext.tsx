"use client";

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type UserRole = 'admin' | 'cashier';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<boolean>;
  logout: () => void;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Usuarios de prueba eliminados
const DEMO_USERS: User[] = [];

// Credenciales de prueba eliminadas para mayor seguridad, aunque se mantienen las del LoginPage por acceso básico
const DEMO_CREDENTIALS: Record<string, { password: string; user: User }> = {
  'admin@masterpos.com': { 
    password: 'admin123', 
    user: { id: '1', name: 'Administrador', email: 'admin@masterpos.com', role: 'admin' } 
  },
  'cajero@masterpos.com': { 
    password: 'cajero123', 
    user: { id: '2', name: 'Cajero', email: 'cajero@masterpos.com', role: 'cashier' } 
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const storedUser = localStorage.getItem('masterpos_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (e) {
        console.error('Error parsing stored user', e);
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    const credential = DEMO_CREDENTIALS[email];
    
    if (credential && credential.password === password) {
      setUser(credential.user);
      localStorage.setItem('masterpos_user', JSON.stringify(credential.user));
      return true;
    }
    
    return false;
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('masterpos_user');
    window.location.href = '/login';
  };

  const hasRole = (role: UserRole) => {
    return user?.role === role;
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout, hasRole }}>
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
