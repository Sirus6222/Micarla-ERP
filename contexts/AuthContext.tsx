
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string, role: Role) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const mountedRef = useRef(true);
  const fetchingRef = useRef(false);

  const parseUser = (id: string, email: string, data: any): User => {
      const safeEmail = email || '';
      return {
          id: id,
          name: data?.name || safeEmail.split('@')[0] || 'User',
          role: (data?.role as Role) || Role.SALES_REP,
          avatarInitials: data?.avatarInitials || safeEmail.substring(0, 2).toUpperCase() || 'U'
      };
  };

  const fetchProfile = useCallback(async (userId: string, email: string): Promise<User | null> => {
    // Prevent concurrent fetches
    if (fetchingRef.current) return null;
    fetchingRef.current = true;

    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      const appUser = parseUser(userId, email, data);
      if (mountedRef.current) {
        setUser(appUser);
        setLoading(false);
      }
      return appUser;
    } catch (err) {
      console.warn("Profile fetch failed, using fallback:", err);
      const fallbackUser = parseUser(userId, email, null);
      if (mountedRef.current) {
        setUser(fallbackUser);
        setLoading(false);
      }
      return fallbackUser;
    } finally {
      fetchingRef.current = false;
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    // Safety timeout - increased to 15s for slow connections
    const timeoutId = setTimeout(() => {
        if (mountedRef.current && loading) {
            console.warn("Auth initialization timed out after 15s, forcing completion");
            setLoading(false);
        }
    }, 15000);

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();

        if (session?.user) {
           await fetchProfile(session.user.id, session.user.email || '');
        } else {
           if (mountedRef.current) {
             setUser(null);
             setLoading(false);
           }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        if (mountedRef.current) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      if (session?.user) {
        // Only fetch profile on meaningful auth events, skip INITIAL_SESSION
        // since initializeAuth already handles it
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
             await fetchProfile(session.user.id, session.user.email || '');
        }
      } else if (event === 'SIGNED_OUT') {
        if (mountedRef.current) {
          setUser(null);
          setLoading(false);
        }
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile]);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
        await fetchProfile(data.user.id, data.user.email || '');
    }
    return { error };
  };

  const signUp = async (email: string, password: string, name: string, role: Role) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role,
          avatarInitials: name.substring(0, 2).toUpperCase()
        }
      }
    });

    if (!error && data.user) {
        await fetchProfile(data.user.id, data.user.email || '');
    }
    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const hasRole = useCallback((roles: Role[]) => {
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;
    return roles.includes(user.role);
  }, [user]);

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
