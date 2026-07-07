-- Flexible payment (F12 MVP): today an invoice is a frozen copy of the estimate with a single
-- hardcoded Net-15 due date, an int deposit_percent and a binary Unpaid→Paid status. This adds:
--   1) invoices.payment_mode / due_date / deposit_amount — the plan the contractor picked
--      ('full' = one payment, 'deposit' = down payment + balance, 'installments' = N parts);
--   2) invoice_schedule — the agreed installment rows (label, amount, due date, optional phase);
--   3) invoice_payments — a ledger of money actually received (balance = total − Σ payments,
--      status derived from it: Unpaid / Partially Paid / Paid).
-- Everything is additive; legacy invoices are backfilled below (no ledger rows are fabricated).

alter table public.invoices add column if not exists payment_mode text not null default 'full';
alter table public.invoices add column if not exists due_date date;
alter table public.invoices add column if not exists deposit_amount numeric(12,2);

-- constraints guarded so the migration stays re-runnable
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_payment_mode_check' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_payment_mode_check check (payment_mode in ('full', 'deposit', 'installments'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'invoices_deposit_amount_check' and conrelid = 'public.invoices'::regclass
  ) then
    alter table public.invoices
      add constraint invoices_deposit_amount_check check (deposit_amount is null or deposit_amount >= 0);
  end if;
end $$;

comment on column public.invoices.payment_mode is
  'How the invoice is to be paid: full (one payment), deposit (down payment + balance) or installments (rows in invoice_schedule). Amounts are portions of the TOTAL — tax is already inside, never re-taxed.';
comment on column public.invoices.due_date is
  'Date-only due date. full/deposit: when the (first) payment is due; installments: when the LAST installment is due. Replaces the old hardcoded Net-15 shown by the UI.';
comment on column public.invoices.deposit_amount is
  'Deposit resolved to dollars (deposit mode only). deposit_percent stays as metadata ONLY when the deposit was entered as a % — an absolute-$ deposit keeps it null.';

-- ---------------- installment schedule (the agreed plan) ----------------
create table if not exists public.invoice_schedule (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null,
  label text not null default '',
  amount numeric(12,2) not null check (amount >= 0),
  due_date date,
  phase_id uuid references public.project_phases(id) on delete set null,
  sort int not null default 0,
  created_at timestamptz default now()
);
create index if not exists idx_invoice_schedule_invoice on public.invoice_schedule (invoice_id);

comment on table public.invoice_schedule is
  'One row per agreed installment of an invoice (payment_mode = installments). Rows must sum to invoices.total. label is stored in ENGLISH (client-facing documents are always English; the app UI translates its own display).';
comment on column public.invoice_schedule.due_date is
  'Date-only. NULL = due upon completion (rendered as such in documents).';
comment on column public.invoice_schedule.phase_id is
  'Optional link to a work phase ("due when phase X is done"); kept nullable and SET NULL on phase delete.';

-- ---------------- payments ledger (money actually received) ----------------
create table if not exists public.invoice_payments (
  id uuid primary key default gen_random_uuid(),
  invoice_id uuid not null references public.invoices(id) on delete cascade,
  user_id uuid not null,
  schedule_id uuid references public.invoice_schedule(id) on delete set null,
  amount numeric(12,2) not null check (amount > 0),
  paid_at date not null default current_date,
  method text,
  note text,
  created_at timestamptz default now()
);
create index if not exists idx_invoice_payments_invoice on public.invoice_payments (invoice_id);

comment on table public.invoice_payments is
  'Ledger of received payments. Balance = invoices.total − Σ(amount); invoices.status is derived from it (Unpaid / Partially Paid / Paid). Legacy invoices marked Paid before this table existed have NO rows here — the app treats them as fully paid.';
comment on column public.invoice_payments.method is
  'Free-form method key written by the app in English (Cash / Check / Card / ACH / Other).';

-- ---------------- RLS: strictly own rows ----------------
alter table public.invoice_schedule enable row level security;
alter table public.invoice_payments enable row level security;

drop policy if exists "Users manage own schedule rows" on public.invoice_schedule;
create policy "Users manage own schedule rows" on public.invoice_schedule
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

drop policy if exists "Users manage own invoice payments" on public.invoice_payments;
create policy "Users manage own invoice payments" on public.invoice_payments
  for all to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

grant select, insert, update, delete on public.invoice_schedule to authenticated;
grant select, insert, update, delete on public.invoice_payments to authenticated;

-- ---------------- backfill legacy invoices ----------------
-- due_date is brand new, so "due_date is null" = every pre-F12 row. Old rows with a deposit %
-- become mode 'deposit' (amount materialized from the frozen total); the rest are 'full'.
-- The old UI displayed Net-15 from creation — persist that so documents keep saying the same.
-- No invoice_payments rows are fabricated: a legacy 'Paid' status stands on its own.
update public.invoices
set payment_mode = case when coalesce(deposit_percent, 0) > 0 then 'deposit' else 'full' end,
    deposit_amount = case when coalesce(deposit_percent, 0) > 0 then round(total * deposit_percent / 100.0, 2) else null end,
    due_date = coalesce(due_date, created_at::date + 15)
where due_date is null;
