-- O contrato é um retrato, como o recibo. O corpo (contract_html) já congela os números na geração,
-- mas o cabeçalho da página de assinatura vinha de uma conta AO VIVO sobre a fatura: abater (ou
-- desfazer um abatimento) depois de assinado mudava o valor exibido acima de um contrato que dizia
-- outro. Esta coluna guarda o total com que o documento foi gerado.
-- NULL = contrato anterior a isto: a RPC cai na conta líquida, como vinha fazendo.
alter table public.agreements add column if not exists total_amount numeric(12,2);

comment on column public.agreements.total_amount is
  'Total com que o contrato foi GERADO (retrato). NULL = contrato antigo, a RPC calcula.';

-- (a redefinição de get_agreement_by_token com coalesce(a.total_amount, líquido) foi aplicada
--  junto desta migration; ver 20260905150000 para a versão anterior da função)
