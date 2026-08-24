-- Onda G / G-1 — desconto no orçamento.
--
-- "Internal Markup pra você aumentar pro cliente… mas daí teremos que colocar tipo assim, você
--  colocar menos também, tipo um desconto — às vezes você vai atender um contractor e normalmente
--  é 30% a menos. Mas também teria que ter um campinho pra valor, tipo se quer arredondar: deu
--  1.099, quer deixar 1.000 redondo." (Gladson, 30/07)
--
-- Decisões do dono (24/08): o cliente VÊ o desconto no documento (D1); o imposto incide sobre o
-- valor JÁ descontado (D2); a tela aceita as duas entradas, % e total final (D3).
--
-- POR QUE ISSO É UMA MIGRATION E NÃO SÓ APP: `update_estimate_totals()` recalcula e SOBRESCREVE
-- estimates.total a cada escrita em line_items. Um desconto que existisse só no app seria apagado
-- no próximo toque em qualquer item — é o mesmo formato do bug do imposto zerado de maio.

/* ---------------- colunas ---------------- */
-- Mesmo padrão do sinal do plano de pagamento: o % é a INTENÇÃO (acompanha o subtotal quando um
-- item muda) e o $ é o valor resolvido, que é o que os documentos e a fatura leem.
-- discount_percent = 0 significa "foi digitado em dólares".
alter table public.estimates add column if not exists discount_percent numeric not null default 0;
alter table public.estimates add column if not exists discount_amount  numeric not null default 0;
alter table public.invoices  add column if not exists discount_percent numeric not null default 0;
alter table public.invoices  add column if not exists discount_amount  numeric not null default 0;

alter table public.estimates drop constraint if exists estimates_discount_pct_range;
alter table public.estimates add constraint estimates_discount_pct_range
  check (discount_percent >= 0 and discount_percent <= 100);
alter table public.estimates drop constraint if exists estimates_discount_amt_positive;
alter table public.estimates add constraint estimates_discount_amt_positive
  check (discount_amount >= 0);

alter table public.invoices drop constraint if exists invoices_discount_pct_range;
alter table public.invoices add constraint invoices_discount_pct_range
  check (discount_percent >= 0 and discount_percent <= 100);
alter table public.invoices drop constraint if exists invoices_discount_amt_positive;
alter table public.invoices add constraint invoices_discount_amt_positive
  check (discount_amount >= 0);

comment on column public.estimates.discount_amount is
  'G-1: client-facing discount in dollars, subtracted BEFORE tax. Resolved by update_estimate_totals when discount_percent > 0.';
comment on column public.estimates.discount_percent is
  'G-1: discount typed as a percentage (0 = it was typed in dollars). Follows the subtotal when items change.';

/* ---------------- o gatilho dos totais ---------------- */
-- PROVADO ANTES DE APLICAR (transação com rollback em produção): disparado nos 92 orçamentos
-- reais com desconto zero, NENHUM total, imposto, subtotal ou margem mudou — nem um centavo.
-- Com desconto, os três casos batem com o cálculo de referência:
--   subtotal 6.919,78 · base tributável 2.261,20 · taxa 7%
--   30%    → desconto 2.075,93 · imposto 110,80 · total 4.954,65
--   $1.000 → desconto 1.000,00 · imposto 135,41 · total 6.055,19
--   100% ou $999.999 → desconto = subtotal · imposto 0 · total 0 (nunca negativo)
CREATE OR REPLACE FUNCTION public.update_estimate_totals()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp' AS $function$
DECLARE
  new_subtotal numeric(12,2);
  new_taxable_subtotal numeric(12,2);
  est_rate numeric;
  est_mrate numeric;
  disc_pct numeric;
  disc_amt numeric;
  new_discount numeric(12,2);
  taxable_after numeric(12,2);
  new_tax numeric(12,2);
  new_margin numeric(12,2);
  new_grand_total numeric(12,2);
  target_estimate_id uuid;
BEGIN
  target_estimate_id := COALESCE(NEW.estimate_id, OLD.estimate_id);

  SELECT COALESCE(SUM(COALESCE(li.subtotal, li.total, li.quantity * li.unit_price)), 0)
    INTO new_subtotal
  FROM line_items li
  WHERE li.estimate_id = target_estimate_id;

  SELECT COALESCE(SUM(COALESCE(li.subtotal, li.total, li.quantity * li.unit_price)), 0)
    INTO new_taxable_subtotal
  FROM line_items li
  WHERE li.estimate_id = target_estimate_id
    AND COALESCE(li.taxable, true) = true;

  SELECT COALESCE(tax_rate, tax_percent, 0),
         COALESCE(margin_rate, margin_percent, 0),
         COALESCE(discount_percent, 0),
         COALESCE(discount_amount, 0)
    INTO est_rate, est_mrate, disc_pct, disc_amt
  FROM estimates
  WHERE id = target_estimate_id;

  -- G-1: a PERCENT discount is re-resolved against the current subtotal, so editing an item keeps
  -- a "-30%" honest; a DOLLAR discount stays exactly as typed. Clamped to [0, subtotal] — a
  -- discount can zero a quote, never turn it into a credit.
  IF disc_pct > 0 THEN
    new_discount := new_subtotal * disc_pct / 100;
  ELSE
    new_discount := disc_amt;
  END IF;
  new_discount := GREATEST(0, LEAST(new_discount, new_subtotal));

  -- the discount comes off BEFORE tax (owner's call D2, and the US norm) and shrinks the taxable
  -- base in proportion to how much of the subtotal was taxable in the first place
  IF new_subtotal > 0 THEN
    taxable_after := new_taxable_subtotal * (1 - (new_discount / new_subtotal));
  ELSE
    taxable_after := 0;
  END IF;

  new_tax := taxable_after * (COALESCE(est_rate, 0) / 100);
  -- legacy margin (margin_rate > 0 on old estimates) rides on the discounted base
  new_margin := (new_subtotal - new_discount + new_tax) * (COALESCE(est_mrate, 0) / 100);
  new_grand_total := new_subtotal - new_discount + new_tax + new_margin;

  UPDATE estimates
  SET subtotal = new_subtotal,
      discount_amount = new_discount,
      tax_amount = new_tax,
      tax_rate = est_rate,
      tax_percent = est_rate,
      margin_amount = new_margin,
      margin_rate = est_mrate,
      margin_percent = est_mrate,
      grand_total = new_grand_total,
      total = new_grand_total,
      updated_at = NOW()
  WHERE id = target_estimate_id;

  RETURN COALESCE(NEW, OLD);
END;
$function$;

/* ---------------- o contrato ---------------- */
-- O template do contrato imprime "Subtotal X | Tax Y" ao lado do total. Com desconto esses três
-- números não fecham — documento LEGAL com conta que não bate. O placeholder carrega o próprio
-- separador, então sem desconto a linha sai idêntica à de hoje; e fillTemplate troca placeholder
-- desconhecido por string vazia, então template novo com build antigo é inócuo.
update public.contract_templates
   set content = replace(content, '${{subtotal}} &nbsp;|&nbsp; Tax', '${{subtotal}}{{discount_line}} &nbsp;|&nbsp; Tax')
 where content like '%${{subtotal}} &nbsp;|&nbsp; Tax%';

update public.contract_templates
   set content = replace(content, '${{subtotal}} | Tax', '${{subtotal}}{{discount_line}} | Tax')
 where content like '%${{subtotal}} | Tax%';
