
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

  const fetchProfile = async (userId: string, email: string) => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single();

      if (data) {
        const appUser: User = {
          id: data.id,
          name: data.name || email.split('@')[0],
          role: data.role as Role,
          avatarInitials: data.avatarInitials || email.substring(0, 2).toUpperCase()
        };
        setUser(appUser);
        return appUser;
      } else {
        // Fallback: If profile row doesn't exist yet, create a temporary user object
        // This prevents the app from being inaccessible if the DB trigger fails
        const fallbackUser: User = {
            id: userId,
            name: email.split('@')[0],
            role: Role.SALES_REP,
            avatarInitials: email.substring(0, 2).toUpperCase()
        };
        setUser(fallbackUser);
        return fallbackUser;
      }
    } catch (err) {
      console.error("Profile fetch error:", err);
      // Even on error, if we have a session, we should probably allow access with defaults,
      // but strictly speaking we need the role. 
      // We'll leave it null here implies "not fully loaded" or "error", 
      // but let's try to recover if it's just a data missing issue.
    }
    return null;
  };

  useEffect(() => {
    let mounted = true;

    const initializeAuth = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
           await fetchProfile(session.user.id, session.user.email!);
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
        // We only trigger fetch if user state isn't already set to this user
        // This reduces redundant fetches, though signIn manual call handles the primary flow
        setUser(prev => {
            if (prev?.id === session.user.id) return prev;
            return prev;
        });
        
        if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
             await fetchProfile(session.user.id, session.user.email!);
        }
      } else {
        if (mounted) {
          setUser(null);
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (!error && data.user) {
        // Critical: Wait for profile to load before returning
        // This ensures the ProtectedRoute sees the authenticated user immediately
        await fetchProfile(data.user.id, data.user.email!);
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
        await fetchProfile(data.user.id, data.user.email!);
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
