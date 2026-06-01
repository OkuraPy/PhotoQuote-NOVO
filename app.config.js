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
    // NOTE: openaiApiKey is intentionally NOT exposed to the app. v2 calls OpenAI only through the
    // ai-estimate / transcribe-audio Edge Functions (key stays server-side). Closes audit finding #1
    // (key was shipping in the bundle/manifest). The legacy v1 service is dormant.
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
      ['expo-audio', { microphonePermission: 'Allow PhotoQuote to record voice notes describing the job.' }],
      ['expo-image-picker', { photosPermission: 'Allow PhotoQuote to attach job photos to an estimate.', cameraPermission: 'Allow PhotoQuote to take job photos for an estimate.' }],
      ['expo-location', { locationWhenInUsePermission: 'Allow PhotoQuote to use your location to set the job site.' }],
    ],
    extra,
  };
};
