# Feedback do uso real — Gladson (áudios 30–31/07/2026, repassados 24/08)

9 pontos: 8 áudios do Gladson + 1 áudio do dono (item 9). Ordem do dono: **"coloca todos esses pontos; a gente vai estudar um a um pra arrumar um a um"** — este arquivo é a lista de trabalho. Nada aqui foi implementado ainda.

Base do código: HEAD `3baa0fa` (Onda F + revisão adversarial). Build no TestFlight na época dos áudios: 32/33.

---

## G-1 — Desconto / ajuste para baixo no orçamento (áudio 30/07 12:57)

> "Tem Tax Rate, tem Internal Markup pra aumentar pro cliente… mas tem que poder colocar MENOS também, tipo um desconto, em porcentagem — às vezes você atende um contractor e é 30% a menos. E também um campinho pra valor: deu 1.099, quer deixar 1.000 redondo."

**Hoje:** `Flow.tsx:773-788` (e `Job.tsx:915`) só têm dois steppers — *Tax rate* e *Internal markup*, e o markup é clampado em `Math.max(0, …)` no botão de menos (`Flow.tsx:779`). Markup entra **embutido** no preço unitário (`applyMarkup`), invisível pro cliente.

**Pedido:** (a) ajuste percentual negativo (desconto), (b) ajuste em valor absoluto pra arredondar o total.

**Decisões pendentes:**
- O desconto aparece pro cliente como linha "Discount" no PDF/portal, ou some embutido igual ao markup? (São coisas diferentes: -30% pra contractor costuma ser preço combinado, não desconto exibido; já o arredondamento de $1.099→$1.000 normalmente vira linha ou some no total.)
- Arredondamento: campo de "total final" (digita 1000 e o app deriva o ajuste) ou campo de "desconto em $"?
- Imposto incide antes ou depois do desconto?

**Toca:** `data.ts` (calcTotals/applyMarkup/deriveBase), `Flow.tsx`, `Job.tsx` (QuoteTab + edição), `send.ts` (linha no PDF, se exibido), banco (coluna de desconto em `estimates`/`invoices`), portal.

---

## G-2 — Sem feedback ao subir foto (áudio 31/07 14:15)

> "Quando inclui foto não parece que a foto está sendo carregada. Fica ruim, a pessoa não sabe se está carregando. Alguma coisinha virando, ou uma barrinha."

**Hoje:** existe `photoBusy` no QuoteTab, mas o feedback é fraco/ausente nos pontos onde ele adiciona foto (fases e job). O upload da Onda F já é em lotes de 3 com retry — o que falta é o *indicador*.

**Fazer:** spinner por thumbnail (placeholder com ActivityIndicator enquanto sobe) + contador "3 de 7" quando é lote; desabilitar o botão durante o envio.

**Toca:** `Job.tsx` (fases + QuoteTab), `ui.tsx`.

---

## G-3 — Ver a tela do cliente sem sair do app (áudio 31/07 14:18)

> "Se eu quero clicar pra ver como está a tela do cliente eu não consigo — tenho que mandar pra mim mesmo pra poder enxergar."

**Hoje:** `Job.tsx:1958` só faz `Share.share({ message: CLIENT_SHARE.progress(progressLink(token)) })`. Não existe abrir.

**Fazer:** botão "Ver como o cliente vê" que abre `progressLink(token)` direto (Linking/WebBrowser).

**Toca:** `Job.tsx`, `api.ts` (`progressLink`, `ensureShareToken`).

---

## G-4 — Abrir o contrato pelo app (áudio 31/07 20:37)

> "Pra acessar o contrato eu tenho que enviar o link pra um WhatsApp qualquer, pra mim mesmo, e clicar em cima. Seria bom ter um botão pra ver direto do aplicativo."

**Hoje:** mesma limitação do G-3, no ContractTab ("Share signed link" só compartilha). `agreementLink()` existe.

**Fazer:** botão "Abrir contrato" (mesmo padrão do G-3). Vale pro contrato assinado e pro pendente.

**Toca:** `Job.tsx` (ContractTab).

---

## G-5 — Pagamento parcial não sinalizou "PARTIAL" (áudio 31/07 17:58)

> "Mesmo o cara pagando a parcela parcial, não apareceu o partial. Eu já vi aparecendo parcial, mas nesse caso não estava. Quando colocou o valor total ficou paid, aí certo."

**Hoje:** a lógica da aba Invoice está correta (`Job.tsx:1288-1295` → `statusFromPayments`, `api.ts:574` grava o status). **Mas** o cartão do topo e o tracker (Draft→Quoted→Sent→Approved→Invoiced→Paid) não têm estado intermediário: com $4.000 de $8.000 pagos o topo continua "Invoiced" e o "NEXT STEP: Record payment" não diz quanto falta. Nos prints dele o PARTIAL aparece só dentro do card da fatura.

**Investigar:** (a) badge do topo/lista sem parcial é o mais provável; (b) tela que não recarregou na hora (invalidação de query).

