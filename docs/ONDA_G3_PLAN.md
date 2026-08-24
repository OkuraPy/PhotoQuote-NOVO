# Onda G — onda 3: desconto (G-1) e múltiplas faturas (G-9)

Plano de ponta a ponta. **Nada aqui foi implementado** — são as duas coisas que mexem em dinheiro,
e o combinado com o dono é mostrar o desenho antes de escrever código.

Base: HEAD `4f7126f` (ondas 1 e 2 entregues). Levantamento feito no código vivo e no banco de
produção em 24/08.

---

## O que eu confirmei antes de desenhar

| Fato | Onde | Por que importa |
|---|---|---|
| **Um trigger no banco recalcula e SOBRESCREVE o total do orçamento** a cada escrita em `line_items` | `update_estimate_totals()` | Um desconto que só exista no app é apagado no próximo toque em qualquer item. O desconto TEM que entrar no trigger. |
| A fórmula do trigger é `total = subtotal + imposto + margem`, com `imposto = subtotal_tributável × taxa` | idem | É aqui que o desconto entra — e a ordem em relação ao imposto é uma decisão de negócio (D2). |
| A margem/markup hoje é **embutida no preço unitário** (`applyMarkup`), com `margin_rate = 0` no esquema novo | `data.ts`, `Flow.tsx:773-788` | O desconto NÃO pode seguir o mesmo caminho: ele é do cliente, tem que aparecer como linha. |
| O menos do markup é travado em zero | `Flow.tsx:779` `Math.max(0, …)` | É literalmente por isso que "não dá pra colocar menos". |
| **1 projeto = 1 fatura hoje**, na prática e no código | `fetchJobDetail` lê UMA fatura (a mais nova) | Em produção: 30 faturas em 30 projetos distintos, zero projeto com duas. Não há dado legado pra migrar. |
| `syncInvoiceWithEstimate` **desiste** quando já existe pagamento | `api.ts:394` `if (count) return` | É a raiz exata do pedido do dono: editou o orçamento depois do sinal, a fatura congela e não há saída. |
| A fatura já é por-projeto no banco (`invoices.project_id`) e a numeração é por usuário/ano | `next_invoice_number` | Múltiplas faturas **não precisam de migration** — é mudança de app. |
| O contrato congela UMA fatura | `agreements.invoice_id`, `createAgreement` | Com duas faturas, é preciso decidir a qual o contrato se refere (D6). |
| O portal do cliente não mostra fatura, só progresso e total do orçamento | `get_project_by_share_token` | O desconto aparece lá de graça (o total já vem descontado); as faturas não afetam o portal. |

---

## G-1 — Desconto / ajuste para baixo

> "Internal Markup pra você aumentar pro cliente… mas daí teremos que colocar tipo assim, você
> colocar menos também, tipo um desconto — porque às vezes você vai atender um contractor e
> normalmente é 30% a menos desse valor. Mas também teria que ter um campinho pra valor, tipo se
> quer arredondar: deu 1.099, quer deixar 1.000 redondo." (Gladson, 30/07)

São **dois pedidos diferentes** no mesmo áudio:
1. um desconto **percentual** (o caso "contractor -30%");
2. um **arredondamento** do total ($1.099 → $1.000).

### Desenho

Um único conceito no banco — `discount_amount` em dólares — e duas formas de chegar nele na tela:

```
subtotal            = Σ (qtd × preço)         ← markup já embutido, como hoje
desconto            = D                        ← novo (0 quando não usado)
base tributável     = subtotal_tributável × (1 − D / subtotal)   ← o desconto reduz a base na
                                                                    proporção do que é tributável
imposto             = base tributável × taxa
TOTAL               = subtotal − D + imposto
```

Guardando **os dois** valores: `discount_percent` (0 quando ele digitou em $) e `discount_amount`
(sempre resolvido em $). É o mesmo padrão que o plano de pagamento já usa pro sinal
(`deposit_percent` null = foi digitado em $), então não inventa conceito novo no projeto.

**Digitar o total final** (o arredondamento) resolve pela fórmula fechada — o app calcula o
desconto que produz aquele total, sem laço de tentativa:

```
k = subtotal_tributável × taxa
D = (subtotal + k − alvo) / (1 + k / subtotal)
```

### O que muda, arquivo por arquivo

