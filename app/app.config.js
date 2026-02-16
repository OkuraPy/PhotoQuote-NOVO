import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
  },
});
