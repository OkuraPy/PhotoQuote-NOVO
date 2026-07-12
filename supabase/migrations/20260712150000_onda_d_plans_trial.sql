-- ONDA D — fundação de planos/monetização (modelo aprovado pelo dono no ESTUDO §4/§6):
--   Solo $39/mês ($29/mês no anual) · 1 usuário
--   Team $99/mês ($79/mês no anual) · 3 assentos inclusos · +$19/assento extra
--   Entrada: trial de 14 dias SEM cartão (contas novas).
-- Nada aqui cobra ninguém: billing real (RevenueCat/IAP) entra na build da loja.
-- Os 2 usuários reais existentes ficam como estão (status 'active', sem plano) —
-- o app trata 'active' como sem-bloqueio; trial/banner é só para contas novas.

-- aposenta os planos legados do v1 (Free/Pro/Enterprise nunca foram usados: plan_id nulo em todos)
update public.subscription_plans set is_active = false, updated_at = now()
 where name in ('Free', 'Pro', 'Enterprise');

insert into public.subscription_plans (name, price_monthly, price_yearly, features, is_active)
select 'Solo', 39, 348,
       jsonb_build_object('seats', 1, 'trial_days', 14, 'annual_monthly_equivalent', 29),
       true
 where not exists (select 1 from public.subscription_plans where name = 'Solo');

insert into public.subscription_plans (name, price_monthly, price_yearly, features, is_active)
select 'Team', 99, 948,
       jsonb_build_object('seats', 3, 'extra_seat_price_monthly', 19, 'trial_days', 14, 'annual_monthly_equivalent', 79),
       true
 where not exists (select 1 from public.subscription_plans where name = 'Team');

-- contas NOVAS nascem em trial de 14 dias (sem cartão). Linhas pessoais de MEMBROS de equipe
-- (criadas pela create-team-member) também recebem — inócuo: o app fatura pelo OWNER.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public', 'pg_temp'
as $$
begin
  insert into public.users (id, email, company_name, subscription_status, subscription_expires_at)
  values (
    new.id,
    new.email,
    left(coalesce(new.raw_user_meta_data->>'company_name', ''), 120),
    'trial',
    now() + interval '14 days'
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

-- rollback: recriar handle_new_user sem os 2 campos; update subscription_plans set is_active
-- true nos legados / false em Solo-Team.
