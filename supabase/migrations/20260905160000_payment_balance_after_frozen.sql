-- O recibo tem que ser um retrato, não uma consulta ao vivo.
-- O saldo impresso era recalculado a cada emissão, e duas coisas passaram a mudá-lo depois de o
-- cliente já estar com o papel na mão: um pagamento lançado com data retroativa (que reordena o
-- ledger) e um abatimento lançado depois. Corrigimos o sintoma duas vezes; a causa é não haver
-- retrato. Esta coluna congela o saldo no momento em que o recibo ganha número — o mesmo instante
-- em que ele vira documento. NULL = recibo anterior a isto (ou nunca emitido): o app recalcula,
-- exatamente como fazia, sem back-fill inventando história.
alter table public.invoice_payments add column if not exists balance_after numeric(12,2);

comment on column public.invoice_payments.balance_after is
  'Saldo devido logo apos este pagamento, congelado quando o recibo ganhou numero. NULL = recibo antigo, o app recalcula.';
