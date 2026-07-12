// PhotoQuote v2 — real authentication (Supabase). Lean, no PII logging.
// Onda B: after the session resolves we also load the account's team membership (team_members),
// which decides WHOSE data the app operates on (ownerId) and what the UI may show (role/flags).
import React, { createContext, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { AuthError, Session, User } from '@supabase/supabase-js';
import { canSeeMoney, TeamRole } from '../data';
import { supabase } from './supabase';
import { queryClient } from './query';

type AuthCtx = {
  user: User | null;
  session: Session | null;
  loading: boolean;
  // Team context (Onda B). ownerId is the id every data query is keyed by: the membership's
  // owner for office/field members, the user's own id otherwise. An account with no membership
  // is an 'owner' — the solo account walks EXACTLY the same code paths as before.
  ownerId: string | null;
  role: TeamRole;
  canSeeFinancials: boolean; // owner/office: always; field: the per-member flag
  memberName: string | null; // membership full_name — comment author for members
  refreshMembership: () => Promise<void>;
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

type Membership = { id: string; ownerId: string; role: Exclude<TeamRole, 'owner'>; canSeeFinancials: boolean; fullName: string };

// The signed-in account's own ACTIVE membership (one team per user in the MVP). Relies on the
// bank-side policy "member reads own membership". Any failure degrades to null (= owner mode):
// a member would then just see an empty owner account — the RLS still guards every table.
async function loadMembership(uid: string): Promise<Membership | null> {
  try {
    const { data } = await supabase
      .from('team_members')
      .select('id, owner_id, role, can_see_financials, full_name, status')
      .eq('member_user_id', uid)
      .eq('status', 'active')
      .maybeSingle();
    if (!data?.owner_id) return null;
    return {
      id: data.id,
      ownerId: data.owner_id,
      role: data.role === 'office' ? 'office' : 'field', // anything unexpected = most restrictive
      canSeeFinancials: !!data.can_see_financials,
      fullName: String(data.full_name || ''),
    };
  } catch {
    return null;
  }
}

// never hang on a stalled call — fall back after `ms` (membership: null = owner mode, RLS-safe)
function withTimeout<T>(p: Promise<T>, ms: number, fallback: T): Promise<T> {
  return Promise.race([p, new Promise<T>((resolve) => setTimeout(() => resolve(fallback), ms))]);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [membership, setMembership] = useState<Membership | null>(null);
  const [loading, setLoading] = useState(true);
  // loaded = uid whose membership is IN state; inflight = uid being fetched right now. Two refs
  // on purpose: getSession + the INITIAL_SESSION event both call apply() for the same uid, and a
  // single "requested" ref would let the second call publish the session before the membership
  // landed — flashing the owner UI at a field member.
  const loadedUidRef = useRef<string | null>(null);
  const inflightUidRef = useRef<string | null>(null);

  useEffect(() => {
    let alive = true;
    let settled = false;

    // Session + membership land together (loading stays true until both) so a field member
    // never sees a flash of the owner UI while the membership is still in flight.
    const apply = async (s: Session | null) => {
      const uid = s?.user?.id ?? null;
      if (!uid) {
        loadedUidRef.current = null;
        inflightUidRef.current = null;
        if (!alive) return;
        setMembership(null);
        setSession(null);
        setUser(null);
        settled = true;
        setLoading(false);
        return;
      }
      if (loadedUidRef.current === uid) {
        // same account, membership already in state (TOKEN_REFRESHED…) — just sync the session
        if (!alive) return;
        setSession(s);
        setUser(s!.user);
        settled = true;
        setLoading(false);
        return;
      }
      if (inflightUidRef.current === uid) return; // that load will publish session + membership
      inflightUidRef.current = uid;
      if (alive) setLoading(true); // fresh sign-in: hold the gate while the role resolves
      const m = await withTimeout<Membership | null | 'timeout'>(loadMembership(uid), 4000, 'timeout');
      if (!alive || inflightUidRef.current !== uid) return; // signed out / switched mid-flight
      inflightUidRef.current = null;
      // a timed-out load must NOT mark the uid as loaded — the next auth event (token refresh,
      // app foreground) retries, instead of pinning a field member to an owner-empty session
      // for the rest of the session (reviewer finding A3). RLS keeps the fallback safe either way.
      if (m !== 'timeout') loadedUidRef.current = uid;
      setMembership(m === 'timeout' ? null : m);
      setSession(s);
      setUser(s!.user);
      settled = true;
      setLoading(false);
    };

    supabase.auth
      .getSession()
      .then(({ data }) => {
        void apply(data.session);
      })
      .catch(() => {
        settled = true;
        if (alive) setLoading(false);
      });
    const { data } = supabase.auth.onAuthStateChange((_event, s) => {
      // never run supabase calls synchronously inside the auth callback (supabase-js lock)
      setTimeout(() => {
        void apply(s);
      }, 0);
    });
    // Safety net: never hang on the loading screen if getSession stalls (flaky network); the
    // membership fetch has its own 4s fallback above, so apply() itself can't hang past that.
    const t = setTimeout(() => {
      if (!settled) setLoading(false);
    }, 6000);
    return () => {
      alive = false;
      clearTimeout(t);
      data.subscription.unsubscribe();
    };
  }, []);

  // e.g. the owner flipped a member's can_see_financials — the member pulls the new truth in
  const refreshMembership = async () => {
    const uid = loadedUidRef.current;
    if (!uid) return;
    const m = await loadMembership(uid);
    if (loadedUidRef.current === uid) setMembership(m);
  };

  // Revocations must not wait for an app restart (review finding): whenever the app returns
  // to the foreground, re-pull the membership; if it actually changed (flag flipped, member
  // removed, role changed) also drop the query caches — they hold data from the old reality.
  const membershipKeyRef = useRef('null');
  useEffect(() => {
    membershipKeyRef.current = JSON.stringify(membership);
  }, [membership]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', (st) => {
      if (st !== 'active') return;
      const uid = loadedUidRef.current;
      if (!uid) return;
      void (async () => {
        const m = await loadMembership(uid);
        if (loadedUidRef.current !== uid) return; // signed out / switched while fetching
        if (JSON.stringify(m) !== membershipKeyRef.current) {
          setMembership(m);
          queryClient.clear();
        }
      })();
    });
    return () => sub.remove();
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

  const role: TeamRole = membership ? membership.role : 'owner';
  const ownerId = membership ? membership.ownerId : user?.id ?? null;
  const canSeeFinancials = membership ? canSeeMoney(membership.role, membership.canSeeFinancials) : true;
  const memberName = membership?.fullName || null;

  return (
    <Ctx.Provider
      value={{ user, session, loading, ownerId, role, canSeeFinancials, memberName, refreshMembership, signIn, signUp, resetPassword, updatePassword, signOut }}
    >
      {children}
    </Ctx.Provider>
  );
}
