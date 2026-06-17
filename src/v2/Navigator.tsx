// PhotoQuote v2 — auth gate + lightweight navigation stacks + shared store.
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { StoreCtx, TabBar, V2Store } from './ui';
import { useAuth } from './lib/auth';
import { ForgotScreen, LoginScreen, OnboardScreen, SignupScreen } from './screens/Auth';
import { ClientsScreen, HomeScreen, JobsScreen, ProfileScreen } from './screens/Tabs';
import { AttachScreen, CameraScreen, EstimateScreen } from './screens/Flow';
import { JobScreen } from './screens/Job';
import { ChangePasswordScreen, ClientEditScreen, ClientScreen, CompanyScreen, LanguageScreen } from './screens/Misc';

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
};
const TAB_ROOTS = ['home', 'jobs', 'clients', 'profile'];
const FULLBLEED = ['camera'];

const initStore = (): V2Store => ({
  photos: [],
  svcs: [],
  descText: '',
  voice: null,
  items: [],
  confidence: 0,
  aiNotes: '',
  taxRate: 8.25,
  marginRate: 0,
  editing: null,
  aQ: '',
  aSel: null,
  aZip: '',
  aLoc: null,
  regionMult: 1,
  regionState: '',
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
  const [store, setStore] = useState<V2Store>(initStore);
  const up = (patch: Partial<V2Store> | ((s: V2Store) => Partial<V2Store>)) =>
    setStore((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

  const go = (name: string, params: any = {}, mode?: string) => {
    if (name === 'camera') {
      // fresh capture session — clear any prior photos / AI estimate / client / location
      up({ photos: [], svcs: [], descText: '', voice: null, items: [], confidence: 0, aiNotes: '', taxRate: 8.25, marginRate: 0, aSel: null, aQ: '', aZip: '', aLoc: null, regionMult: 1, regionState: '' });
    }
    if (name === 'job') up({ jobTab: (params && params.tab) || 'quote', sheet: false });
    if (mode === 'tab') setStack([{ name, params }]);
    else setStack((s) => [...s, { name, params }]);
  };

  const Comp = APP_SCREENS[top.name] || HomeScreen;
  const showTabs = stack.length === 1 && TAB_ROOTS.includes(top.name);
  const fullbleed = FULLBLEED.includes(top.name);

  return (
    <StoreCtx.Provider value={{ store, up }}>
      <StatusBar style={fullbleed ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: fullbleed ? '#0C1116' : colors.bg }} edges={fullbleed ? ['bottom'] : ['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <Comp go={go} back={back} params={top.params} />
          {showTabs ? <TabBar active={top.name} onNav={(k) => go(k, {}, 'tab')} /> : null}
        </View>
      </SafeAreaView>
    </StoreCtx.Provider>
  );
}

export function Navigator() {
  const { session, loading } = useAuth();
  console.log('[BOOT] Navigator render; loading=', loading, 'hasSession=', !!session);
  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#fff" />
        <Text style={{ color: '#fff', marginTop: 14, fontSize: 14 }}>Connecting…</Text>
      </View>
    );
  }
  return session ? <AppFlow /> : <AuthFlow />;
}
