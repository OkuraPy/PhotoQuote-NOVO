# Captura Round 2 — 11/07/2026 (dono + Gladson, 08-09/07)

**Modo combinado com o dono**: capturar → estudar MUITO → criar plano → aprovar → só então implementar.
NADA deste documento foi implementado. Fontes: 2 áudios do dono (11/07) + 11 áudios novos do Gladson
(08-09/07) + PDF da fatura real + 6 prints de pricing do CompanyCam + material re-encaminhado de 07/07
(já processado em `FEEDBACK_GLADSON_2026-07-07.md`).

## 0. Já resolvido (builds 29/30 de 08/07 — dono/Gladson provavelmente ainda não viram)
- ✅ Reenviar orçamento (inclusive após editar; PDF sai atualizado — pedido D4/queixa 19:46 de 07/07)
- ✅ "Send as PDF" como 1ª opção do envio (compartilha o arquivo)
- ✅ Pagamentos detalhados (data · método · valor) no PDF/texto da fatura
- ✅ Upload de fotos (progress + projeto + logo) — consertado no banco, vale p/ build 28+
→ **Ação: avisar que atualizem pro build 30 no TestFlight.**

## 1. Novos pedidos do GLADSON (uso real)

| # | Pedido | Detalhe | Nota técnica preliminar |
|---|--------|---------|-------------------------|
| G1 | **Observações no orçamento e no contrato** | Campo livre na geração ("ao abrir o piso, custos extras podem ser cobrados"); futuramente biblioteca de cláusulas prontas | Colunas notes já existem parcialmente (estimate_notes); falta UI + impressão no PDF/contrato |
| G1b | **IA traduz a observação** | Empreiteiro fala/escreve em PT (ou qualquer língua) → IA gera o inglês pro documento → mostra os dois → ele confirma | Casa com a regra "cliente vê inglês"; Edge Function nova ou extensão da ai-estimate |
| G2 | **Fotos do local NO documento do orçamento** | Viu em orçamento de concorrente e aprovou | buildHtml já tem as URLs públicas (projects.photo_urls) — embutir <img> no PDF |
| G2b | **Curadoria de fotos** | Tira 30, escolhe as 4-5 que entram no orçamento/documento | Selector na EstimateScreen/QuoteTab; flag por foto |
| G3 | **Recibo automático de pagamento** | Ao registrar pagamento → gerar recibo e enviar ao cliente; ele tem modelos de um app de invoice que usa | Template de recibo (buildHtml novo) + share; "enviar automático" depende de servidor de e-mail (pendência conhecida) |
| G4 | **Fases pré-semeadas do orçamento** (reforço do M2 de 07/07) | Ao gerar fatura (ou cotação), fases nascem dos line items; tirar item → tira fase; **o v1 fazia isso** ("o primeiro jogava todas as fases lá") | Olhar App.legacy.tsx como referência de UX; decidir gatilho (invoice? approve?) |
| G5 | **Endereço da OBRA no documento** | Orçamento sai com endereço do contractor/cadastro do cliente, mas a OBRA pode ser em outro lugar (cliente com várias casas) | projects já tem address/city+zip do fluxo; falta capturar ENDEREÇO COMPLETO da obra (rua/nº) e imprimir como "Job site" no PDF/fatura/contrato |
| G6 | Portal: sair da página / VER e BAIXAR o contrato assinado (reenviar link mostra só "já assinou") | Reforço dos B4/B5 de 07/07 | Já no backlog da Onda 4 |

## 2. Pontos do DONO

| # | Ponto | Detalhe | Natureza |
|---|-------|---------|----------|
| D1 | **Multi-usuário / equipe** | Conta da empresa + contas de funcionários; peão de campo: vê SÓ as obras em que foi adicionado + atualiza andamento/fotos; decidir se vê valores (níveis de permissão); "estudar muito como fazer da melhor forma" | ESTRUTURAL (auth, RLS por empresa vs por usuário — hoje TUDO é user_id!, convites, papéis). Conecta com a visão da versão WEB (secretária/escritório). É a fundação multi-tenant → desenhar UMA vez para app+web |
| D2 | **Múltiplos endereços/obras por cliente** | Cliente pede orçamento p/ 4-5 lugares | Junto com G5: endereço vira atributo DO JOB (não do cliente); cliente N jobs já existe |
| D3 | **Planos/pricing do produto** | Mandou pricing do CompanyCam como referência (Core $63-79/1 usuário · Crew $119-149/3 · Scale $199-249/3; +$29-34/usuário extra; anual vs mensal) e quer SIMPLIFICAR ("tá muito complexo") | Estudo de empacotamento: sugerir 2-3 planos simples; multi-usuário (D1) vira alavanca de upgrade; requer billing (Stripe/RevenueCat/IAP — estudo) |
| D4 | Editar orçamento → PDF atualizado → reenviar | ✅ JÁ ENTREGUE (build 29/30) | Comunicar |

## 3. Referência de mercado capturada (CompanyCam)
Core $63(anual)/$79(mensal) 1 usuário · Crew $119/$149 3 usuários · Scale $199/$249 3 usuários;
adicional $29(anual)/$34(mensal). Diferenciais por tier: templates, AI actions (20/100/ilimitado),
LiDAR, subcontractor access, assinaturas digitais, dashboards. → Insumo do estudo D3.

## 4. Próximo passo proposto (aguardando OK do dono)
Preparar o **ESTUDO** em documento único com: (a) arquitetura multi-usuário/permissões (fundação
app+web, migração do modelo user_id→company_id, papéis MVP: dono/escritório/campo); (b) modelo de
endereço da obra (G5/D2); (c) specs curtas dos G1-G3 (observações+IA, fotos no doc, recibo);
(d) proposta de planos simplificada (2-3 tiers) com comparativo vs CompanyCam; (e) divisão em ondas
com esforço estimado. Depois do OK: plano vira execução no protocolo padrão (implementador + revisor).
