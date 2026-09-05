-- Hard cap in the database: total credits on an invoice can never exceed what is still owed.
-- The app checks this before inserting, but two credits recorded at the same moment (two devices,
-- a double tap) both read the same "room" and both pass. Money must not depend on that race:
-- 2 x $200 on a $580.55 invoice with $290.27 paid would over-credit $109.72 and mark it Paid.
create or replace function public.check_invoice_credit_cap()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_total numeric(12,2);
  v_paid numeric(12,2);
  v_credits numeric(12,2);
begin
  select coalesce(total, 0) into v_total from public.invoices where id = new.invoice_id;
  if v_total is null then
    raise exception 'Invoice not found';
  end if;

  select coalesce(sum(amount), 0) into v_paid from public.invoice_payments where invoice_id = new.invoice_id;
  select coalesce(sum(amount), 0) into v_credits
    from public.invoice_credits
    where invoice_id = new.invoice_id and id <> new.id;

  if v_credits + new.amount > v_total - v_paid + 0.005 then
    raise exception 'Credit exceeds the open balance on this invoice (max %)',
      round(greatest(v_total - v_paid - v_credits, 0), 2);
  end if;

  return new;
end;
$$;

drop trigger if exists trg_invoice_credit_cap on public.invoice_credits;
create trigger trg_invoice_credit_cap
  before insert or update on public.invoice_credits
  for each row execute function public.check_invoice_credit_cap();
