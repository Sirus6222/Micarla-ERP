
import React, { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { User, Role } from '../types';

interface AuthContextType {
  user: User | null;
  loading: boolean;
  authError: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authError, setAuthError] = useState(false);
  const [configError, setConfigError] = useState(!isSupabaseConfigured);
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
    if (!isSupabaseConfigured) {
      safeSetLoading(false);
      return;
    }

    mountedRef.current = true;
    loadingRef.current = true;

    // Safety timeout — token refresh after inactivity on a cold connection can take
    // several seconds, so 15s gives Supabase enough time to refresh before we give up.
    const timeoutId = setTimeout(() => {
        if (mountedRef.current && loadingRef.current) {
            console.warn("Auth initialization timed out after 15s, forcing completion");
            setAuthError(true);
            safeSetLoading(false);
        }
    }, 15000);

    // Use onAuthStateChange as the single source of truth for the initial session.
    // In Supabase v2, INITIAL_SESSION fires synchronously from localStorage before
    // any network call, so loading resolves immediately for returning users.
    // If the cached token is expired, Supabase auto-refreshes and fires TOKEN_REFRESHED.
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!mountedRef.current) return;

      try {
        if (event === 'INITIAL_SESSION' || event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
          if (session?.user) {
            await fetchProfile(session.user.id, session.user.email || '');
          } else {
            // INITIAL_SESSION with no session means the user is not logged in
            setUser(null);
            safeSetLoading(false);
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

  const signUp = async (email: string, password: string, name: string) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name,
          role: Role.SALES_REP,
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

  if (configError) {
    return (
      <div className="min-h-screen bg-stone-50 flex items-center justify-center p-8">
        <div className="bg-white rounded-xl shadow-lg border border-stone-200 p-8 max-w-lg w-full text-center">
          <div className="w-16 h-16 bg-amber-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg className="text-amber-500" xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/></svg>
          </div>
          <h2 className="text-xl font-bold text-stone-900 mb-2">Configuration Required</h2>
          <p className="text-sm text-stone-600 mb-4">
            Supabase environment variables are missing. The app cannot connect to the database.
          </p>
          <div className="bg-stone-50 rounded-lg p-4 text-left mb-4">
            <p className="text-xs font-mono text-stone-500 mb-2">Create a <strong>.env.local</strong> file in the project root with:</p>
            <pre className="text-xs font-mono text-stone-800 whitespace-pre-wrap">
{`VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here`}
            </pre>
          </div>
          <p className="text-xs text-stone-400">
            Then restart the development server.
          </p>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{ user, loading, authError, signIn, signUp, signOut, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
