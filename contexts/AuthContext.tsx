
import React, { createContext, useContext, useState, useEffect } from 'react';
import { User, Role } from '../types';
import { UserService } from '../services/store';

interface AuthContextType {
  user: User | null;
  switchUser: (userId: string) => Promise<void>;
  availableUsers: User[];
  hasRole: (roles: Role[]) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [availableUsers, setAvailableUsers] = useState<User[]>([]);

  useEffect(() => {
    const loadUsers = async () => {
      const users = await UserService.getAll();
      setAvailableUsers(users);
      if (users.length > 0 && !user) {
        setUser(users[0]); // Default to first user (Rep)
      }
    };
    loadUsers();
  }, []);

  const switchUser = async (userId: string) => {
    const found = availableUsers.find(u => u.id === userId);
    if (found) setUser(found);
  };

  const hasRole = (roles: Role[]) => {
    if (!user) return false;
    return roles.includes(user.role);
  };

  return (
    <AuthContext.Provider value={{ user, switchUser, availableUsers, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
};
