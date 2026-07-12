// PhotoQuote v2 — auth gate + lightweight navigation stacks + shared store.
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, BackHandler, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { FLOW_RESET, StoreCtx, TabBar, V2Store } from './ui';
import { registerStrings, translate } from './lib/i18n';
import { useAuth } from './lib/auth';
import { ForgotScreen, LoginScreen, OnboardScreen, SignupScreen } from './screens/Auth';
import { ClientsScreen, HomeScreen, JobsScreen, ProfileScreen } from './screens/Tabs';
import { AttachScreen, CameraScreen, EstimateScreen } from './screens/Flow';
import { JobScreen } from './screens/Job';
import { ChangePasswordScreen, ClientEditScreen, ClientScreen, CompanyScreen, LanguageScreen } from './screens/Misc';
import { TeamScreen } from './screens/Team';
import { PlansScreen } from './screens/Plans';

registerStrings({
  'nav.connecting': { en: 'Connecting…', es: 'Conectando…', pt: 'Conectando…' },
});

const AUTH_SCREENS: Record<string, React.ComponentType<any>> = {
  login: LoginScreen,
  signup: SignupScreen,
  forgot: ForgotScreen,
  onboard: OnboardScreen,
};
const APP_SCREENS: Record<string, React.ComponentType<any>> = {
  home: HomeScreen,
  jobs: JobsScreen,
  clients: ClientsScreen,
  profile: ProfileScreen,
  camera: CameraScreen,
  estimate: EstimateScreen,
  attach: AttachScreen,
  job: JobScreen,
  client: ClientScreen,
  clientEdit: ClientEditScreen,
  profileCompany: CompanyScreen,
  changePassword: ChangePasswordScreen,
  language: LanguageScreen,
  team: TeamScreen,
  plans: PlansScreen,
};
const TAB_ROOTS = ['home', 'jobs', 'clients', 'profile'];
const FULLBLEED = ['camera'];

const initStore = (): V2Store => ({
  ...FLOW_RESET,
  jobTab: 'quote',
  sheet: false,
  stageOverride: {},
  jobFilter: 'All',
  jobQ: '',
  clientQ: '',
});

type Route = { name: string; params?: any };

// generic stack hook used by both flows
function useStack(initial: string) {
  const [stack, setStack] = useState<Route[]>([{ name: initial, params: {} }]);
  // Android hardware back: pop the stack; at a root return false so the system
  // minimizes the app. Re-registered when canPop flips, so the check is never stale.
  // (The Sheet's Modal intercepts back natively via onRequestClose while open.)
  const canPop = stack.length > 1;
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!canPop) return false;
      setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
      return true;
    });
    return () => sub.remove();
  }, [canPop]);
  return {
    stack,
    setStack,
    top: stack[stack.length - 1],
    back: () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s)),
  };
}

/* ---------- logged-out flow ---------- */
function AuthFlow() {
  const { stack, setStack, top, back } = useStack('login');
  const go = (name: string, params: any = {}) => setStack((s) => [...s, { name, params }]);
  const Comp = AUTH_SCREENS[top.name] || LoginScreen;
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top', 'bottom']}>
      <StatusBar style="dark" />
      <Comp go={go} back={back} params={top.params} />
    </SafeAreaView>
  );
}

/* ---------- logged-in flow ---------- */
function AppFlow() {
  const { stack, setStack, top, back } = useStack('home');
  const { role } = useAuth(); // field members don't get the Clients tab (RLS hides clients anyway)
  const [store, setStore] = useState<V2Store>(initStore);
  // stable `up` + memoized context value: a store write re-renders the top screen once, and
  // nav-only re-renders don't churn the context identity (typing used to re-render everything)
  const up = useCallback(
    (patch: Partial<V2Store> | ((s: V2Store) => Partial<V2Store>)) =>
      setStore((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) })),
    []
  );

  const go = (name: string, params: any = {}, mode?: string) => {
    // fresh capture session — clear any prior photos / AI estimate / client / location
    if (name === 'camera') up(FLOW_RESET);
    if (name === 'job') up({ jobTab: (params && params.tab) || 'quote', sheet: false });
    if (mode === 'tab') setStack([{ name, params }]);
    // 'reset': job saved — stack becomes [home, job] so back never re-enters the finished flow
    else if (mode === 'reset') setStack([{ name: 'home', params: {} }, { name, params }]);
    else setStack((s) => [...s, { name, params }]);
  };

  const Comp = APP_SCREENS[top.name] || HomeScreen;
  const showTabs = stack.length === 1 && TAB_ROOTS.includes(top.name);
  const fullbleed = FULLBLEED.includes(top.name);
  const ctx = useMemo(() => ({ store, up }), [store, up]);

  return (
    <StoreCtx.Provider value={ctx}>
      <StatusBar style={fullbleed ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: fullbleed ? '#0C1116' : colors.bg }} edges={fullbleed ? ['bottom'] : showTabs ? ['top'] : ['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <Comp go={go} back={back} params={top.params} />
          {showTabs ? <TabBar active={top.name} onNav={(k) => go(k, {}, 'tab')} hidden={role === 'field' ? ['clients'] : undefined} /> : null}
        </View>
      </SafeAreaView>
    </StoreCtx.Provider>
  );
}

export function Navigator() {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
        <Text style={{ color: '#fff', marginTop: 14, fontSize: 14 }}>{translate('nav.connecting')}</Text>
      </View>
    );
  }
  return session ? <AppFlow /> : <AuthFlow />;
}
