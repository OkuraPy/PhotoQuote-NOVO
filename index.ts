import { registerRootComponent } from 'expo';
import React from 'react';
import { ScrollView, Text } from 'react-native';

// Boot visor. Builds 18–23 died silently in TestFlight (white screen or a bare SIGABRT with no
// JS message in the .ips), while the same JS boots fine in Expo Go — so the failure lives in the
// release build layer and the device itself must tell us what threw. This captures BOTH failure
// shapes and paints the error on screen:
//   • a module-init throw anywhere in the App import chain (the require below),
//   • a later fatal JS error (global handler — in release the default handler aborts before
//     anything paints, so we swallow fatals and show them instead; dev keeps the RedBox).
// If the screen STILL goes white with this in place, the JS bundle never executed at all —
// that means native layer, not JS. Harmless to keep in production: it only shows on fatals.
let bootError: unknown = null;
let App: React.ComponentType | null = null;
try {
  App = require('./App').default;
} catch (e) {
  bootError = e;
}

const describeError = (e: any): string => {
  const name = e?.name ? String(e.name) + ': ' : '';
  const msg = e?.message !== undefined ? String(e.message) : String(e);
  const stack = e?.stack ? '\n\n' + String(e.stack) : '';
  return name + msg + stack;
};

let showFatal: ((text: string) => void) | null = null;
const EU = (global as any).ErrorUtils;
const prevHandler = EU?.getGlobalHandler?.();
EU?.setGlobalHandler?.((e: any, isFatal?: boolean) => {
  try {
    if (isFatal && !__DEV__) {
      showFatal?.(describeError(e));
      return; // keep the process alive so the error stays readable on screen
    }
  } catch {}
  prevHandler?.(e, isFatal);
});

function Root() {
  const [fatal, setFatal] = React.useState<string | null>(bootError ? describeError(bootError) : null);
  React.useEffect(() => {
    showFatal = (t) => setFatal((cur) => cur ?? t);
    return () => {
      showFatal = null;
    };
  }, []);
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
      )
    );
  }
  return App ? React.createElement(App) : null;
}

registerRootComponent(Root);
