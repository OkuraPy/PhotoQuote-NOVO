-- Regional construction cost index by US state (national avg = 1.00). Reference data, editable
-- server-side without an app release. Read-only for the app; only admins/SQL write to it.
create table if not exists public.regional_pricing (
  state_code text primary key,
  multiplier numeric not null default 1.0,
  label text not null default 'Average',
  updated_at timestamptz not null default now()
);

alter table public.regional_pricing enable row level security;

drop policy if exists "regional_pricing readable" on public.regional_pricing;
create policy "regional_pricing readable" on public.regional_pricing for select using (true);

grant select on public.regional_pricing to anon, authenticated;

insert into public.regional_pricing (state_code, multiplier, label) values
  ('HI',1.25,'High-cost'),('AK',1.25,'High-cost'),('CA',1.21,'High-cost'),('NY',1.20,'High-cost'),
  ('MA',1.18,'High-cost'),('DC',1.18,'High-cost'),('NJ',1.16,'High-cost'),('CT',1.15,'High-cost'),
  ('WA',1.12,'High-cost'),('RI',1.10,'Above average'),('IL',1.10,'Above average'),('OR',1.08,'Above average'),
  ('MD',1.08,'Above average'),('MN',1.07,'Above average'),('PA',1.06,'Above average'),('NH',1.05,'Above average'),
  ('VT',1.05,'Above average'),('CO',1.05,'Above average'),('MI',1.03,'Above average'),('DE',1.03,'Above average'),
  ('WI',1.02,'Average'),('NV',1.02,'Average'),('ME',1.00,'Average'),('OH',0.99,'Average'),
  ('VA',0.99,'Average'),('AZ',0.98,'Average'),('TX',0.98,'Average'),('UT',0.97,'Average'),
  ('FL',0.97,'Average'),('MO',0.96,'Average'),('IN',0.96,'Average'),('GA',0.95,'Below average'),
  ('IA',0.95,'Below average'),('MT',0.95,'Below average'),('WY',0.95,'Below average'),('NC',0.94,'Below average'),
  ('NE',0.94,'Below average'),('KS',0.93,'Below average'),('ND',0.93,'Below average'),('WV',0.93,'Below average'),
  ('NM',0.93,'Below average'),('ID',0.93,'Below average'),('SD',0.92,'Below average'),('TN',0.91,'Below average'),
  ('KY',0.91,'Below average'),('SC',0.91,'Below average'),('LA',0.90,'Below average'),('OK',0.89,'Below average'),
  ('AL',0.88,'Below average'),('AR',0.88,'Below average'),('MS',0.86,'Below average')
on conflict (state_code) do update set multiplier=excluded.multiplier, label=excluded.label, updated_at=now();
