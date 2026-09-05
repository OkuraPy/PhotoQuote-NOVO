-- Conserto do meu próprio back-fill (20260905180000).
-- Eu escrevi que "invoices.total ainda era o número congelado em cada corpo" — e isso é FALSO
-- quando a FATURA foi editada depois de o contrato existir: o corpo guarda o valor de então, e a
-- fatura seguiu em frente. Em 2 dos 30 contratos o número divergia, sendo 1 ASSINADO
-- (INV-2026-0020, Sarah Lazarus: corpo $949.94, congelado $1.347,67 — diferença de $397,73).
-- O retrato tem que ser o que o cliente ASSINOU. Extraído do próprio corpo do contrato.
-- Depois: 29 contratos com valor no corpo, 0 divergentes.
update public.agreements a
   set total_amount = replace((regexp_match(a.contract_html, 'shall be:?\s*<strong>\$([0-9,]+\.[0-9]{2})</strong>'))[1], ',', '')::numeric
 where a.contract_html is not null
   and (regexp_match(a.contract_html, 'shall be:?\s*<strong>\$([0-9,]+\.[0-9]{2})</strong>'))[1] is not null
   and abs(
         coalesce(a.total_amount, -1)
         - replace((regexp_match(a.contract_html, 'shall be:?\s*<strong>\$([0-9,]+\.[0-9]{2})</strong>'))[1], ',', '')::numeric
       ) > 0.005;
