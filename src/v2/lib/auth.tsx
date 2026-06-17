// PhotoQuote v2 — real authentication (Supabase). Lean, no PII logging.
import React, { createContext, useContext, useEffect, useState } from 'react';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { supabase } from './supabase';
import { queryClient } from './query';

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: AuthError | null }>;
  signUp: (email: string, password: string, name: string) => Promise<{ error: AuthError | null; needsConfirm: boolean }>;
  resetPassword: (email: string) => Promise<{ error: AuthError | null }>;
  updatePassword: (password: string) => Promise<{ error: AuthError | null }>;
  signOut: () => Promise<void>;
};

const Ctx = createContext<AuthCtx | undefined>(undefined);
export const useAuth = () => {
  const c = useContext(Ctx);
  if (!c) throw new Error('useAuth must be used within <AuthProvider>');
  return c;
};

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      setLoading(false);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
    return { error };
  };

  const signUp = async (email: string, password: string, name: string) => {
    // Pass the company name in user metadata so the handle_new_user trigger creates the profile
    // WITH the name, atomically server-side — works even when email confirmation is on (no session yet).
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { company_name: name.trim() } },
    });
    if (error) return { error, needsConfirm: false };
    // If a session exists right away (email confirmation disabled), make sure the name is set.
    if (data.session && data.user) {
      await supabase.from('users').update({ company_name: name.trim() }).eq('id', data.user.id).then(() => {}, () => {});
    }
    return { error: null, needsConfirm: !data.session };
  };

  const resetPassword = async (email: string) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    return { error };
  };

  const updatePassword = async (password: string) => {
    const { error } = await supabase.auth.updateUser({ password });
    return { error };
  };

  const signOut = async () => {
    setLoading(true);
    await supabase.auth.signOut().catch(() => {});
    queryClient.clear();
    setLoading(false);
  };

  return <Ctx.Provider value={{ user, session, loading, signIn, signUp, resetPassword, updatePassword, signOut }}>{children}</Ctx.Provider>;
}
