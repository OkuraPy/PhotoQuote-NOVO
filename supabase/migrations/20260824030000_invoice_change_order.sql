-- Onda G / G-9 — marca de fatura complementar (change order).
--
-- Achado BLOQUEANTE da revisão: uma fatura complementar cobra a DIFERENÇA do orçamento, mas o app
-- montava o documento com `items` (a lista inteira do orçamento) e `totals` da fatura selecionada.
-- O PDF que iria pro cliente ficava assim:
--
--     Labor · work ....... $8,000.00
--     Materials · stuff .. $2,000.00
--                Subtotal   $2,366.40
--                Tax (7%)      $33.60
--                Total      $2,400.00
--
-- As linhas somam $10.000 e o total diz $2.400. Sem uma marca no banco não há como o documento
-- saber que ele cobra um valor acordado em vez dos itens.
--
-- Com a marca, a complementar imprime UMA linha ("Additional work per change order") e a conta
-- fecha: subtotal $2.366,86 + imposto $33,14 (7% sobre a base tributável impressa de $473,37)
-- = $2.400,00 — conferido no banco.
alter table public.invoices
  add column if not exists is_change_order boolean not null default false;

comment on column public.invoices.is_change_order is
  'G-9: true = fatura complementar. Cobra um valor adicional acordado, e por isso imprime UMA linha ("Additional work per change order") em vez dos itens do orçamento.';
