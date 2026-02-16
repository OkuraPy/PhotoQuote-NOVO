import 'dotenv/config';

export default ({ config }) => ({
  ...config,
  extra: {
    openaiApiKey: process.env.OPENAI_API_KEY || '',
  },
});
