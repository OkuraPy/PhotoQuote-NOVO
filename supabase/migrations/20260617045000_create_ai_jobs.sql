-- Log of every ai-estimate call (written by the Edge Function via service role) so AI failures
-- ("the estimate sometimes breaks") can be diagnosed: status, model, duration, tokens, error.
CREATE TABLE IF NOT EXISTS public.ai_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  status text NOT NULL,                 -- 'done' | 'rejected' | 'error'
  model text,
  photo_count int,
  duration_ms int,
  output_tokens int,
  error text,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.ai_jobs ENABLE ROW LEVEL SECURITY;
-- written by the Edge Function (service role bypasses RLS); the owner can read their own logs
CREATE POLICY "Users read own ai jobs" ON public.ai_jobs FOR SELECT USING (user_id = auth.uid());
CREATE INDEX IF NOT EXISTS idx_ai_jobs_user_created ON public.ai_jobs (user_id, created_at DESC);
