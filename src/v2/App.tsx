// PhotoQuote v2 — app root: fonts → providers (React Query + Auth) → navigator.
import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
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

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000, refetchOnWindowFocus: false } },
});

function Splash() {
  return (
    <View style={{ flex: 1, backgroundColor: colors.bg, alignItems: 'center', justifyContent: 'center' }}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export default function V2App() {
  const [loaded] = useFonts({
    Manrope_400Regular,
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
    SpaceGrotesk_500Medium,
    SpaceGrotesk_600SemiBold,
  });
  if (!loaded) return <Splash />;
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SafeAreaProvider>
          <Navigator />
        </SafeAreaProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
