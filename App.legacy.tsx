// LEGACY v1 app entry — kept for reference during the v2 rebuild.
// The active entry (App.tsx) now renders the v2 app (src/v2). Restore this file to App.tsx to run v1.
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider } from './src/context/AuthContext';
import { AppProvider } from './src/context/AppContext';
import AppNavigator from './src/navigation/AppNavigator';

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <SafeAreaProvider>
          <AppNavigator />
          <StatusBar style="auto" />
        </SafeAreaProvider>
      </AppProvider>
    </AuthProvider>
  );
}
