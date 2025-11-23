import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from '../lib/api';

interface User {
  id: string;
  email: string;
}

interface TenantUser {
  id: string;
  tenant_id: string;
  role: 'system_admin' | 'tenant_admin' | 'manager' | 'cashier';
  is_active: boolean;
}

interface AuthContextType {
  user: User | null;
  tenantUser: TenantUser | null;
  tenantId: string | null;
  role: string | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [tenantUser, setTenantUser] = useState<TenantUser | null>(null);
  const [tenantId, setTenantId] = useState<string | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = api.getToken();
    if (token) {
      loadUser();
    } else {
      setLoading(false);
    }
  }, []);

  const loadUser = async () => {
    try {
      const response = await api.auth.me();
      if (response.data?.user) {
        setUser(response.data.user);
        setTenantUser(response.data.user.tenantUser);
        setTenantId(response.data.user.tenantId);
        setRole(response.data.user.role);
      } else {
        api.setToken(null);
      }
    } catch (error) {
      console.error('Error loading user:', error);
      api.setToken(null);
    } finally {
      setLoading(false);
    }
  };

  const signIn = async (email: string, password: string) => {
    const response = await api.auth.login(email, password);
    if (response.error) {
      throw new Error(response.error);
    }
    if (response.data) {
      setUser(response.data.user);
      setTenantId(response.data.tenantId);
      setRole(response.data.role);
      setTenantUser({
        id: response.data.user.id,
        tenant_id: response.data.tenantId,
        role: response.data.role as any,
        is_active: true,
      });
    }
  };

  const signUp = async (email: string, password: string) => {
    const response = await api.auth.signup(email, password);
    if (response.error) {
      throw new Error(response.error);
    }
    if (response.data) {
      setUser(response.data.user);
      setTenantId(response.data.tenantId);
      setRole(response.data.role);
      setTenantUser({
        id: response.data.user.id,
        tenant_id: response.data.tenantId,
        role: response.data.role as any,
        is_active: true,
      });
    }
  };

  const signOut = async () => {
    await api.auth.logout();
    setUser(null);
    setTenantUser(null);
    setTenantId(null);
    setRole(null);
  };

  const value = {
    user,
    tenantUser,
    tenantId,
    role,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
