import React from 'react';
import { AppRegistry, ScrollView, Text } from 'react-native';

// Boot visor v2. Build 24 still died with the SAME ExceptionsManagerQueue SIGABRT as 23 and the
// v1 visor painted nothing — so the fatal fires OUTSIDE what v1 could catch: either inside the
// top-level `import 'expo'` (which ran before the handler installed) or reported with a falsy
// isFatal that fell through to RN's aborting default handler. v2 closes both holes:
//   • this module imports ONLY react + react-native primitives (loaded by the RN prelude —
//     nothing here can throw); `expo` and the whole app graph initialize lazily inside a
//     try on first render, so ANY module-scope throw is caught and painted;
//   • in release, EVERY error reported before the app mounts is painted (fatal or not);
//     after a successful mount only fatals are, and non-fatals keep the default behavior.
// If a build with this STILL closes instantly, JS never ran at all → pure native crash.
const describeError = (e: any): string => {
  const name = e?.name ? String(e.name) + ': ' : '';
  const msg = e?.message !== undefined ? String(e.message) : String(e);
  const stack = e?.stack ? '\n\n' + String(e.stack) : '';
  return name + msg + stack;
};

// Diagnostics for the error screen: settles whether the embedded config/extra reaches runtime.
const diagnostics = (): string => {
  const parts: string[] = [];
  try {
    const C = require('expo-constants').default;
    parts.push('expoConfig.extra: ' + JSON.stringify(C?.expoConfig?.extra ?? null)?.slice(0, 300));
  } catch (e) {
    parts.push('expo-constants unavailable: ' + String((e as any)?.message || e));
  }
  try {
    const h = (global as any).HermesInternal?.getRuntimeProperties?.();
    if (h) parts.push('hermes: ' + (h['OSS Release Version'] || 'yes'));
  } catch {}
  return parts.join('\n');
};

let paint: ((msg: string) => void) | null = null;
let pending: string | null = null;
let appMounted = false;
const show = (m: string) => {
  if (pending == null) pending = m;
  paint?.(pending);
};

const EU = (global as any).ErrorUtils;
const prevHandler = EU?.getGlobalHandler?.();
EU?.setGlobalHandler?.((e: any, isFatal?: boolean) => {
  try {
    if (!__DEV__ && (isFatal || !appMounted)) {
      show(describeError(e));
      return; // keep the process alive so the error stays readable on screen
    }
  } catch {}
  prevHandler?.(e, isFatal);
});

function Root() {
  // synchronous on first render: the entire app module graph (expo included) initializes inside
  // this try — a module-scope throw lands on the error screen instead of aborting the process.
  // Build 25 painted `require('./App')` returning UNDEFINED in the release bundle (fine in Expo
  // Go; the factory exists in the bundle) — so probe BOTH the deep path and the root wrapper,
  // use whichever yields a component, and paint typeof/keys of each when neither does.
  const [boot] = React.useState(() => {
    // metro-runtime's guardedLoadModule: a require running OUTSIDE the entry init chain routes
    // any factory exception to ErrorUtils.reportFatalError and RETURNS UNDEFINED — that was the
    // build-25/26 "Cannot read property 'default' of undefined" mask. With ErrorUtils unset for
    // the duration of these requires, metro falls into its rethrow branch and the REAL error
    // (message + stack of the module that actually threw) lands in our catch, synchronously.
    const G: any = global;
    const savedEU = G.ErrorUtils;
    try {
      G.ErrorUtils = undefined;
      require('expo'); // side-effects the expo template entry normally runs first
      const probe: string[] = [];
      const grab = (label: string, load: () => any): React.ComponentType | null => {
        try {
          const mod = load();
          probe.push(`${label}: ${typeof mod}${mod ? ' keys=[' + Object.keys(mod).join(',').slice(0, 80) + ']' : ''}`);
          const C = mod && (mod.default ?? mod);
          return typeof C === 'function' ? (C as React.ComponentType) : null;
        } catch (e) {
          probe.push(`${label} threw: ${describeError(e)}`);
          return null;
        }
      };
      const App = grab('./src/v2/App', () => require('./src/v2/App')) ?? grab('./App', () => require('./App'));
      if (!App) throw new Error('App module resolved empty.\n' + probe.join('\n'));
      return { App, err: null as string | null };
    } catch (e) {
      return { App: null, err: describeError(e) };
    } finally {
      G.ErrorUtils = savedEU;
    }
  });
  // `pending` first: it holds the REAL error metro reported via ErrorUtils (build 25 masked it
  // by giving boot.err precedence — the synthetic "resolved empty" hid the actual exception)
  const [fatal, setFatal] = React.useState<string | null>(
    pending && boot.err ? pending + '\n\n--- boot ---\n' + boot.err : pending ?? boot.err
  );
  React.useEffect(() => {
    paint = (m) => setFatal((cur) => cur ?? m);
    if (!boot.err) appMounted = true;
    return () => {
      paint = null;
    };
  }, [boot.err]);
  if (fatal) {
    return React.createElement(
      ScrollView,
      {
        style: { flex: 1, backgroundColor: '#7F1D1D' },
        contentContainerStyle: { padding: 24, paddingTop: 80, paddingBottom: 60 },
      },
      React.createElement(
        Text,
        { style: { color: '#FFFFFF', fontSize: 17, fontWeight: '700' as const, marginBottom: 12 }, selectable: true },
        'PhotoQuote — startup error'
      ),
      React.createElement(
        Text,
        { style: { color: '#FECACA', fontSize: 12, lineHeight: 17 }, selectable: true },
        fatal
      ),
      React.createElement(
        Text,
        { style: { color: '#FCA5A5', fontSize: 11, lineHeight: 15, marginTop: 16 }, selectable: true },
        diagnostics()
      )
    );
  }
  return boot.App ? React.createElement(boot.App) : null;
}

// same registration expo's registerRootComponent performs (AppDelegate moduleName = 'main')
AppRegistry.registerComponent('main', () => Root);