**Banco** (1 migration):
- `estimates`: `discount_percent numeric default 0`, `discount_amount numeric default 0`.
- `invoices`: as mesmas duas colunas (a fatura é um retrato congelado do orçamento).
- `update_estimate_totals()`: passa a subtrair o desconto **antes** do imposto (D2), recalculando
  `discount_amount` a partir de `discount_percent` quando o desconto é percentual — senão editar um
  item deixaria o desconto de 30% valendo um valor velho.
- CHECK: `discount_amount >= 0` e `discount_amount <= subtotal` (desconto não pode virar crédito).

**App**:
- `data.ts` — `calcTotals` ganha o desconto; funções puras novas `discountFromTarget()` e
  `resolveDiscount()`; tudo coberto por jest (é dinheiro, é onde os testes valem mais).
- `Flow.tsx` — bloco "Price adjustment": stepper de **Discount %** (0-50%, passo 5) + campo
  **Final total** que aceita o número redondo. Os dois espelham o mesmo estado.
- `Job.tsx` — QuoteTab e InvoiceTab mostram a linha "Discount"; a edição do orçamento hidrata o
  desconto salvo.
- `send.ts` — linha "Discount −$99.00" entre Subtotal e Tax nos PDFs (D1).
- `api.ts` — `saveEstimate`/`updateEstimateItems` gravam as colunas; `createInvoice` copia;
  `syncInvoiceWithEstimate` copia; `createAgreement` já usa o total da fatura (nada a fazer).

**Portal**: nada. O total que ele mostra já vem descontado do banco.

### Riscos
- **O trigger é o ponto perigoso.** Errar ali quebra o total de TODOS os orçamentos, não só os com
  desconto. Mitigação: a migration é testada com BEGIN/ROLLBACK em produção contra orçamentos reais
  (com e sem desconto, com e sem item isento) conferindo que o total não muda para os 64 orçamentos
  existentes — desconto zero tem que dar exatamente o número de hoje.
- Fatura já emitida + desconto novo no orçamento: cai na mesma regra de hoje (só sincroniza se não
  houver pagamento) — e é justamente o que o G-9 resolve.

### Decisões que preciso do dono
- **D1 — o cliente vê o desconto?** Recomendo **sim**, linha "Discount" no PDF: quem recebe -30% quer
  ver que recebeu, e um total que não fecha com a soma dos itens gera pergunta.
- **D2 — imposto antes ou depois do desconto?** Recomendo **desconto primeiro, imposto sobre o valor
  já descontado** (é a norma nos EUA e é o que o cliente espera).
- **D3 — as duas entradas (% e total final)?** Recomendo **sim**: são os dois pedidos do áudio, e uma
  só não atende a outra (arredondar via % é conta de cabeça).

---

## G-9 — Nova fatura quando o orçamento muda depois do pagamento

> "Além do pagamento ser parcial… quando alterar o orçamento, ele já fala que não altera o invoice.
> Mas a gente tem que gerar um novo invoice, tem que ter outros invoices gerados ali. A gente tem
> que organizar isso de uma forma melhor." (dono, 24/08)

### O que acontece hoje
Fatura emitida → cliente paga o sinal → obra cresce → dono edita o orçamento → o app **não** toca na
fatura (proposital: fatura com pagamento não pode mudar sozinha) → aparece o aviso "out of sync" e
**acabou**: não há como cobrar a diferença dentro do app.

### Desenho: fatura complementar (change order)

O modelo do mercado, e o mais simples: a fatura original fica **como está** (é o que o cliente já
pagou), e a diferença vira uma **fatura nova**.

```
Fatura #1  $8.000   Paga            ← intocada, com seus pagamentos e recibos
Fatura #2  $2.400   Em aberto       ← a diferença do orçamento novo, com plano próprio
────────────────────────────────
Job        $10.400  ·  Pago $8.000  ·  Falta $2.400
```

**Aba Invoice vira lista**: com uma fatura só, a tela é **exatamente a de hoje** (nada muda pra 30
dos 30 projetos existentes). Com duas ou mais, vira uma lista de cartões — número, status, total,
saldo — e o cartão abre a fatura (plano, pagamentos, recibos, PDF).

**Botão "New invoice"**: aparece quando `total do orçamento > Σ faturas`, já com a diferença
preenchida (editável), plano de pagamento próprio. Também serve pra um extra fora do orçamento.

