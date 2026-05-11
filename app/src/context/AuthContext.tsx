import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../services/supabase';
import { Session, User, AuthError } from '@supabase/supabase-js';
import { CompanyProfile } from './AppContext';
import {
  logLoginAttempt,
  logLoginSuccess,
  logLoginError,
  logSignUpAttempt,
  logSignUpAuthCreated,
  logSignUpProfileCreated,
  logSignUpProfileError,
  logSignUpSuccess,
  logSignUpError,
  logLogoutAttempt,
  logLogoutSuccess,
  logLogoutError,
  logSessionRestored,
  logSessionExpired,
  logAuthStateChange,
} from '../services/authLogger';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (
    email: string,
    password: string,
    companyData: CompanyProfile
  ) => Promise<{ error: AuthError | null; requiresEmailConfirmation: boolean }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

// ═══ MAINTENANCE MODE — set to true to disable all access ═══
const MAINTENANCE_MODE = false;
const MAINTENANCE_MESSAGE = 'The server is temporarily disabled for maintenance. Please try again later.';

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (MAINTENANCE_MODE) {
      // Force sign out everyone and block access
      supabase.auth.signOut().catch(() => {});
      setUser(null);
      setSession(null);
      setLoading(false);
      return;
    }

    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      if (session?.user) {
        logSessionRestored(session.user.id, session.user.email || '');
      } else {
        logSessionExpired();
      }
      setLoading(false);
    });

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      logAuthStateChange(_event, session?.user?.id);
      setSession(session);
      setUser(session?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    if (MAINTENANCE_MODE) {
      return { error: { message: MAINTENANCE_MESSAGE, status: 503 } as AuthError };
    }
    logLoginAttempt(email);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        logLoginError(email, { message: error.message, status: error.status });
      } else if (data.user) {
        logLoginSuccess(email, data.user.id);
      }
      return { error };
    } catch (error) {
      const authError = error as AuthError;
      logLoginError(email, { message: authError.message });
      return { error: authError };
    }
  };

  const signUp = async (
    email: string,
    password: string,
    companyData: CompanyProfile
  ) => {
    if (MAINTENANCE_MODE) {
      return { error: { message: MAINTENANCE_MESSAGE, status: 503 } as AuthError, requiresEmailConfirmation: false };
    }
    logSignUpAttempt(email, companyData.name);
    try {
      // Create auth user
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
      });

      if (error) {
        logSignUpError(email, { message: error.message, status: error.status });
        return { error, requiresEmailConfirmation: false };
      }

      const requiresEmailConfirmation = !data.session;

      // Create user profile in database
      if (data.user) {
        logSignUpAuthCreated(email, data.user.id);

        const { error: profileError } = await supabase.from('users').insert({
          id: data.user.id,
          email: email,
          company_name: companyData.name,
          company_address: companyData.address,
          company_phone: companyData.phone,
          company_email: companyData.email,
          company_website: companyData.website,
          company_license: companyData.licenseNumber,
          default_city: companyData.city,
          default_state: companyData.state,
          default_zip: companyData.zip,
          logo_url: companyData.logoUri || null,
        });

        if (profileError) {
          logSignUpProfileError(data.user.id, { message: profileError.message, code: profileError.code });
        } else {
          logSignUpProfileCreated(data.user.id, companyData.name);
        }
      }

      logSignUpSuccess(email);
      return { error: null, requiresEmailConfirmation };
    } catch (error) {
      const authError = error as AuthError;
      logSignUpError(email, { message: authError.message });
      return { error: authError, requiresEmailConfirmation: false };
    }
  };

  const signOut = async () => {
    logLogoutAttempt(user?.id || 'desconhecido');
    setLoading(true);
    try {
      await supabase.auth.signOut();
      logLogoutSuccess();
    } catch (error) {
      const err = error as Error;
      logLogoutError({ message: err.message });
    } finally {
      setLoading(false);
    }
  };

  const value = {
    user,
    session,
    loading,
    signIn,
    signUp,
    signOut,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
