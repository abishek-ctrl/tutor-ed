import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

type User = { name: string; email: string };

interface AuthContextType {
  user: User | null;
  login: (userData: User) => void;
  logout: () => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// A new component to wrap the provider and give it access to router hooks
function AuthProviderWithRouter({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate(); // Use the hook here

  useEffect(() => {
    // Check for a logged-in user in localStorage on initial load
    try {
      const cachedUser = localStorage.getItem('ai_tutor_user');
      if (cachedUser) {
        setUser(JSON.parse(cachedUser));
      }
    } catch (error) {
      console.error("Failed to parse user from localStorage", error);
      localStorage.removeItem('ai_tutor_user');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const login = (userData: User) => {
    localStorage.setItem('ai_tutor_user', JSON.stringify(userData));
    setUser(userData);
  };

  const logout = () => {
    localStorage.removeItem('ai_tutor_user');
    setUser(null);
    // Use the navigate function for a smooth, client-side transition
    navigate('/login'); 
  };
  
  return (
    <AuthContext.Provider value={{ user, login, logout, isLoading }}>
      {children}
    </AuthContext.Provider>
  );
}


// The main provider now uses the wrapper
export function AuthProvider({ children }: { children: ReactNode }) {
  return <AuthProviderWithRouter>{children}</AuthProviderWithRouter>;
}


export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
