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
  // this try — a module-scope throw lands on the error screen instead of aborting the process
  const [boot] = React.useState(() => {
    try {
      require('expo'); // side-effects the expo template entry normally runs first
      return { App: require('./App').default as React.ComponentType, err: null as string | null };
    } catch (e) {
      return { App: null, err: describeError(e) };
    }
  });
  const [fatal, setFatal] = React.useState<string | null>(boot.err ?? pending);
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
