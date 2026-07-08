# Feedback do usuário real — Gladson (Floor2You) — 07/07/2026

Primeira rodada de uso REAL do v2 com cliente de verdade (job de demolição, Miami/Boca Raton FL,
$940.90, cliente "Novo Cliente"/Reche Group INC). Fluxo completo executado no mesmo dia em que as
Ondas 2-3 foram entregues: foto → orçamento IA → edição → envio → aprovação → fatura com
entrada+saldo (F12) → contrato com cronograma de 4 parcelas assinado no portal → 2 pagamentos
registrados no ledger (Cash $500 + Check $100, saldo $340.90). Fonte: 12 áudios + 10 prints
encaminhados pelo dono via WhatsApp (transcritos via Groq/Whisper).

**Elogios**: fluxo foto-primeiro ("tira foto, já faz na hora, edita, mostra pro cliente ali; esse
fluxo vai ser muito melhor"); rastreio de pagamentos na tela ("tá bonitinho, tá legal").

## Bugs observados em uso real

| # | Bug | Evidência | Nota técnica |
|---|-----|-----------|--------------|
| B1 | **Foto de progresso não sobe** — "Upload failed. No photos were added." | Print 19:42 + áudio "aqui não está subindo fotos" | `addPhasePhotos` falhou no device (investigar: RLS/bucket `phase-photos`, File API do expo-file-system 19, tamanho, rede). PRIORIDADE 1 — feature client-facing morta. |
| B2 | **Não dá pra reenviar o quote** após 1º envio (nem pra outro canal, nem após editar) | Áudio 19:46 | Depois que o stage avança de Sent, o CTA vira "Mark approved" e não há botão de envio persistente na QuoteTab. Liberar reenvio permanente. |
| B3 | **Envio de fatura só manda TEXTO** — Text/WhatsApp/Email sem opção de anexar PDF | Áudios 19:56/19:59 | Workaround dele: botão PDF → share do iOS. Adicionar escolha PDF×texto no SendSheet (expo-print + expo-sharing já existem). |
| B4 | **Link do contrato assinado é beco sem saída** — só mostra "Agreement Already Signed"; cliente não vê/baixa o documento (e a tela promete "a confirmation copy will be sent") | Print 19:38 + msg 20:37 | Já estava na Onda 4 como "PDF assinado". Portal: página do agreement assinado deve exibir o contract_html + botão de download/print. |
| B5 | **Portal sem saída/navegação** — "não tem como sair desta página; ao sair ir para página da empresa" | Msg do dono | Onda 4 (redesign portal): header com link/branding da empresa. |

## Melhorias pedidas

| # | Pedido | Nota |
|---|--------|------|
| M1 | **Pagamentos detalhados (data · forma · valor) no texto/PDF da fatura** — hoje docs mostram plano + Paid/Balance agregados; a tela mostra o ledger completo | Estender `SendData.payment` com as linhas do ledger (buildHtml/buildText). |
| M2 | **Fases do projeto pré-semeadas do orçamento** — "tudo que foi feito no orçamento já nas fases; aí inclui ou tira" | Ao ativar Progress (ou gerar fatura?), criar `project_phases` a partir dos line items (1 fase/item ou por categoria). Decidir UX com o dono. |

## Contexto do dono (dos áudios de resposta dele)

- **Sem servidor de e-mail transacional ainda** — envio por e-mail é mailto; quando houver servidor, anexar PDF/cópias automáticas.
- **Branding**: amigo designer fará ícones, logo, splash (Apple + Google).
- **Visão: versão WEB completa** — escritório/secretária com níveis de acesso, gestão da obra/financeiro ("sai da categoria de app, vira solução tecnológica de empresa"). Roadmap grande pós-Ondas.

## Validações de campo das entregas de hoje

- F12 ponta a ponta em produção: plano entrada+saldo, edição de plano (contrato guardou snapshot de
  4 parcelas — divergência contrato×fatura prevista na ressalva do revisor aconteceu na prática e o
  cliente não foi impactado), ledger com 2 pagamentos, status parcial, saldo correto ($340.90).
- Parcelas cent-exatas no contrato: 940.90/4 = 235.22×3 + 235.24 (splitInstallments ✓).
- Portal: assinatura + guard de reassinatura OK.
- Pergunta em aberto: Gladson usou túnel (Expo Go) ou TestFlight build 28? (timestamps compatíveis
  com o 28 já disponível).