**Fazer (provável):** parcial no cartão do topo e na lista da Home + "Balance $4,000 restante" no NEXT STEP.

**Toca:** `Job.tsx` (header + stage tracker), `Tabs.tsx` (lista Home), `data.ts` (`deriveStage`).

---

## G-6 — Campo de observação / nº do cheque no pagamento (áudio 31/07 17:57)

> "Onde a gente coloca o pagamento, se desse pra adicionar um campo pra número, ou alguma observação — quando o cara paga em cheque a gente coloca o número do cheque, o nome do banco. Ou um campo observação. Seria bom sair no recibo do cliente."

**Hoje:** `RecordPaymentSheet` tem amount + method (Cash/Check/Card/Bank transfer/Other) + data. Sem campo livre. O recibo (`send.ts` `buildReceiptHtml`) imprime date/method/invoice/saldo.

**Fazer:** campo "Reference / note" (opcional, ~60 chars) em `invoice_payments` (coluna nova) → impresso no recibo como "Reference: Check #1234 — Chase".

**Toca:** migration (`invoice_payments.reference`), `api.ts` (`recordInvoicePayment`), `Job.tsx` (sheet), `send.ts` (recibo).

---

## G-7 — Baixar todas as fotos no portal do cliente (áudio 31/07 16:35)

> "Na tela do cliente teria que ter um botão pra fazer o download de todas as fotos de uma vez, pra ele baixar no computador. Ou por fase: clica na fase e baixa todas as fotos da fase."

**Hoje:** o portal (`/root/projetos/photoquote-client-portal`) mostra as fotos por fase; download só uma a uma pelo navegador.

**Fazer:** "Download all photos" no topo + "Download phase photos" por fase. Provável ZIP no cliente (JSZip) ou download sequencial — decidir pelo peso (12 fases × várias fotos).

**Toca:** portal (repo separado, deploy Vercel).

---

## G-8 — PDF do orçamento: paginação e logo (áudio 31/07 18:54)

> "Quando gera um estimate e manda por PDF ele fica assim… tem que formatar melhor, paginar melhor. E colocar o logo — o logo da empresa não aparece."

**Hoje:** `send.ts` monta o HTML e o `expo-print` gera o PDF. `SendData.company` (`send.ts:95`) tem name/license/address/phone/email — **não tem logo**. O `logo_url` existe no perfil (`Misc.tsx:337-376`, `uploadCompanyLogo`) e não é usado em documento nenhum. No print dele as 6 fotos ocupam quase uma página inteira e a tabela de itens é cortada no meio.

**Fazer:** (a) logo no cabeçalho dos 4 documentos (quote/invoice/contract/receipt) — embutido como data URI, igual às fotos da Onda F; (b) CSS de impressão: `page-break-inside: avoid` nas linhas/blocos, grid de fotos menor, repetir cabeçalho da tabela por página, rodapé com numeração.

**Toca:** `send.ts`, `api.ts` (carregar `logo_url` no SendData), `Job.tsx`/`Flow.tsx` (montagem do SendData).

---

## G-9 — Nova fatura quando o orçamento muda depois de pagamento (áudio do dono, 24/08)

> "Além do pagamento ser parcial… tem que ter uma alteração no orçamento. Quando alterar o orçamento ele já fala que não altera o invoice — mas a gente tem que gerar um novo invoice, tem que ter outros invoices gerados ali. Tem que organizar isso de uma forma melhor."

**Hoje:** `api.ts:394 syncInvoiceWithEstimate` **desiste** quando já existe pagamento (`if (count) return;`) — proposital, pra não mexer em fatura paga. O app então mostra o aviso `outOfSync` (`Job.tsx:1296`) e **não há saída**: 1 projeto = 1 fatura na prática (a aba Invoice lê uma só).

**Fazer (maior item da lista):** múltiplas faturas por projeto — lista de faturas na aba, "Nova fatura" (complementar/aditivo) com o delta do orçamento, numeração já é por usuário/ano, e o recibo referenciando a fatura certa. Decidir: fatura complementar só do delta (mais simples e é o que o mercado faz) vs. cancelar+reemitir.

**Toca:** `api.ts` (fetchJobDetail lê 1 fatura hoje), `Job.tsx` (InvoiceTab), `data.ts`, possivelmente migration (nada estrutural — invoices já tem project_id).

---

## Ordem sugerida (do mais barato pro mais caro)

| # | Item | Esforço | Risco |
|---|------|---------|-------|
| G-3 | Abrir portal no app | baixo | nenhum |
| G-4 | Abrir contrato no app | baixo | nenhum |
| G-2 | Spinner na foto | baixo | nenhum |
| G-5 | Parcial visível no topo | baixo-médio | investigar antes |
| G-6 | Referência no pagamento/recibo | médio | migration |
| G-8 | Logo + paginação do PDF | médio | testar em device |
| G-7 | Download de fotos no portal | médio | repo do portal |
| G-1 | Desconto/arredondamento | alto | dinheiro: banco+PDF+portal |
| G-9 | Múltiplas faturas | alto | dinheiro + fluxo |
