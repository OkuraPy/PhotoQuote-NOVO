// PhotoQuote v2 — app root: fonts → providers (React Query + Auth) → navigator.
// Instrumented: an ErrorBoundary renders a readable message instead of a white screen,
// and font loading falls back after a short timeout so the app never blocks forever on it.
import React from 'react';
import { ActivityIndicator, ScrollView, Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClientProvider } from '@tanstack/react-query';
import {
  useFonts,
  Manrope_400Regular,
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { SpaceGrotesk_500Medium, SpaceGrotesk_600SemiBold } from '@expo-google-fonts/space-grotesk';
import { colors } from './theme';
import { Navigator } from './Navigator';
import { AuthProvider } from './lib/auth';
import { I18nProvider } from './lib/i18n';
import { queryClient } from './lib/query';

// Catches render-time errors anywhere below and shows the message on screen (no white screen).
class ErrorBoundary extends React.Component<{ children: React.ReactNode }, { error: Error | null }> {
  state: { error: Error | null } = { error: null };
  static getDerivedStateFromError(error: Error) {
    return { error };
  }
  render() {
    const e = this.state.error;
    if (e) {
      return (
        <View style={{ flex: 1, backgroundColor: '#FBE7E7' }}>
          <ScrollView contentContainerStyle={{ padding: 28, paddingTop: 80 }}>
            <Text style={{ color: '#B00020', fontSize: 18, fontWeight: 'bold', marginBottom: 12 }}>App error</Text>
            <Text style={{ color: '#401010', fontSize: 14, marginBottom: 14 }}>{String(e.message || e)}</Text>
            <Text style={{ color: '#703030', fontSize: 11 }}>{String(e.stack || '').slice(0, 1400)}</Text>
          </ScrollView>
        </View>
      );
    }
    return this.props.children as React.ReactElement;
  }
}

// Colored loading screen with text — distinguishable from a blank white screen.
function Loading({ label }: { label: string }) {
  return (
    <View style={{ flex: 1, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color="#fff" />
      <Text style={{ color: '#fff', marginTop: 14, fontSize: 14 }}>{label}</Text>
    </View>
  );
}

export default function V2App() {
  console.log('[BOOT] V2App render; colors.primary=', colors?.primary);
  const [loaded, error] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  console.log('[BOOT] fonts loaded=', loaded, 'fontError=', !!error);
  const [timedOut, setTimedOut] = React.useState(false);
  React.useEffect(() => {
    const id = setTimeout(() => setTimedOut(true), 4000);
    return () => clearTimeout(id);
  }, []);
  // Render once fonts are ready OR after a short timeout / on font error — never block forever.
  if (!loaded && !timedOut && !error) return <Loading label="Starting…" />;
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <AuthProvider>
          <I18nProvider>
            <SafeAreaProvider>
              <Navigator />
            </SafeAreaProvider>
          </I18nProvider>
        </AuthProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}
