import 'dotenv/config';

export default ({ config }) => {
  // EXPO_GO_DEV=1 strips EAS/expo-updates config that forces Expo-account auth on the dev manifest
  // (so the app can run in Expo Go via a plain tunnel). Production builds leave EXPO_GO_DEV unset → full config.
  const goDev = process.env.EXPO_GO_DEV === '1';
  const base = { ...config };
  if (goDev) {
    delete base.updates;
    delete base.runtimeVersion;
    delete base.owner;
  }

  const extra = {
    ...config.extra,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  };
  if (!goDev) {
    extra.eas = { projectId: '08ab6d86-7294-4799-82a5-6e71c9c04c8f' };
  }

  return {
    ...base,
    plugins: [
      ...(base.plugins || []),
      'expo-font',
    ],
    extra,
  };
};
