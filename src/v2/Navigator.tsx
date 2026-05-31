// PhotoQuote v2 — lightweight navigation stack + bottom tabs + shared store
// (mirrors the handoff app/app.jsx nav model; React Navigation can replace this when wiring data/deep-links)
import React, { useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from './theme';
import { ESTIMATE_ITEMS } from './data';
import { StoreCtx, TabBar, V2Store } from './ui';
import { ForgotScreen, LoginScreen, OnboardScreen, SignupScreen } from './screens/Auth';
import { ClientsScreen, HomeScreen, JobsScreen, ProfileScreen } from './screens/Tabs';
import { AttachScreen, CameraScreen, EstimateScreen } from './screens/Flow';
import { JobScreen } from './screens/Job';
import { ClientEditScreen, ClientScreen, CompanyScreen } from './screens/Misc';

const SCREENS: Record<string, React.ComponentType<any>> = {
  login: LoginScreen,
  signup: SignupScreen,
  onboard: OnboardScreen,
  forgot: ForgotScreen,
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
};

const TAB_ROOTS = ['home', 'jobs', 'clients', 'profile'];
const FULLBLEED = ['camera'];

const initStore = (): V2Store => ({
  photos: [0, 1, 2, 3],
  svcs: ['Painting'],
  descText: '',
  voice: null,
  items: ESTIMATE_ITEMS.map((x) => ({ ...x })),
  taxRate: 8.25,
  marginRate: 0,
  editing: null,
  aQ: '',
  aSel: null,
  aZip: '',
  aLoc: null,
  jobTab: 'quote',
  sheet: false,
  stageOverride: {},
  jobFilter: 'All',
  jobQ: '',
  clientQ: '',
});

type Route = { name: string; params?: any };

export function Navigator() {
  const [stack, setStack] = useState<Route[]>([{ name: 'login', params: {} }]);
  const [store, setStore] = useState<V2Store>(initStore);

  const up = (patch: Partial<V2Store> | ((s: V2Store) => Partial<V2Store>)) =>
    setStore((s) => ({ ...s, ...(typeof patch === 'function' ? patch(s) : patch) }));

  const go = (name: string, params: any = {}, mode?: string) => {
    if (mode === 'reset') {
      setStore(initStore());
      setStack([{ name, params }]);
      return;
    }
    if (name === 'camera') {
      up({ photos: [0, 1, 2, 3], svcs: ['Painting'], descText: '', voice: null, items: ESTIMATE_ITEMS.map((x) => ({ ...x })), taxRate: 8.25, marginRate: 0 });
    }
    if (name === 'job') up({ jobTab: (params && params.tab) || 'quote', sheet: false });
    if (mode === 'tab') setStack([{ name, params }]);
    else setStack((s) => [...s, { name, params }]);
  };
  const back = () => setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));

  const top = stack[stack.length - 1];
  const Comp = SCREENS[top.name] || HomeScreen;
  const showTabs = stack.length === 1 && TAB_ROOTS.includes(top.name);
  const fullbleed = FULLBLEED.includes(top.name);
  const nav = { go, back, params: top.params };

  return (
    <StoreCtx.Provider value={{ store, up }}>
      <StatusBar style={fullbleed ? 'light' : 'dark'} />
      <SafeAreaView style={{ flex: 1, backgroundColor: fullbleed ? '#0C1116' : colors.bg }} edges={fullbleed ? ['bottom'] : ['top', 'bottom']}>
        <View style={{ flex: 1 }}>
          <Comp {...nav} />
          {showTabs ? <TabBar active={top.name} onNav={(k) => go(k, {}, 'tab')} /> : null}
        </View>
      </SafeAreaView>
    </StoreCtx.Provider>
  );
}
