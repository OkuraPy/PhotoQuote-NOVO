-- Read the company name from the new user's metadata so the profile is created WITH the name,
-- atomically on the server. Fixes the case where email-confirmation is ON and the app's
-- client-side upsert runs without a session (blocked by RLS), leaving company_name=''.
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.users (id, email, company_name)
  VALUES (NEW.id, NEW.email, COALESCE(NEW.raw_user_meta_data->>'company_name', ''))
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$function$;
