
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
  const loadingRef = useRef(true); // Mirror of loading state for use in closures

  const parseUser = (id: string, email: string, data: any): User => {
      const safeEmail = email || '';
      return {
          id: id,
          name: data?.name || safeEmail.split('@')[0] || 'User',
          role: (data?.role as Role) || Role.SALES_REP,
          avatarInitials: data?.avatarInitials || safeEmail.substring(0, 2).toUpperCase() || 'U'
      };
  };

  const safeSetLoading = useCallback((value: boolean) => {
    if (mountedRef.current) {
      loadingRef.current = value;
      setLoading(value);
    }
  }, []);

  const fetchProfile = useCallback(async (userId: string, email: string): Promise<User | null> => {
    // No fetchingRef guard — let concurrent calls resolve naturally.
    // The last write to setUser wins, which is the correct behavior.
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (error) {
        console.warn("Profile query error (using fallback):", error.message);
      }

      const appUser = parseUser(userId, email, data);
      if (mountedRef.current) {
        setUser(appUser);
        safeSetLoading(false);
      }
      return appUser;
    } catch (err) {
      console.warn("Profile fetch failed, using fallback:", err);
      const fallbackUser = parseUser(userId, email, null);
      if (mountedRef.current) {
        setUser(fallbackUser);
        safeSetLoading(false);
      }
      return fallbackUser;
    }
  }, [safeSetLoading]);

  useEffect(() => {
    mountedRef.current = true;
    loadingRef.current = true;

    // Safety timeout — uses ref to avoid stale closure
    const timeoutId = setTimeout(() => {
        if (mountedRef.current && loadingRef.current) {
            console.warn("Auth initialization timed out after 15s, forcing completion");
            safeSetLoading(false);
        }
    }, 15000);

    const initializeAuth = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error("getSession failed:", error.message);
          safeSetLoading(false);
          return;
        }

        if (session?.user) {
           await fetchProfile(session.user.id, session.user.email || '');
        } else {
           if (mountedRef.current) {
             setUser(null);
             safeSetLoading(false);
           }
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
        safeSetLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      try {
        if (session?.user) {
          if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
            await fetchProfile(session.user.id, session.user.email || '');
          }
        } else if (event === 'SIGNED_OUT') {
          setUser(null);
          safeSetLoading(false);
        }
      } catch (err) {
        // Critical: never let the listener crash — it would kill all future auth events
        console.error("onAuthStateChange handler error:", err);
      }
    });

    return () => {
      mountedRef.current = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, [fetchProfile, safeSetLoading]);

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
