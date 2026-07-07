import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';

// The anon key is PUBLIC by design (it ships in every client bundle; RLS guards the data).
// Hardcoded fallbacks matter: in a standalone release build Constants.expoConfig.extra can come
// back empty (the manifest path differs from Expo Go — likelier still since expo-updates was
// removed), and createClient('') THROWS at module scope → the app dies before painting anything
// (the TestFlight white screen). With the fallbacks the client always constructs.
const FALLBACK_URL = 'https://tojgbcwzvijhdmmreqaf.supabase.co';
const FALLBACK_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRvamdiY3d6dmlqaGRtbXJlcWFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM4MjM0ODMsImV4cCI6MjA4OTM5OTQ4M30.hH1cIx_bSvncXlFJZKqUL4459X7vEHTi2tbRuZ55Y6U';

const supabaseUrl = Constants.expoConfig?.extra?.supabaseUrl || FALLBACK_URL;
const supabaseAnonKey = Constants.expoConfig?.extra?.supabaseAnonKey || FALLBACK_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