**O que precisa acompanhar** (é aqui que mora o trabalho real, não no botão):
- `fetchJobDetail`: passa a devolver `invoices[]` em vez de uma; o "primary" (mais antigo) mantém a
  compatibilidade de quem só olha uma.
- **Etapa (Stage)**: `Paid` só quando TODAS as faturas estiverem pagas; `partial` quando
  `Σ pagos > 0` e `< Σ totais`. Hoje é derivado da fatura mais nova — com duas, a nova em aberto
  jogaria um job pago de volta pra "Invoiced" (e é o comportamento certo: ainda falta receber).
- **Home / lista / métricas**: o valor do job passa a ser `Σ faturas` (hoje é a fatura mais nova).
  Sem isso, um job de $10.400 aparece como $2.400 na lista — erro de dinheiro na cara do dono.
  `fetchJobs` e `homeMetrics` mudam juntos.
- **`syncInvoiceWithEstimate`**: passa a mirar a fatura mais nova **sem pagamento**; se todas
  tiverem pagamento, não sincroniza nada (é aí que o "New invoice" entra em cena).
- **Contrato**: continua preso à primeira fatura (D6). O contrato assinado é o acordo original; uma
  fatura complementar não reabre assinatura — mas o aviso de "contrato desatualizado" que já existe
  continua valendo.
- **Recibo**: já referencia a fatura certa (`invoice_payments.invoice_id`), nada a fazer.
- **Excluir job**: `deleteProject` já apaga por `project_id`, então pega N faturas — mas o teste E2E
  precisa refazer a prova com duas.

**Migration**: nenhuma. As colunas já existem e a numeração já é por usuário/ano.

### Riscos
- É a mudança com mais superfície da Onda G: mexe em etapa, lista, métricas e uma aba inteira. O
  risco não é "não funcionar", é **mostrar dinheiro errado em algum canto** que hoje assume uma
  fatura só. Mitigação: varredura de TODOS os pontos que leem `invoice` (grep dirigido), jest nas
  funções puras novas (agregação de status e de saldo) e E2E em produção com um job sintético de
  duas faturas, provando etapa, lista, métricas e exclusão.
- Ordem importa: **G-1 antes de G-9**. O desconto muda o total do orçamento, que é a base do cálculo
  da diferença da fatura complementar. Fazer na ordem contrária significa mexer duas vezes no mesmo
  cálculo.

### Decisões que preciso do dono
- **D4 — fatura complementar (recomendado) ou cancelar e reemitir?** Complementar preserva o
  histórico do que o cliente já pagou e é o que o mercado faz; reemitir some com o rastro.
- **D5 — o valor do job na lista passa a ser a soma das faturas?** Recomendo **sim**.
- **D6 — o contrato acompanha a fatura nova?** Recomendo **não** (fica no acordo original); se ele
  quiser um aditivo assinável, isso é uma onda própria, não um item.

---

## Execução

| Passo | O que | Gate |
|---|---|---|
| 1 | Migration do desconto + trigger, testada com ROLLBACK contra os 64 orçamentos reais | total inalterado com desconto 0 |
| 2 | `data.ts` puro + jest (desconto %, desconto $, alvo de total, item isento, desconto = subtotal) | jest verde |
| 3 | Telas do orçamento (Flow + Job) e PDF | tsc + bundle |
| 4 | **Revisão do G-1 e aval do dono** | — |
| 5 | `fetchJobDetail` → `invoices[]` + agregações puras + jest | jest verde |
| 6 | Aba Invoice em lista + "New invoice" com a diferença | tsc + bundle |
| 7 | Etapa, `fetchJobs`, `homeMetrics` e varredura de tudo que lê fatura | grep dirigido |
| 8 | E2E em produção (job sintético com duas faturas) + revisão adversarial | provado e desmontado |

Gates de sempre: `tsc` limpo, `jest`, `npx expo export --platform ios`, e o túnel só depois do aval —
build EAS **apenas com GO explícito**.

**Estimativa honesta**: G-1 é meio dia de trabalho com teste sério no trigger; G-9 é o maior item de
toda a Onda G (a aba inteira + etapa + métricas). Não dá pra fazer os dois com pressa no mesmo
fôlego sem arriscar dinheiro errado na tela — por isso os passos 4 e 8 são pontos de parada.
