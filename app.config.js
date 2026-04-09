import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  plugins: [
    ...(config.plugins || []),
    "expo-font",
  ],
  extra: {
    ...config.extra,
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    eas: {
      projectId: '08ab6d86-7294-4799-82a5-6e71c9c04c8f',
    },
  },
});
