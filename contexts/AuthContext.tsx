
import React, { createContext, useContext, useState, useEffect } from 'react';
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

  // Helper to safely parse user data or create fallback
  const parseUser = (id: string, email: string, data: any): User => {
      const safeEmail = email || '';
      return {
          id: id,
          name: data?.name || safeEmail.split('@')[0] || 'User',
          role: (data?.role as Role) || Role.SALES_REP,
          avatarInitials: data?.avatarInitials || safeEmail.substring(0, 2).toUpperCase() || 'U'
      };
  };

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();
      
      // If we have data, use it. If not (error or missing), fallback to default.
      // This ensures we always return a valid User object if the session exists.
      const appUser = parseUser(userId, email, data);
      setUser(appUser);
      return appUser;
    } catch (err) {
      console.warn("Profile fetch failed, using fallback:", err);
      // Fallback
      const fallbackUser = parseUser(userId, email, null);
      setUser(fallbackUser);
      return fallbackUser;
    }
  };

  useEffect(() => {
    let mounted = true;

    // Safety timeout to prevent infinite loading state
    const timeoutId = setTimeout(() => {
        if (mounted) setLoading(s => {
            if (s) console.warn("Auth initialization timed out, forcing completion");
            return false;
        });
    }, 5000);

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
           await fetchProfile(session.user.id, session.user.email || '');
        } else {
           if (mounted) setUser(null);
        }
      } catch (error) {
        console.error("Auth initialization failed:", error);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    initializeAuth();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (session?.user) {
        if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'INITIAL_SESSION') {
             await fetchProfile(session.user.id, session.user.email || '');
        }
      } else if (event === 'SIGNED_OUT') {
        if (mounted) {
          setUser(null);
          // Only stop loading if we were loading (though usually handled by init)
          setLoading(false); 
        }
      }
    });

    return () => {
      mounted = false;
      clearTimeout(timeoutId);
      subscription.unsubscribe();
    };
  }, []);

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

  const hasRole = (roles: Role[]) => {
    if (!user) return false;
    if (user.role === Role.ADMIN) return true;
    return roles.includes(user.role);
  };

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
