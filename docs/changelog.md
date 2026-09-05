# Changelog — PhotoQuote-NOVO

Registro por commit (Regra #0). Mais recente no topo.

---

### [2026-09-05 16:10] — fix: 3 revisores em cima de tudo — 1 BLOQUEANTE e 1 ALTO de dinheiro
O dono mandou "coloca revisores para analisar tudo". Três agentes adversariais (dinheiro / busca e
teclado / integração), cada um com escopo próprio. Acharam coisa que eu não tinha visto.

🔴 **ALTO — o MESMO recibo saía com dois saldos diferentes** (`Job.tsx:823`). O recibo oferecido
logo após registrar calculava `total − tudo que já foi pago`; a 2ª via calcula pela **cronologia**
(`balanceAfterPayment` sobre o ledger, que o banco devolve ordenado por `paid_at`). Enquanto a data
era sempre hoje, os dois batiam. Com data retroativa, divergem: fatura de $1.000 com $600 pagos em
01/09, ao lançar $400 datados de 25/08, o recibo imediato imprimia **"Paid in full"** e a 2ª via do
**mesmo número de recibo** imprimia **"Remaining balance $600"**. Corrigido com
`balanceAfterNewPayment` (pura, 4 testes), que insere o novo pagamento na posição cronológica e usa
a mesma matemática dos dois lados.

🔴 **BLOQUEANTE apontado — cheque pré-datado fecha a fatura com dinheiro que não entrou.** Um
pagamento com data futura conta imediatamente: a fatura vira `Paid`, o job sai do pipeline, entra em
"collected" na Home, e **a app não tem como apagar um pagamento** (só SQL). Mas a data futura é
exatamente o que foi pedido ("cheque pra daqui uma semana… e ele já recebido"), então **não** tirei
a capacidade: o campo agora avisa em amarelo assim que a data é futura, e ao confirmar aparece um
alerta dizendo o efeito e que não dá pra desfazer. **A decisão de negócio — contar agora ou só na
data — está com o dono** (perguntado no Telegram).

**Busca (2ª rodada):**
- **ALTO**: `shortDocLabel` jogava fora o ano e produzia rótulos IDÊNTICOS para jobs diferentes —
  6 pares reais em produção (`EST-022` do Jason Fikes e `EST-2026-022` da Ginger Petty viravam os
  dois "EST #022"). Agora o ano fica: `EST #2026-022`.
- **MÉDIO**: `q` era usado sem `trim`, então um espaço caía no ramo de busca e devolvia a base
  inteira, fechados inclusive. Idem na tela de Clientes.
- **MÉDIO**: os chips de filtro ficavam acesos e clicáveis durante a busca, mentindo (a busca ignora
  o filtro de propósito). Agora ficam esmaecidos e inertes enquanto há termo.
- **MÉDIO**: re-render, não a busca — `searchJobs` custa 0,13-0,19 ms por tecla, mas o `JobCard` não
  era memoizado e o `renderItem` era arrow inline: ~20 cards com `Image` remontavam por letra
  digitada. `React.memo` + `useCallback`.
- **BAIXO**: uma letra ("i", "e") casava o prefixo `inv`/`est` e arrastava 23-32 jobs para cima do
  cliente procurado — agora o prefixo exige 3 letras. Busca passou a ignorar acento ("luis" acha
  "Luís Fernando", que existe na base). Botão de limpar com alvo de 44pt e rótulo traduzido.
- **Arquivos**: `src/v2/data.ts`, `src/v2/screens/Job.tsx`, `src/v2/screens/Tabs.tsx`,
  `src/v2/ui.tsx`, `src/v2/lib/api.ts` (comentário que prometia demais), testes (+8 → **191**).
- **Sem risco no portal**: `get_project_by_share_token` não devolve `invoices` nem
  `invoice_payments`, então Zelle e data retroativa não chegam lá (verificado pelo revisor).

### [2026-09-05 15:20] — feat: data do pagamento escolhida à mão + Zelle como método
Dois áudios do Gladson (28/08) com print do "Record payment":
1. **"a data de pagamento a gente não consegue escolher"** — dois casos reais: (a) cheque
   pré-datado, "que é pra daqui uma semana"; (b) recebeu ontem, só hoje está lançando e emitindo o
   recibo, e "a data eu preciso colocar de ontem". O texto fixo "Received today · <hoje>" virou um
   campo **Payment date** que abre o `DateSheet` (passado e futuro liberados).
2. **Zelle** entre os métodos — "é igual o Pix no Brasil". Entra como chave `Zelle` (marca, igual
   nos 3 idiomas) entre Check e Card, que é a ordem de uso dele.
- 🔴 **Bug que eu teria criado e peguei na conferência**: o recibo oferecido logo depois de
  registrar (`Job.tsx:829`) mandava `date: toDateOnly(new Date())` — a data de HOJE. O recibo do
  "recebi ontem" sairia com a data errada, ou seja, o pedido pela metade. Agora manda `paidAt`.
  O outro caminho (recibo pela lista, `Job.tsx:859`) já lia `p.paidAt` do banco e estava certo.
- **Arquivos**: `src/v2/screens/Job.tsx` (estado `paidAt`, campo novo, `METHOD_KEY`, strings),
  `src/v2/lib/__tests__/payments.test.ts` (+3)
- **Sem migration**: `invoice_payments.paid_at` é `date NOT NULL default CURRENT_DATE` e
  `recordInvoicePayment` já aceitava `paidAt` — só a tela não oferecia. `method` é texto livre, sem
  CHECK, então Zelle entra sem tocar no banco (conferido por SQL em prod).
- **Efeitos aceitos**: o ledger é ordenado por `paid_at`, então um pagamento lançado hoje com data
  de ontem entra ANTES na cronologia e o "saldo após" segue essa ordem (é o correto contábil, mas um
  recibo já emitido reimprime com outro saldo). Um cheque pré-datado conta como recebido na hora —
  que é exatamente o que ele pediu.
- jest **183/183**, tsc limpo.

### [2026-09-05 14:40] — fix: revisão profunda da busca e do teclado — 2 ALTOS reais, um deles o caso de uso do pedido
O dono mandou "revisa profundamente". Dois revisores adversariais + uma varredura contra a base de
produção inteira (101 jobs, 144 números, cada um digitado de 4 a 7 jeitos).

**ALTO 1 — cheque de job fechado não achava nada** (`Tabs.tsx`): a busca rodava dentro do filtro, e
`All` exclui `closed`. Em produção **5 faturas pertencem a projetos Lost** (`INV-2026-0009/0010/
0018/0019` + legado) — e o cheque costuma chegar DEPOIS de o job sair do pipeline, que é o cenário
exato do pedido. Agora, com termo digitado, a busca varre todos os jobs; o fechado aparece com seu
ClosedChip e ordenado atrás dos abertos.

**ALTO 2 — o toque comido não sumiu, mudou de lugar** (`Tabs.tsx`): o ScrollView horizontal dos
chips ficou no default `'never'`, então com o teclado aberto o primeiro toque em "Lost" só fechava o
teclado. Recebeu `keyboardShouldPersistTaps="handled"`.

**O que a varredura na base real mostrou (e nenhum teste sintético pegaria):**
- **Numeração de fatura e cotação é independente**: `40` é a `INV-2026-0040` de um job **e** a
  `EST-040` de outro (acontece 20+ vezes em prod). Como o pedido nasceu de um cheque, e cheque cita
  fatura, a fatura vence o empate; `est 40` continua achando a cotação.
- **Dois formatos legado convivem**: `EST-2026-023` ao lado de `EST-023` (mesma sequência 23), e 6
  faturas base36 (`INV-MPRE7CE0`). Quem digita o número inteiro ganha de quem só bate a sequência
  (`MATCH_EXACT`), e o id base36 é achado por conteúdo.
- `INV-MOLX1QGP` digitado inteiro casava `INV-2026-0001`, porque o "1" do id lia como sequência 1.
  Documento numerado agora aceita no máximo UMA palavra (seu prefixo).

**Demais achados corrigidos**: `EST-100` trazia EST-1001/1002/1003 (todos reais); `#40` casava
`INV-2026-0140` por substring enquanto `inv 40` não achava nada; query só de pontuação (`#`) subia
todo job com documento; `join(' ')` fazia "services 1017" casar atravessando dois campos; número
comia o endereço no iPhone SE (agora `INV #0040`, via `shortDocLabel`); placeholder ES cortava;
empate de `created_at` deixava `docLabel` indefinido; carimbo do comentário estourava com fonte de
acessibilidade (`maxFontSizeMultiplier`); `SearchBar` ganhou botão de limpar (a busca sobrevivia à
troca de aba); `keyboardDismissMode` virou `interactive` no iOS (a lista pulava sob o dedo).

- **Arquivos**: `src/v2/data.ts`, `src/v2/screens/Tabs.tsx`, `src/v2/screens/Job.tsx`,
  `src/v2/ui.tsx`, `src/v2/lib/api.ts`, `src/v2/lib/__tests__/data.test.ts`
- **Limite conhecido e aceito**: `automaticallyAdjustKeyboardInsets` é iOS-only — no Android só o
  `on-drag` funciona (com `edgeToEdgeEnabled` a janela não redimensiona). Colisões de sequência
  entre formatos legado são inerentes aos dados: os dois aparecem, o exato primeiro.
- **jest 180/180** no repo; a varredura com dados reais (não commitada, por conter nomes de
  clientes) roda 186 e passa.

### [2026-09-05 13:55] — fix: o número buscado tem que ser o PRIMEIRO card, não o quinto
- **Como apareceu**: o dono perguntou "tem certeza que resolveu?". Em vez de responder, montei um
  teste com os **12 jobs mais recentes de produção** (SQL direto no banco) e rodei a busca neles.
  Meus testes sintéticos passavam e o caso real falhava.
- **Bug de verdade**: `34` casa os CEPs **33428** e **33405** de quatro endereços por substring, e o
  filtro booleano devolvia a lista na ordem de data — a `INV-2026-0034` saía **em último**. O pedido
  do Gladson ("não ter que abrir um por um") continuava de pé.
- **O que mudou**: `rankJobMatch` (2 = casou o número do documento, 1 = casou o texto) e
  `searchJobs`, que filtra e ordena numa passada só, mantendo a ordem por data dentro de cada grupo.
  Nada é escondido — quem busca `1017` (número da rua) continua vendo o mesmo de antes.
- **Arquivos**: `src/v2/data.ts`, `src/v2/screens/Tabs.tsx`, `src/v2/lib/__tests__/data.test.ts` (+5)
- **Decisão técnica**: reordenar em vez de filtrar só pelo número. Filtrar esconderia resultados que
  o contratante espera ver (o caso do número da rua), e o benefício — achar o documento — já é obtido
  pondo o hit certo no topo. jest 175/175.
- **Lição**: teste sintético não substitui dado real. O fixture de produção (nomes de clientes) foi
  usado para verificar e **não** foi commitado.

### [2026-09-05 13:10] — feat: busca por nº de fatura/cotação + o teclado parou de tapar a lista
- **O que mudou** (2 áudios do Gladson de 03/09, com print da tela Jobs):
  1. **Buscar pelo número**: o cheque do contractor vem com o número do invoice, e para dar baixa
     ele tinha que abrir job por job. Agora a busca da lista aceita `40`, `0040`, `INV-2026-0040`,
     `inv 2026 0040`, `EST-099`, `99`. O número do documento passou a aparecer no card (INV se
     houver, senão EST), que é o que permite identificar o certo sem abrir.
  2. **Teclado**: ao buscar, o teclado ficava por cima dos últimos resultados e só saía tocando num
     canto vazio — "a pessoa tem que saber que tem que clicar do lado". Agora arrastar a lista fecha
     o teclado (`keyboardDismissMode="on-drag"`), o iOS recua a lista pela altura do teclado
     (`automaticallyAdjustKeyboardInsets`, RN 0.81 suporta) e tocar num card abre o job direto em vez
     do toque ser gasto fechando o teclado (`keyboardShouldPersistTaps="handled"`). Mesma correção
     aplicada na lista de Clientes, que tinha exatamente o mesmo problema.
- **Arquivos**: `src/v2/data.ts` (`jobMatchesQuery` — puro e testado), `src/v2/lib/api.ts`
  (`fetchJobs` agora traz `invoice_number`/`estimate_number` → `docNumbers`/`docLabel`),
  `src/v2/screens/Tabs.tsx` (busca, props de teclado em Jobs e Clients, número no card, placeholder),
  `src/v2/lib/__tests__/data.test.ts` (+9 testes).
- **Decisão técnica**: número puro (`40`) é comparado com a **sequência final** do documento, nunca
  com a string inteira — senão `2026`, que está dentro de toda fatura, casaria com tudo. Zeros à
  esquerda são ignorados dos dois lados. A busca por texto continua sendo "contém" (sem regressão),
  então `40` também traz quem tem 40 no CEP; o número no card é o desempate visual. Sem migration —
  as duas colunas já existiam, só não vinham na query da lista.
- **Limite conhecido**: a busca acontece dentro do filtro selecionado; o número de um job
  arquivado/perdido só aparece nos chips Lost/Archived.

### [2026-09-05 12:20] — feat: comentário agora mostra data e hora (pedido do dono, áudio 04/09)
- **O que mudou**: no painel de Comentários de cada fase (app), cada mensagem passou a exibir
  quando foi escrita — "Sep 4 · 4:03 PM" —, alinhada à direita do nome do autor. O ano só aparece
  quando não é o ano corrente, pra linha não estourar. Formato segue o idioma do contratante
  (`localeTag()`), como o resto das datas da tela.
- **Arquivos**: `src/v2/screens/Job.tsx` (helper `cmStamp` + cabeçalho do comentário virou `Between`)
- **Decisão técnica**: o dado **já existia** — `PhaseComment.createdAt` vem do banco desde sempre
  (`api.ts:1406` já lê `created_at` e ordena por ele); era só um campo que a UI não desenhava.
  Nenhuma migration, nenhuma mudança de contrato. O nome do autor ganhou `numberOfLines={1}` +
  `flexShrink` pra que um nome longo encolha em vez de empurrar o horário pra fora da tela.
- **Ainda em aberto**: o portal do cliente mostra tempo relativo ("2 days ago", `CommentList.tsx:95`)
  em vez de data/hora absoluta — aguardando o dono dizer se quer o mesmo lá.

### [2026-08-26 01:50] — fix: o revisor derrubou meu diagnóstico — o "não pegou" era OUTRA coisa
- **CORREÇÃO DE ROTA, e importante**: eu tinha diagnosticado o "digitei o total e não salvou" como
  uma corrida entre o blur e o press do botão Salvar. O revisor provou que **isso não acontece no
  iOS**: a barra "Save changes" fica ATRÁS do teclado (trade-off aceito desde a Onda F), então
  qualquer caminho até o botão passa antes por um blur — e um teste de ordenação que ele escreveu
  mostra que o código ANTIGO já salvava certo nessa ordem. Três evidências: o layout, o próprio
  changelog da Onda F, e a produção (96 orçamentos, **um único** com desconto, e ele é percentual —
  desconto em dólar **nunca** foi persistido, o que é padrão de caminho que nunca commita, não de
  corrida intermitente). O `discountRef` que eu tinha adicionado é defensivo e inofensivo, mas não
  era o conserto que eu anunciei.
- 🔴 **O BUG DE VERDADE**: dentro de um `ScrollView` com `keyboardShouldPersistTaps="handled"`,
  tocar num controle IRMÃO **não tira o foco do campo** (provado no fonte do RN instalado:
  `blurTextInput` só roda quando o próprio ScrollView é o responder). Como só o blur aplicava o
  valor, digitar "12" e tocar no "+" ao lado aplicava 1% e **apagava o 12 sem rastro** — e o mesmo
  valia pro stepper do imposto, pro do markup e pra qualquer toque que mudasse o total. O número
  digitado sumia da tela sem nunca ter chegado ao orçamento. É a queixa do dono, e a superfície
  TRIPLICOU quando o desconto ganhou três campos digitáveis.
- **Correção**: enquanto está focado, o campo deixa num "slot" uma função que aplica **o que está
  digitado agora** (via ref, nunca uma closure velha), e **todo controle que mexe no orçamento
  chama esse slot antes de agir** — os ±, os dois steppers, o Salvar e o Continuar. Não depende
  mais de blur nenhum, o que também cobre o Android (onde a barra Salvar FICA alcançável com o
  teclado aberto e o cenário original seria real).
- **`MoneyField` saiu do Flow e virou primitivo em `ui.tsx`** — é onde `Input`/`DecimalInput`/
  `Stepper` já moram, e de lá dá pra testar sem carregar câmera e áudio.
- **7 TESTES NOVOS** (`moneyfield.test.tsx`, react-test-renderer) cobrindo exatamente o que voltou
  duas vezes: o slot entrega o valor digitado AGORA sem blur; enxerga a última digitação e não a do
  foco; campo só olhado não aplica; percentual usa o parser de percentual ("12.567" → 12,6, não
  12567); dinheiro lê "1.000,50" como mil e meio; lixo não aplica; o blur libera o slot.
  **Um desses testes já pagou**: a função registrada mudava de identidade a cada render, então o
  blur nunca reconhecia a própria inscrição pra limpá-la — achado pelo teste, corrigido com uma
  identidade estável que delega pro apply mais recente.
- **Gates**: tsc limpo, jest **155/155**, `expo export ios` OK.

---

### [2026-08-26 01:10] — fix: revisão do bloco de desconto — 1 ALTO de interface (orçamento de graça)
- **Contexto**: dois revisores em cima do `87cf078` antes de virar build. Este é o de "faz sentido e
  vai funcionar". A matemática passou com louvor; a interface do percentual não.
- 🔴 **ALTO — o campo de % perdeu a unidade e vinha com um "0" pra apagar.** Ao virar campo
  digitável, o percentual deixou de mostrar "12%" e passou a mostrar só "12" — e o campo de valor,
  só "189.73". Eram os únicos números sem unidade do cartão (imposto e markup mostram "%"). Cenário
  provado pelo revisor: num orçamento real de $1.637,20 o dono digita `200` querendo **$200 de
  desconto** no campo errado → clampado em **100%** → total **$0,00** → e esse zero vai pro PDF, pra
  fatura e pro contrato assinável. Piorava porque o campo vinha pré-preenchido com "0" e digitar
  "12" com o cursor à esquerda dava "120". **Correção**: "%" e "$" visíveis ao lado dos campos,
  `selectTextOnFocus` (digitar substitui em vez de concatenar) e `maxLength` (5 no %, 12 no valor).
- 🟡 **Os botões ± descartavam o que o campo tinha acabado de aceitar**: eles liam o percentual do
  render, então digitar "$300" e tocar em "+" no mesmo gesto matava os $300 (blur e press no mesmo
  tick, a última escrita vence). Agora leem o mesmo ref síncrono que o save usa.
- 🟡 **± não andava 1 ponto**: com $200 fixos sobre $2.081,10 (=9,6%), o "+" ia pra 11%. Agora anda
  exatamente 1 ponto (9,6 → 10,6).
- 🟡 **Nada dizia qual das três entradas está guardada** — e isso decide o comportamento: um % ACOMPANHA
  os itens quando eles mudam, um valor fica FIXO. A dica agora diz qual ("acompanha os itens" /
  "valor fixo").
- 🔵 **`parseMoney` num campo de percentual estava errado**: a regra "3 dígitos depois do separador =
  milhar" é certa pra dinheiro e não pra percentual (`12.567` virava 12567, `0.005` virava 5). Entrou
  `parsePercent` (4 testes) — decimal simples, vírgula ou ponto, meio ponto preservado.
- 🔵 **Overflow**: um valor absurdo no campo de desconto estourava o `numeric(12,2)` do gatilho e o
  save voltava com erro cru do Postgres (22003). O valor agora é limitado ao subtotal no app.
- **Confirmado SÃO pelo revisor** (não presumido): o app e o gatilho batem centavo a centavo em 12
  casos rodados dos dois lados (incluindo o histórico 8.746,71 @ 50% → 4.373,36); os três campos
  reconciliam em **28.800 combinações** sem uma falha; o que a tela mostra é o que o banco grava nos
  três caminhos; o PDF lê o desconto do BANCO (a correção de ontem está intacta); o desconto não
  vaza entre orçamentos; i18n completo e nada traduzido chega ao cliente.
- **Gates**: tsc limpo, jest 148/148, `expo export ios` OK.

---

### [2026-08-26 00:40] — fix: 3 pedidos do Gladson no desconto — inclusive "salvei e não salvou"
- **Origem**: primeiro uso real do desconto (build 34/35). Print + 2 áudios de 25/08.
- 🔴 **BUG DE PERDA DE DADO — digitar o total e salvar não salvava.** Pelo stepper (5%, 10%) salvava;
  digitando o valor, não. **Raiz**: tocar em "Save changes" com o campo ainda em foco dispara o
  blur e o press no MESMO tick — o blur chama `up({discount})`, que o React só aplica no próximo
  render, e o `saveEdit`, que fechou sobre o render ATUAL, lê o desconto ANTIGO. A tela então
  re-renderizava com o desconto aplicado, então parecia salvo enquanto o banco não recebeu nada.
  **Correção**: o valor é escrito também num ref (síncrono) e é ele que o save lê — tocando em
  Aplicar, tocando fora ou indo direto no Salvar, o que está na tela é o que vai pro banco.
- **De 5 em 5 → de 1 em 1, e digitável** ("pode ser 12%, 7%, 10%"): o percentual virou campo de
  texto com ± de 1 ponto. Andar de 0 a 30 de um em um não é interface, e saltos de 5 não expressam
  um acordo de 12%.
- **Campo pro valor do desconto** ("um espacinho para valor"): agora são TRÊS entradas do mesmo
  número — `Discount` em %, `Discount amount` em $, e `Final total`. Mexeu numa, as outras duas se
  ajustam; é o mesmo desconto visto de três lados.
- **Detalhe**: o percentual guarda meio ponto (12,5%) sem virar 13 na tela, e mostra 0 em vez de
  campo vazio.
- **Arquivos**: `src/v2/screens/Flow.tsx` (`MoneyField` novo substitui o `TotalTarget`,
  `applyDiscount`/`applyTargetTotal` com o ref síncrono).
- **Gates**: tsc limpo, jest 144/144, `expo export ios` OK.

---

### [2026-08-24 23:20] — build: BUILD 35 (substitui a 34) — corrige o contrato da fatura complementar
- EAS iOS production `--auto-submit` do worktree `pq-build24` @ `d6b86cc`. Version 2.0.0,
  **buildNumber 35**. Build `05c9c0fe-553b-41ce-88e9-b81a767c4f54`, submission
  `f313d017-357c-4023-8f4b-a3e54b75814c` — enviada sem erro.
- **Por que existiu**: a revisão final (feita DEPOIS da build 34 já estar com a Apple) achou o ALTO
  do contrato congelando a fatura errada. A 34 fica de pé para tudo que existe em produção hoje
  (todo job tem no máximo uma fatura), mas a 35 é a que pode ser usada sem essa armadilha.
- Diferença 34 → 35: contrato sempre na fatura #1 · a tela cai na complementar recém-criada · a
  linha de imposto do PDF diz sobre o que incide · o teste do change order valida a base impressa.

---

### [2026-08-24 23:10] — fix: revisão final pegou um ALTO que EU criei — contrato congelava a fatura errada
- **Contexto**: revisão da própria correção do bloqueante (`b557f1c`), que tinha sido escrita depois
  que o revisor anterior terminou e não tinha passado por ninguém. Era onde eu mais tinha mexido em
  dinheiro no dia. Achou.
- 🔴 **ALTO — ramo morto no ternário do contrato.** Eu escrevi
  `(detail?.agreement ? invoices[0] || inv : inv).id`, mas a linha logo acima já dá `return` quando
  existe acordo — então `detail?.agreement` ali é SEMPRE falso e o efeito líquido virou "sempre a
  fatura selecionada". Antes do meu commit era sempre a #1. Combinado com a seleção padrão nova
  ("primeira COM saldo"), num job cuja #1 está quitada o contrato seria gerado para a COMPLEMENTAR
  — e `createAgreement` monta a tabela de itens a partir do orçamento enquanto tira o preço da
  fatura, então o cliente receberia para ASSINAR $10.400 de itens com preço de contrato $2.400,00.
  É exatamente o bloqueante que este mesmo dia corrigiu na fatura, reaparecido no único documento
  que tem assinatura. **Correção: volta a ser sempre `invoices[0]`** — bate com o que a aba mostra.
  Contratar uma complementar exigiria `createAgreement` entender `is_change_order` primeiro.
- 🟡 **Depois de criar a complementar a tela voltava pra #1** (o comentário "land on the new one"
  deixou de ser verdade quando o padrão virou "primeira com saldo") — o próximo toque em "Enviar
  fatura" mandaria a fatura errada. Agora seleciona a recém-criada pelo id que `createInvoice` já
  devolvia.
- 🔵 **A linha de imposto do PDF agora diz sobre o que incide** quando a base não é o subtotal
  inteiro: "Tax (7% on $473.43)". Sem isso, na complementar o cliente lia "Tax (7%) $33.14" embaixo
  de um subtotal de $2.366,86 e parecia erro. (A afirmação do commit anterior — "a linha passa a ser
  um fato" — só valia na tela do dono; agora vale no documento.)
- 🔵 **`splitChangeOrder` parou de devolver um `taxableSubtotal` que ninguém consome**: nada guarda
  essa base, então a tela e o PDF a recuperam do imposto congelado. O teste validava justamente o
  campo morto — passou a validar a base que o app REALMENTE imprime.
- **O revisor confirmou com todas as letras**: a conta do change order fecha em 700 mil combinações
  (10 alíquotas, orçamentos 100%/0%/parcialmente tributáveis, centavos quebrados) sem uma falha; a
  fatura normal — 100% da produção hoje — está intacta; a seleção nova não muda nada num job de uma
  fatura; `voidUnsignedAgreements` não alcança contrato assinado; `is_change_order` está aplicada e
  o PostgREST a enxerga (sem risco de PGRST204 derrubar a criação de fatura na build 34).
- **Aceito**: a repartição do imposto da complementar usa a mesma fatia tributável do orçamento —
  se o trabalho ACRESCIDO tiver perfil tributário diferente do orçamento original, o imposto da
  complementar é aproximado (o total cobrado está sempre certo; o app não emite guia de imposto).
- **Gates**: tsc limpo, jest 144/144, `expo export ios` OK.

---

### [2026-08-24 22:40] — build: BUILD 34 ENTREGUE AO TESTFLIGHT (Onda G completa)
- **O que foi**: EAS build iOS production com `--auto-submit`, do worktree `/root/projetos/pq-build24`
  no commit `b557f1c`. Version 2.0.0, **buildNumber 34** (o autoIncrement do EAS levou 33→34 e
  reescreveu o app.json — daí o número estar commitado aqui).
- **IDs**: build `338116c3-e78d-4b9b-a700-0d894d3be12c` · submission `8895d453-5a6b-4ddd-ad47-59f4a957ca62`
  · "Submitted your app to Apple App Store Connect" sem erro.
- **Conteúdo**: a Onda G inteira (os 9 pontos do feedback do Gladson de 30-31/07) — G-1 desconto,
  G-2 progresso do upload, G-3 ver o portal pelo app, G-4 abrir o contrato, G-5 parcial visível,
  G-6 referência no recibo, G-8 logo + paginação do PDF, G-9 múltiplas faturas. O G-7 (download de
  fotos no portal) já estava no ar desde 7138501.
- **Pré-build conferido**: bundle do worktree com **hash idêntico** ao da árvore de teste (mesmo
  código), **zero mudança de dependência** desde a build 33 e `npm ls` com um único
  `expo-asset@12.0.13` (a checagem que a saga da tela branca ensinou); 10 sondas de integridade em
  produção zeradas, incluindo as duas novas do desconto (toda fatura e todo orçamento com
  `subtotal − desconto + imposto + margem = total`).
- **Migrations em produção hoje**: payment_reference (+ corretiva usando o `note` que já existia),
  discount_columns, estimate_totals_with_discount, contract_template_discount_line,
  invoice_is_change_order.
- **GOTCHA (de novo)**: o `eas-cli` exige `EXPO_TOKEN=$(cat /root/.expo_token)` — sem isso o build
  falha com "An Expo user account is required to proceed".

---

### [2026-08-24 22:00] — fix: revisão do G-9 (a única parte ainda não revisada) — 1 BLOQUEANTE
- **Contexto**: antes da build, um revisor atacou só as múltiplas faturas — os dois revisores
  anteriores tinham começado antes dela existir. Achou um bloqueante que teria ido pro cliente.
- 🔴 **BLOQUEANTE — a fatura complementar imprimia os itens do orçamento INTEIRO contra um total
  parcial.** O documento montava `items` (a lista do orçamento) com os `totals` da fatura
  selecionada. O PDF sairia listando $10.000 de serviço embaixo de "Total $2.400,00", e a linha do
  imposto mentia duas vezes (alíquota do orçamento com valor proporcional). **Correção**: a fatura
  complementar agora é MARCADA no banco (`invoices.is_change_order`, migration 20260824030000) e o
  documento dela imprime UMA linha — "Additional work per change order" — com a conta fechando:
  subtotal $2.366,86 + imposto $33,14 (7% sobre os $473,37 tributáveis impressos) = $2.400,00,
  conferido no banco. `splitByTaxShare` virou `splitChangeOrder`, que deriva o subtotal da alíquota
  REAL (`subtotal = valor / (1 + fatia_tributável × alíquota)`) em vez de fatiar por proporção —
  assim a linha "Tax (7% on $473.37)" é um fato, não uma proporção disfarçada de alíquota.
- 🟠 **ALTO — "Pago X de Y" no cabeçalho misturava fontes**: `pago` e `saldo` eram o agregado de
  todas as faturas, mas o `Y` era o total da fatura SELECIONADA — com uma complementar aberta o
  cabeçalho dizia "Paid $8,000.00 of $2,400.00". Passou a usar o total agregado.
- 🟡 **A aba Contract mostrava o plano da fatura selecionada** debaixo do selo verde "Assinado" —
  ou seja, dizia que o cliente assinou um change order de $2.400 que ele nunca viu. Agora mostra os
  números da fatura #1, que é a que o contrato congelou.
- 🟡 **Contrato gerado DEPOIS de já existir uma complementar** cobria só a fatura #1. Agora: acordo
  já existente segue preso à #1 (regra D6), mas um contrato gerado pela primeira vez congela a
  fatura que está na tela — a que o dono escolheu no chip.
- 🟡 **Editar o orçamento deixou de anular contrato não assinado quando havia 2+ faturas** — o
  `return` antecipado do sync pulava o `voidUnsignedAgreements`, e o link de assinatura antigo
  continuava válido com escopo velho. O void agora roda ANTES, e sobre todas as faturas do job.
- 🔵 **Baixos**: job arquivado com orçamento maior ficava mudo (perdia o aviso E o card); a contagem
  que desliga o auto-sync passou a ser por PROJETO (era por orçamento — um job legado com dois
  orçamentos manteria o sync ligado); "Record payment" abria zerado quando a fatura mais nova já
  estava quitada (a seleção padrão agora cai na primeira fatura COM saldo); e o status agregado
  passou a sair do `invoiceRollup` em vez de um recálculo inline paralelo.
- **Aceito e dito ao dono**: criar um change order num job 100% pago tira o job de "Recebido" e joga
  o valor cheio em "Faturado" no painel — é a semântica por-etapa que já existia, e só aparece
  nesse caso específico.
- **Revisor confirmou SÃO**: caso de UMA fatura (100% da produção) sem nenhuma regressão, provado
  contra a fatura real INV-2026-0026 do Gladson; aritmética sem NaN/negativo; desconto não é
  aplicado duas vezes; `field` não vê nada novo; excluir job com 2 faturas zera as 6 contagens;
  i18n completo; duplo toque bloqueado; seleção órfã degrada sem quebrar.
- **Gates**: tsc limpo, jest 144/144, `expo export ios` OK.

---

### [2026-08-24 21:15] — fix: achados dos 2 revisores em paralelo (pedido do dono) — 1 ALTO de dinheiro corrigido
- **Contexto**: o dono pediu "deixa um agente em paralelo revisando cada coisinha". Dois revisores
  independentes (dinheiro/banco e app/produto) varreram a Onda G commitada. Veredito dos dois:
  **sem bloqueante**. O que era real foi corrigido aqui.
- **ALTO — o PDF do cliente não fechava a conta (1 centavo, em 8,6% dos descontos em %)**: a tela
  do job montava os totais misturando fontes — subtotal, imposto e total vinham do BANCO e o
  desconto era recalculado em JS. `Math.round` (float) desempata meio centavo pra BAIXO e o
  `numeric(12,2)` do Postgres desempata pra CIMA: com subtotal $8.746,71 a 50%, o PDF imprimia
  "8.746,71 − 4.373,35 + 218,18 = 4.591,53" (as três linhas somam 4.591,54) e o CONTRATO do mesmo
  job, que lê o banco, imprimia -4.373,36. Dois documentos do mesmo trabalho com descontos
  diferentes. **Correção**: documento salvo lê o desconto que o banco gravou (`est.discount.amount`);
  `resolveDiscount` fica só pro preview do que ainda não foi salvo.
- **E o preview também passou a bater**: `resolveDiscount` calcula o percentual em CENTAVOS
  inteiros, que é o que reproduz o desempate-pra-cima do Postgres (874671 × 50 / 100 = 437335,5 →
  437336). Conferido contra o próprio banco: `8746.71 × 50%` = 4.373,36 nos dois. `calcTotals`
  passou a arredondar subtotal e base tributável ANTES da conta, como o gatilho faz.
- **MÉDIO — tocar no campo "Total final" convertia um -30% em valor fixo**: bastava tocar e sair
  sem digitar nada. Agora o campo só aplica quando o número realmente mudou (o `-30%` continua
  acompanhando os itens, que é a razão de existir do percentual).
- **MÉDIO — "1.000,50" virava 1**: o `TotalTarget` usava `parseFloat`, que lê 1 num número escrito
  na convenção pt/es. Isso alimenta um DESCONTO: colar "1.000,00" num orçamento de $1.098 gerava
  $1.014 de desconto e deixava o total em **$1,00**. Agora usa `parseMoney` (novo, puro, 6 testes),
  a mesma regra do `DecimalInput` — o último separador é o decimal.
- **MÉDIO — sem jeito de confirmar o total no iOS**: o teclado decimal do iOS não tem tecla de
  retorno. Agora aparece um "Aplicar" ao lado do campo assim que o número muda.
- **MÉDIO — stepper de desconto mentia**: com desconto em dólares ele mostrava "0%" ao lado da
  legenda "desconto de $500 aplicado", e o "−" apagava os $500 parecendo inerte. Passa a mostrar o
  percentual EFETIVO, qualquer que tenha sido a forma de entrada.
- **MÉDIO (portal) — erro mudo no download por fase**: a variante compacta renderizava só o botão,
  então `error` nunca era lido: o cliente clicava, o spinner girava e não acontecia nada. Agora diz.
- **MÉDIO (portal) — falha parcial silenciosa**: bastava 1 foto de 30 chegar pra não haver aviso, e
  o cliente abriria um zip com 4 arquivos achando que era tudo. Agora diz "3 de 30 não puderam ser
  baixadas — o resto está no arquivo".
- **BAIXOS**: `Input` compõe o `onBlur`/`onFocus` do chamador em vez de sobrescrever (o campo ficava
  com a borda de foco pra sempre); comentário das fotos-fantasma dizia o contrário do que o código
  faz; placeholder da referência do pagamento agora é traduzido (é UI do empreiteiro, só o valor
  digitado vai pro cliente); comentário do logo dizia "PNG transparente" quando o upload já grava
  JPEG 512px.
- **Verificado e SÃO pelos revisores** (não presumido): trigger em produção idêntico à migration;
  zero regressão nos 92 orçamentos (disparado nos 680 line_items numa transação revertida);
  `resolveDiscount` × trigger concordam em precedência e clamp; as migrations descrevem a produção
  fielmente; o desconto sobrevive aos 4 fluxos (criar, editar, faturar, sincronizar); nenhum
  vazamento financeiro pro papel `field`; 608 chaves i18n, 0 faltando; nada traduzido chega ao
  cliente; CORS e memória do zip OK; teclado do campo Reference OK.
- **Aceito**: o indicador de upload some ao trocar de aba (o upload continua e o refresh conserta);
  assinar o próprio contrato pelo preview é irreversível (o rótulo avisa); logo escolhido e não
  salvo não vai pro PDF (pré-existente no Perfil).
- **Gates**: tsc limpo, jest **143/143** (8 testes novos), `expo export ios` OK; portal tsc + build.

---

### [2026-08-24 20:30] — feat: ONDA G / onda 3, parte 2 — múltiplas faturas por job (G-9)
- **O que mudou**: o job passa a poder ter mais de uma fatura. Quando o orçamento cresce depois que
  o cliente já pagou, a fatura original **fica intacta** (é o que ele pagou) e a diferença vira uma
  **fatura complementar** com plano de pagamento próprio. Antes disso o app mostrava "out of sync"
  e não havia saída nenhuma — era o pedido do dono no áudio de 24/08.
- **Com UMA fatura a tela é idêntica à de hoje.** O bloco de faturas só aparece a partir da segunda:
  resumo ("Total do trabalho $10.400 · Pago $8.000 · Saldo $2.400") + um chip por fatura pra
  escolher qual está na tela (pagamento, plano, PDF e recibo agem na escolhida).
- **O trabalho real não foi o botão** — foi tudo que assumia UMA fatura:
  - `fetchJobDetail` devolve `invoices[]` (mais antiga primeiro) com o plano e o ledger de cada uma,
    ainda em duas queries (`in (...)`); `invoice` (singular) continua existindo e aponta pra mais nova.
  - **Etapa**: `Paid` só quando TODAS estão pagas — uma complementar puxa o job de volta pra
    "Invoiced", que é a verdade (ainda há dinheiro a receber).
  - **Lista da Home e métricas**: o valor do job virou a SOMA das faturas. Sem isso um job de
    $10.400 apareceria como $2.400 (a mais nova) na lista e no "faturado" do painel.
  - **Cabeçalho do job**: total, pago, saldo e o chip de parcial passam a ser o agregado.
  - **`syncInvoiceWithEstimate` desliga a partir da segunda fatura**: com duas, "a mais nova" é a
    complementar, e sincronizá-la com o total CHEIO do orçamento cobraria o cliente duas vezes.
  - **Aviso de "orçamento mudou"** passa a comparar com a soma das faturas, e some quando a
    diferença já está sendo oferecida como fatura nova.
  - **Contrato preso à fatura #1** (decisão D6): change order não reabre contrato assinado.
- **Como a complementar é montada**: valor = orçamento − já faturado (`uninvoiced`), dividido em
  subtotal/imposto pela MESMA proporção de imposto do orçamento (`splitByTaxShare`, as duas partes
  sempre somam o valor exato). Sem desconto próprio — o desconto já saiu no total do orçamento de
  onde a diferença veio, aplicá-lo de novo descontaria o mesmo trabalho duas vezes.
- **Migration**: NENHUMA. `invoices.project_id` e a numeração por usuário/ano já existiam; em
  produção são 30 faturas em 30 projetos distintos, então não há dado legado pra migrar.
- **Provado em produção** (transação com ROLLBACK, nada real tocado): job sintético com duas
  faturas (uma $8.000 paga, outra $2.400 em aberto) → a lista calcula **$10.400** (não $2.400),
  "todas pagas" = false (etapa segue Invoiced), "entrou dinheiro" = true (chip parcial), pago
  $8.000. Contagens depois do teste: 87 projetos / 30 faturas / 23 pagamentos, zero sobra.
- **Arquivos**: `src/v2/data.ts` (`invoiceRollup`, `uninvoiced`, `splitByTaxShare`),
  `src/v2/lib/api.ts` (invoices[], createInvoice com valor explícito, sync desligado, fetchJobs
  agregado), `src/v2/screens/Job.tsx` (seleção, resumo, CTA, etapa, contrato na #1).
- **Gates**: tsc limpo, jest 135/135 (13 testes novos), `expo export ios` OK (3,25 MB).

---

### [2026-08-24 19:40] — feat: ONDA G / onda 3, parte 1 — desconto no orçamento (G-1)
- **O que mudou**: o orçamento passa a ter desconto para BAIXO, do jeito que o Gladson pediu: um
  stepper de **%** (o caso "contractor -30%") e um campo de **total final** onde ele digita o número
  redondo ("deu 1.099, quer deixar 1.000"). O desconto é do CLIENTE — sai como linha "Discount" no
  PDF do orçamento, no da fatura, no texto de e-mail/WhatsApp e no contrato.
- **Decisões do dono (24/08)**: D1 o cliente vê o desconto · D2 imposto sobre o valor já descontado
  · D3 as duas entradas.
- **O gatilho do banco era o ponto perigoso** e virou a primeira coisa a ser resolvida:
  `update_estimate_totals()` recalcula e SOBRESCREVE o total a cada escrita em `line_items`, então
  um desconto que só existisse no app seria apagado no próximo toque num item (mesmo formato do bug
  do imposto zerado de maio). Agora o desconto entra na conta do gatilho: sai do subtotal ANTES do
  imposto e encolhe a base tributável na proporção do que era tributável.
- **Provado em produção ANTES de aplicar** (transação com ROLLBACK): o gatilho novo disparado nos
  **92 orçamentos reais** com desconto zero não mudou NENHUM total, imposto, subtotal ou margem —
  nem um centavo. Com desconto, os casos batem com o cálculo de referência feito à parte
  (30% → 2.075,93 / imposto 110,80 / total 4.954,65 · $1.000 → imposto 135,41 / total 6.055,19 ·
  100% ou valor absurdo → desconto = subtotal, total 0, nunca negativo).
- **A conta do "total redondo"** é fechada, sem laço de tentativa: `D = (S + k − alvo) / (1 + k/S)`
  com `k = tributável × taxa`, mais uma passada de correção que absorve o centavo do arredondamento.
  14 testes novos no jest (122 no total), incluindo os mesmos números que o banco devolveu.
- **Contrato**: o template imprimia "Subtotal X | Tax Y" ao lado do total — com desconto, os três
  números não fechariam num documento LEGAL. Placeholder `{{discount_line}}` novo (carregando o
  próprio separador, então sem desconto a linha fica idêntica); `fillTemplate` troca placeholder
  desconhecido por vazio, então template novo com build antigo é inócuo.
- **Arquivos**: `supabase/migrations/20260824020000_discount.sql` (colunas + gatilho + template),
  `src/v2/data.ts` (`Discount`, `resolveDiscount`, `calcTotals` com desconto, `discountFromTarget`),
  `src/v2/lib/api.ts` (grava/copia/sincroniza o desconto; variável do contrato), `src/v2/lib/send.ts`
  (linha no PDF e no texto), `src/v2/screens/Flow.tsx` (bloco na tela + `TotalTarget`),
  `src/v2/screens/Job.tsx` (linha nas abas Quote/Invoice + hidratação ao editar), `src/v2/ui.tsx`.
- **Decisão técnica**: `calcTotals` mantém o caminho SEM desconto exatamente como era (sem
  arredondar), e só o caminho COM desconto arredonda em cada passo — espelhando onde o
  `numeric(12,2)` do banco arredonda. Sem isso, "arredondar pra $1.000" salvaria $1.000,01; e
  mexer no caminho antigo mudaria o número de todo orçamento que já existe.
- **Gates**: tsc limpo, jest 122/122, `expo export ios` OK (3,24 MB).

---

### [2026-08-24 18:05] — feat: ONDA G / onda 2 — referência no pagamento e no recibo, logo + paginação no PDF, baixar fotos no portal
- **O que mudou**: os 3 itens médios da lista do Gladson (`docs/FEEDBACK_GLADSON_2026-07-31.md`).
  - **G-6 referência do pagamento** ("quando o cara paga em cheque a gente coloca o número do
    cheque, e o nome do banco… seria bom sair no recibo"): campo opcional "Reference (check #,
    bank)" no Record payment, gravado no pagamento, mostrado na lista de recebidos e impresso no
    recibo (PDF e texto). Reemitir o recibo de um pagamento antigo leva a referência gravada.
  - **G-8 logo + paginação do PDF**: o logo que o dono sobe no perfil existia no banco e não era
    impresso em NENHUM documento — agora vai no cabeçalho do orçamento, da fatura e do recibo.
    Paginação: `break-inside: avoid` nas linhas de item, nos totais e nos blocos de foto, e
    `break-after: avoid` nos títulos de seção (um item era cortado no meio pela quebra de página).
    E as fotos **saíram de cima e foram pro fim do documento**: seis fotos de 220px logo abaixo do
    cabeçalho comiam a primeira página inteira e empurravam a tabela de itens pra quebra — o
    cliente abria o orçamento e via fotos, não o preço.
  - **G-7 baixar as fotos no portal**: botão "Download all photos (N)" no topo da tela do cliente
    e "Download these photos" dentro de cada fase. Zip montado NO NAVEGADOR (jszip carregado sob
    demanda), com contador "Preparing 7 of 30…"; os arquivos saem numerados e nomeados pela fase.
- **Arquivos**: app — `src/v2/lib/api.ts`, `src/v2/lib/send.ts`, `src/v2/screens/Job.tsx`,
  `src/v2/data.ts`, `supabase/migrations/20260824010000_payment_note_reference.sql`; portal —
  `src/components/DownloadPhotos.tsx` (novo), `src/components/PhaseCard.tsx`,
  `src/app/p/[token]/page.tsx`, `package.json` (jszip).
- **Decisão técnica (banco)**: `invoice_payments` JÁ tinha uma coluna `note` criada com a tabela e
  nunca usada (0 de 23 linhas em produção; nem o v1 escrevia nela). Em vez de criar uma segunda
  coluna de texto livre do lado de uma vazia, a migration dá sentido à que existe: comentário +
  CHECK de 120 caracteres. (Cheguei a aplicar em produção uma primeira versão que criava
  `reference`; a corretiva no mesmo minuto dropou a coluna e ficou só o `note`. O arquivo no repo
  reflete o estado final — prod tem os dois registros no schema_migrations.)
- **Decisão técnica (zip)**: montar no navegador e não numa rota serverless. As fotos estão em
  bucket público com `access-control-allow-origin: *` (conferido por curl), então o navegador
  busca direto; pela Vercel, os bytes passariam por uma function com teto de 4,5MB de resposta.
  Compressão STORE — JPEG já vem comprimido, deflate só gastaria CPU.
- **Fora de escopo, de propósito**: o CONTRATO continua sem logo. O sanitizador do portal proíbe
  `<img>` de propósito desde a Onda C (garantia de "o que o cliente assina é o que ele vê") e
  afrouxar isso por um logo seria trocar segurança por enfeite. Se o dono quiser, dá pra pôr o
  logo no cabeçalho DA PÁGINA (fora do HTML assinado) — muda a RPC, fica pra depois.
- **Gates**: app tsc limpo, jest 108/108, `expo export ios` OK (3,24 MB Hermes); portal tsc limpo,
  `next build` OK, eslint sem erros novos (os 6 warnings são pré-existentes).
- **Revisão ponto a ponto (dono: "revisa tudo, isso vai pra produção")** — 1 bug REAL meu, achado e
  corrigido antes de qualquer teste no device: o arquivo temporário do download era
  `pqimg_<Date.now()>_<índice>`, e isso parou de ser único no instante em que o LOGO passou a
  baixar EM PARALELO com as fotos — os dois começam no mesmo milissegundo e o índice 0 do logo
  colide com a foto 0, dois downloads escrevendo o mesmo arquivo de cache. Virou um contador
  monotônico (`tmpSeq`), que não colide consigo mesmo; o parâmetro `i`, agora morto, saiu.
  Conferido também: (a) `note` tem os MESMOS grants de coluna que `amount`/`method` para
  `authenticated` (INSERT/SELECT/UPDATE) — o pega-ratão de coluna nova sem GRANT não se aplica;
  (b) o `Sheet` já vive dentro de um `KeyboardAvoidingView`, então o campo de texto novo não fica
  atrás do teclado; (c) a referência passa pelo `escapeHtml` do recibo; (d) o botão de download da
  fase NÃO fica aninhado dentro do `<button>` do cabeçalho da fase (HTML inválido/clique morto).
- **Provado em produção** (transação com ROLLBACK, zero dado real tocado): pagamento com
  `note = 'Check #1234 · Chase Bank'` grava e volta inteiro; com 121 caracteres o banco recusa
  (23514) — que é exatamente o motivo do `.slice(0, 120)` no `recordInvoicePayment`, senão o dono
  levaria um erro cru na cara. Contagem depois do teste: 23 pagamentos, 0 sobras.

---

### [2026-08-24 16:10] — feat: ONDA G / onda 1 — abrir portal e contrato pelo app, progresso do upload de fotos, pagamento parcial visível
- **O que mudou**: primeira das 3 ondas do feedback de uso real do Gladson (8 áudios de 30-31/07,
  repassados pelo dono em 24/08 e catalogados em `docs/FEEDBACK_GLADSON_2026-07-31.md`). Os 4 itens
  que não tocam em banco nem no portal:
  - **G-3 ver a tela do cliente**: "pra ver como está a tela do cliente eu tenho que mandar pra mim
    mesmo". A aba Progresso ganhou **"Ver como cliente"** (ícone de olho) ao lado do "Link do
    cliente" — mesma cunhagem de token do share, só que abre o `progressLink` no navegador.
  - **G-4 abrir o contrato**: mesma queixa ("mando o link pro meu WhatsApp e clico em cima"). A aba
    Contrato ganhou um botão que abre o `agreementLink`. Assinado → "Abrir o contrato assinado" (o
    portal serve a visão somente-leitura com PDF); não assinado → **"Ver a página de assinatura"**,
    nome escolhido de propósito: essa URL é o formulário de assinatura, e o rótulo evita que o
    próprio dono assine o contrato do cliente sem perceber.
  - **G-2 progresso do upload**: "não parece que a foto está sendo carregada". `addPhasePhotos` e
    `addProjectPhotos` (via `uploadProjectPhotos`) aceitam um callback `onProgress(done,total)`.
    Na fase: quadradinhos-fantasma com spinner (um por foto ainda em voo) + o botão vira "Enviando
    2 de 5…" e trava os outros. No álbum do orçamento: contador `2/5` embaixo do spinner. O contador
    anda também quando uma foto FALHA — senão travaria em "7 de 8" bem na hora do alerta de erro.
  - **G-5 pagamento parcial**: a raiz não era o banco (`invoices.status` grava 'Partially Paid'
    corretamente — confirmado em prod: INV-0026/0010/0009/0008) nem a aba Fatura (o badge PARTIAL
    sempre esteve certo lá). O que faltava: **o cabeçalho do job e a lista** só mostravam
    "Faturado", como se nada tivesse entrado. Agora o `StageChip` aceita `partial` → "Pago parcial"
    em tom info (na Home, na lista de jobs e no topo do job), o cabeçalho ganhou "Pago $4.000 de
    $8.000 · Faltam $4.000" e o NEXT STEP mostra o saldo.
- **Arquivos**: `src/v2/screens/Job.tsx` (o grosso), `src/v2/lib/api.ts` (onProgress + `partial` no
  fetchJobs), `src/v2/ui.tsx` (StageChip parcial + string), `src/v2/data.ts` (`Job.partial`),
  `src/v2/screens/Tabs.tsx` (passa o partial), `docs/FEEDBACK_GLADSON_2026-07-31.md` (os 9 pontos).
- **Decisão técnica**: abrir link usa o `Linking` do react-native, NÃO `expo-web-browser`. A visão
  in-app seria mais bonita, mas é um módulo nativo novo — e este projeto já perdeu 10 builds (18→28)
  para uma dependência expo fantasma. Zero dep nova, zero risco de build.
- **Decisão técnica 2**: `partial` NÃO virou um sétimo `Stage`. O Stage é derivado do banco e
  compartilhado com a Home, o portal e o Timeline; parcial é um eixo de dinheiro, então virou um
  flag ortogonal, do mesmo jeito que `closed` (lost/archived) já é.
- **Bug corrigido**: pagamento parcial invisível fora da aba Fatura (queixa direta do Gladson).
- **Gates**: tsc limpo, jest 108/108, bundle de produção do Metro exportado sem erro (3,23 MB Hermes).
- **Revisão ponto a ponto (pedido do dono, "isso é produção")**: 1 achado meu corrigido antes do
  fim — o contador de upload era um slot ÚNICO e travava o "Add photos" de TODAS as fases enquanto
  uma subia (botão morto sem explicação = a mesma classe de queixa que a onda conserta). Agora o
  estado é `Record<phaseId, {done,total}>`: cada fase mostra o seu progresso e as outras continuam
  clicáveis. Verificado também: field member não vê o chip parcial (`showStage`/RLS), overpay não
  vira parcial (`invoiceBalance` clampa em 0), fatura legada 'Paid' sem ledger não vira parcial
  (`amountPaid` = total), contrato anulado não oferece o botão de abrir (o fetch ignora void), e o
  `recordInvoicePayment` já invalida `jobDetail`+`jobs` (o parcial aparece na hora).
- **Ressalva RESOLVIDA (o dono perguntou "isso é problema? tem jeito melhor?")**: tinha. Espiar o
  próprio job carimbava `projects.activated_at`, que é a data de "Start" que o PORTAL mostra pro
  cliente. `ensureShareToken` ganhou o parâmetro `activate` (default true): o preview passa
  `false` (só cunha o token) e o compartilhar segue carimbando. De brinde, o carimbo saiu de
  dentro do "criei o token agora" e passou a rodar TAMBÉM quando o token já existe — hoje há 1 job
  em produção (de 17 com token) com `activated_at` NULL mostrando "—" de data de início pro
  cliente; no próximo compartilhamento ele se conserta sozinho.

### [2026-07-28 07:20] — fix: REVISÃO ADVERSARIAL da Onda F (4 revisores) — 17 achados corrigidos antes do build 33
- **O que mudou**: o dono pediu "revisa tudo que vc fez" antes de mandar pra Apple. 4 revisores
  independentes (lógica do app, banco/RLS/perda de dado, pipeline do PDF, e produto contra os 7
  áudios do Gladson). Vereditos: 3× "pode ir pro build" e 1× "atende parcialmente" no produto.
  Tudo que era real foi corrigido:
- **PDF/fotos**: (1) "Save PDF" ficava até 60s mudo e um 2º toque gerava dois share sheets (o iOS
  derruba um e mostra "Could not send") → `SendSheet` com busy/spinner, 2º toque ignorado, fecha só
  quando termina, e timeout de 9s por foto; (2) o fallback do `ImageManipulator` com URL remota era
  **código morto no iOS** (o nativo exige `isReadableFile`) → o resize passou a rodar no arquivo
  BAIXADO, o que também derruba o HTML de ~3,6MB pra ~500KB; (3) data URI não passa mais pelo
  `escapeHtml` (eram 5 cópias de ~600KB por foto antes de imprimir); (4) PNG rotulado certo;
  (5) entrada nula em `doc_photo_urls` não derruba mais o PDF inteiro.
- **Banco/perda de dado**: `deleteProject` confere ANTES que o job existe e é do dono (o delete de
  `agreements` é irreversível e o PostgREST não tem transação) e usa `count:'exact'` — um delete
  negado por RLS não "apaga" mais em silêncio; limpa também a assinatura do cliente
  (`contract-signatures`) e pagina a limpeza do storage; `addProjectPhotos` lê os arrays DEPOIS do
  upload (remover foto durante o envio ressuscitava a URL de um arquivo já apagado) e o strip
  congela enquanto sobe; `projectDeleteFacts` devolve `unknown` (falha de rede virava "nada a
  perder"); a fase "Before photos" importa as fotos **curadas** (`doc_photo_urls`), não o rolo todo.
- **Produto (o que o Gladson reclamaria de novo)**: swipe pra deletar também na **tela inicial**
  (ele disse "primeira tela onde aparece o projeto"); tocar na 7ª foto era no-op mudo → agora
  explica o limite; "Add photos" virou o 1º item da tira + link no título (estava escondido no fim
  com 8 fotos); **parcelas**: chips 3/4/6/10/12 + "dividir igualmente" — subir um plano salvo pra
  12× criava linhas de $0,00 e **desabilitava o salvar**, provável origem real do "não me dá opção
  de 10, 12 vezes"; data também no modo entrada+saldo (era fixa em "hoje"); "Final photos" volta
  pro fim quando entra fase nova; nomes das fases traduzidos na tela (banco segue em inglês pro
  portal); datas do app no idioma do dono; fotos de progresso com retry + aviso de falha;
  long-press 350→650ms (disputava com o tap de escolher foto do documento); foto não é mais
  removível em job arquivado; calendário respeita o ±365 do stepper; swipe não remonta o card.
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/lib/send.ts`, `src/v2/ui.tsx`, `src/v2/screens/Job.tsx`,
  `src/v2/screens/Tabs.tsx`.
- **Decisão técnica**: mantido o `automaticallyAdjustKeyboardInsets` puro no iOS — ele rola até o
  campo de notas (a queixa do dono), ao custo da barra "Save changes" ficar atrás do teclado até
  arrastar a lista. Trocar por KAV 'padding' resolveria a barra e devolveria o bug original.
- **Gates**: tsc limpo, jest 108/108, 27 chaves i18n novas com en/es/pt.

### [2026-07-28 06:30] — feat: ONDA F — os 5 pedidos do Gladson no uso real do build 32
- **O que mudou**: fechados os 5 itens que o usuário real mandou por áudio/print (2 deles repetidos
  duas vezes = os que mais incomodavam):
  1. **Deletar job de vez** (só o dono): arrastando o card da lista pra esquerda (SwipeRow em
     PanResponder puro — sem native module novo) e no menu ⋮ do job. Duas confirmações, e a primeira
     DIZ o que morre junto (valor já recebido / contrato assinado). No banco: `agreements.project_id`
     é o único filho com FK NO ACTION → é apagado antes; todo o resto (estimate/itens/fatura/
     schedule/pagamentos/fases/fotos/comentários/tokens) vai por CASCADE; storage limpo depois.
  2. **Teclado cobrindo "Notes for the client"**: a EstimateScreen era a única tela com input no fim
     sem tratamento de teclado — agora `automaticallyAdjustKeyboardInsets` (iOS insere o inset E rola
     até o campo) + KAV 'padding' só no Android (a janela edge-to-edge não redimensiona lá).
  3. **Fotos**: (a) **causa raiz do "coloco 8, aparece 3"** — o expo-print tira o snapshot do HTML sem
     esperar `<img>` remoto; agora cada foto é baixada e embutida como data URI antes de gerar o PDF
     (dois mecanismos: download de arquivo → pipeline de imagem → em último caso a URL remota).
     (b) **"Add photos" no job salvo** (câmera ou galeria) — antes só dava pra pôr foto na captura
     inicial; entram também na seleção do documento enquanto couber. (c) segurar a foto = remover.
     (d) upload em lotes de 3 com 1 retentativa, e **falha de foto agora é avisada** (era silenciosa).
     (e) o padrão do documento passou de 4 pras 6 fotos do cap.
  4. **Plano de pagamento**: os dias andavam de 5 em 5 (0/5/10/15) e a data combinada com o cliente era
     inalcançável → passo de 1 em 1 **e a data virou botão**: abre um calendário mensal (DateSheet,
     zero dependência nova) e escolhe o dia exato.
  5. **Progresso**: fases "Before photos" (já nascendo com as fotos do orçamento importadas e marcada
     como concluída) e "Final photos" — automáticas ao criar as fases do orçamento, e um link
     "Add before & final photo phases" para os jobs que já existiam. Criadas com `auto_seeded=false`
     para o "sync with quote" nunca varrer.
- **Arquivos**: `src/v2/lib/api.ts` (deleteProject/projectDeleteFacts/addProjectPhotos/
  deleteProjectPhoto/ensureBookendPhases/upload em lote), `src/v2/lib/send.ts` (fotos embutidas no
  PDF), `src/v2/ui.tsx` (SwipeRow + DateSheet), `src/v2/screens/Job.tsx`, `Tabs.tsx`, `Flow.tsx`.
- **Decisão técnica**: deletar é sempre permitido pro dono (ele pediu), mas a 1ª confirmação mostra
  dinheiro recebido e contrato assinado; office/field não veem a opção porque `projects` não tem
  policy de DELETE pra eles (botão seria no-op silencioso). Swipe feito em PanResponder de propósito:
  react-native-gesture-handler seria um módulo nativo novo só pra isso.
- **Bug corrigido**: fotos sumindo do PDF do orçamento (raiz: corrida do expo-print com imagem remota)
  e perda silenciosa de foto no upload.
- **Provado em prod**: job sintético com cliente+estimate+itens+fatura+schedule+pagamento+contrato
  ASSINADO+fase+foto+comentário+token → delete sem agreements primeiro **falha** (FK 23503, como
  esperado) e a sequência do app (agreements → project) apaga tudo (12 contagens em 0) mantendo o
  **cliente** intacto. Gates: tsc limpo, jest 108/108.

### [2026-07-18 02:30] — fix: PENTE FINO COMPLETO (dono pediu após o hotfix) — 3 frentes, 2 nits corrigidos
- **3 frentes** (o ângulo que faltou quando o bug de recursão escapou): (1) análise de ciclos de RLS,
  (2) teste de ESCRITA REAL em prod, (3) fluxo/lógica do app. Vereditos:
- **Ciclos de RLS: LIVRE** — grafo das 95 policies é um DAG puro (tudo aponta p/ projects e team_members,
  que são sinks sem aresta de saída inline); nenhum ciclo latente; o projects↔clients está comprovadamente
  quebrado via client_belongs_to_owner() definer. O padrão "infinite recursion" não pode se repetir.
- **Escrita real: 100% sã** — INSERT/UPDATE/DELETE de 14 tabelas centrais como owner em prod, todos 2xx,
  zero recursão/42501/grant-faltando/falha-silenciosa; triggers e numeração EST-1004/INV-0002/RCPT-0001
  corretos; imposto só sobre item tributável (bug histórico não reincide); **arquivar e salvar orçamento
  provados sãos**; dados do Gladson intactos (contagem idêntica antes/depois); cenário desmontado.
- **Fluxo/lógica: sem bloqueante, sem regressão** das mudanças de hoje (fotos da obra, tela do cliente,
  hotfix). Dinheiro cent-exato, máquina de estados coerente, i18n completo. 2 nits corrigidos:
  (a) MÉDIO — o gate M2 do save da empresa era `profile === undefined`, que NÃO cobre `null` (erro
  transitório de query retorna null) → save podia gravar em branco por cima do perfil real; trocado por
  `!profile` (cobre loading E erro; owner novo tem row via trigger, então segue habilitado). (b) BAIXO —
  "New quote for {cliente}" com trial expirado agora mostra o Alert antes de ir pra Plans (consistência
  com Home/Jobs). Aceito (1ª build): listas mostram empty-state em erro de query sem retry.
- **Gates**: tsc limpo, jest 108/108. **Ressalva**: durante o teste de escrita, o perfil de empresa da
  conta de TESTE do dono (rodrigo) teve company_name/phone/defaults resetados; restaurei company_name=
  'Rodrigo Reformas' (crítico p/ envio de documentos); phone e defaults de imposto/margem ele reconfigura
  na tela de empresa (não afeta salvar/arquivar). Conta do Gladson NUNCA tocada.

### [2026-07-18 01:45] — HOTFIX CRÍTICO: recursão infinita de RLS em projects (salvar orçamento / arquivar)
- **Sintoma (uso real do dono)**: "Could not save / Could not update — infinite recursion detected in
  policy for relation projects" ao salvar orçamento (INSERT projects) e ao arquivar job (UPDATE projects).
- **Causa**: a Onda E (migration 170000) deu às policies office de projects um WITH CHECK com
  `EXISTS(clients ...)`, e a policy de clients da Onda B (100100) já tinha `EXISTS(projects ...)` →
  ciclo projects→clients→projects que o Postgres detecta no PLANEJAMENTO, quebrando QUALQUER
  insert/update de projects, inclusive do OWNER (todas as policies permissivas entram no plano).
  Escapou às 9 rodadas de revisão porque os E2E de office testaram INSERT de clients/leitura, nunca
  INSERT/UPDATE de projects; e o Gladson não criou/arquivou job desde 12/07 (só editou existentes),
  por isso prod não acusou.
- **Fix (migration 20260718020000, APLICADA)**: a amarra "client_id pertence ao mesmo dono" virou a
  função SECURITY DEFINER `client_belongs_to_owner()` — consulta clients SEM reentrar nas policies de
  clients, quebrando o ciclo e mantendo a garantia anti-cross-tenant idêntica. Só as 2 policies office
  de projects mudaram.
- **Provado em prod (owner rodrigo)**: UPDATE projects 204, INSERT projects com client 201, UPDATE
  status=archived 204, cleanup 204 — o dado de teste alterado na verificação foi restaurado.
- **LIÇÃO**: após mudança de RLS, testar INSERT E UPDATE de CADA tabela central (não só SELECT/clients).
  Ciclo mútuo de policies (A→B e B→A) = recursão estrutural, independe dos dados.

### [2026-07-17 06:45] — feat: portal do cliente — revisão da tela de acompanhamento (pedido do dono)
- **Pedido**: "revisa o link da tela do cliente pra ficar bem estruturado, pra ele acompanhar a obra da
  melhor forma". A estrutura já era sólida (header do contratante, barra de progresso, fases expansíveis
  com fotos+lightbox+comentários) — 3 melhorias de valor pro cliente, todas no repo photoquote-client-portal:
  (1) **Recência**: linha "Last update {há X}" no card de progresso — a 1ª coisa que o cliente quer saber
  ("teve novidade?"); vira "Project complete" quando todas as fases estão concluídas. (2) **Empty-state
  amigável**: quando o contratante ainda não postou nada, em vez de uma parede de fases "Not started" a 0%,
  aparece "Work is scheduled — {contractor} vai postar fotos/atualizações aqui; o link fica vivo o projeto
  todo". (3) **Estado vazio por fase**: fase expandida sem fotos/notas/comentários agora diz "This phase
  hasn't started yet" em vez de só a caixa de comentário seca.
- **Arquivos**: utils.ts (lastActivityAt/hasAnyActivity), ProgressCard.tsx, p/[token]/page.tsx, PhaseCard.tsx.
- **Verificado**: nome do cliente nos comentários já cai em "Client" quando vazio (RPC add_client_comment,
  sem bug). Build limpo, eslint 0 erros. Deploy Vercel. NÃO afeta o app nem o build 32.

### [2026-07-17 06:10] — feat: fotos da obra — câmera OU galeria + apagar foto (pedido do dono)
- **O que mudou (aba Progress/fases do Job)**: (1) ao adicionar foto de progresso, escolha entre 📷 tirar
  na hora (câmera, com pedido de permissão) ou 🖼️ galeria — antes abria SÓ a galeria; (2) apagar uma foto
  de progresso — long-press ou o botão "x" na miniatura (owner/office; field só adiciona). A foto some do
  app E do portal do cliente (a linha phase_photos é a fonte); o objeto do storage é removido best-effort.
- **Banco**: migration 20260717060000 APLICADA — policy "Team office deletes phase photos" (office gerencia
  as fotos da obra do dono; owner já apagava via "Users manage own phase photos"; FIELD sem DELETE, só adiciona).
- **App**: api.ts deletePhasePhoto; Job.tsx shootPhoto/pickFromGallery/uploadAssets/removePhoto (try/catch nos
  dois launches), miniatura com botão de excluir; 7 strings i18n (en/es/pt). **app.json**: purpose strings
  NSCamera/NSPhotoLibrary/NSMicrophone específicas (exigência da App Store — a Apple rejeita as genéricas).
- **Revisão**: adversarial focada — VEREDITO PRONTO, 0 bloqueante/alto; RLS de delete conferida (owner via
  policy própria, office via a nova, field bloqueado no banco E escondido na UI nos 2 caminhos); câmera não
  é módulo novo (expo-image-picker/camera já nas deps — sem risco de saga de build). Nits absorvidos
  (try/catch nos launches, newline do app.json). Órfão de storage no delete do office = classe já aceita
  (igual deletePhase). tsc limpo, jest 108/108.

### [2026-07-17 05:30] — fix: REVISÃO PRÉ-BUILD-32 (dono "revisa cada micro coisa") — 4 revisores de PRODUTO
- **Contexto**: build 31 (Ondas A+B) em uso REAL pelo Gladson há 1 semana SEM erros (contrato assinado,
  cotação IA c/ voz, portal c/ cliente comentando, pagamento $2.400 c/ recibo — auditoria de prod
  confirmou integridade 100% zerada). Ondas C/D/E prontas mas só no túnel; esta revisão precede o OK
  do dono pra build 32. 4 revisores focados em FLUXO/lógica de negócio/código morto (não segurança —
  já auditada 8×). Vereditos: jornada owner SIM(1 ressalva), papéis/billing SIM, portal PRONTO,
  produção SAUDÁVEL. Achados corrigidos:
- **A1 (ALTO — dinheiro/legal)**: contrato enviado congela o snapshot da fatura; editar o orçamento
  ou o plano DEPOIS deixava o "Resend signing link" mandar um contrato desatualizado (valor errado)
  que o cliente ainda podia assinar. Fix: `voidUnsignedAgreements()` anula contratos NÃO-assinados ao
  editar quote (via syncInvoiceWithEstimate) ou plano (updateInvoicePlan); fetchJobDetail ignora void
  → a aba Contract volta a "gerar" e cria um fresco. Assinado é imutável (nunca tocado).
- **Papel OFFICE (M1)**: `requireCompany` oferecia "Add company info" ao office → beco silencioso (save
  de 0 linhas sem erro, guard bloqueava pra sempre). Agora membro recebe "peça ao dono"; só owner vê o
  atalho.
- **Pagamento (M1)**: valor acima do saldo (fat-finger $9409 p/ saldo $940.90) era aceito sem aviso e
  virava "Paid in full" errado (ledger append-only, sem estorno). Agora confirma antes.
- **CompanyScreen (M2)**: save ficava habilitado antes do profile hidratar → salvar no form vazio
  zerava nome/licença/defaults. Agora `disabled` até a query retornar.
- **Cliente EN (L1)**: item novo nascia com descrição localizada (`tr('flow.newLineItem')`="Novo item")
  e imprimia no PDF EN do cliente — literal 'New line item' fixo (regra travada de saída EN).
- **Contrato sem cliente (L2)**: erro cru em inglês caía em alert pt/es → pré-check localizado.
- **Reset de senha (M3)**: o link do e-mail não tinha destino (caía no Site URL sem handler → 404).
  Criada a página **/reset** no portal (troca de senha via token do hash) + `redirectTo` no app.
- **Higiene**: comentário que mentia ("MVP só cria field" pós-Onda E) corrigido; 6 strings i18n órfãs
  removidas (flow.jobSuffix/newEstimate/newLineItem, job.dueOn, tabs.notifications, team.members).
- **Gates**: tsc limpo, jest 108/108, build do portal ok, eslint 0 erros.
- **NÃO aplicado (decisão do dono, no relatório)**: remover o app v1 inteiro + 5 deps órfãs
  (@react-navigation etc.), a rota `onboard` inalcançável, deps ngrok/react-native-web, e a limpeza
  cosmética fina (10 ícones/7 tokens de tema órfãos) — tudo identificado, sem risco funcional, deixado
  pra pós-build por cautela. Prod: 10 phase-photos órfãos do Gladson (limpeza) + duplicate_index em
  invoices, ambos p/ migration de higiene futura. SEM BUILD até o OK do dono.

---

### [2026-07-12 13:10] — fix: REVISÃO FINAL INTEGRAL ("revisa tudo tudo tudo") — família office fechada
- **4 revisores frescos** sobre o estado atual (app 2d20b6f, portal 1378e36, prod pós-9-migrations).
  Vereditos: EDGE **APROVADO** (drift ZERO — 5 functions byte-idênticas ao repo, sha256; logs limpos;
  zero segredo nos commits do dia); PORTAL **PRONTO** (9 jornadas vivas OK); BANCO **SIM com ressalva**
  e APP **NÃO sem fixes** — ambos convergindo na mesma família: o papel OFFICE nunca tinha sido
  exercitado de ponta a ponta nos fluxos financeiro/contrato/portal.
- **Migration 20260712190000 (APLICADA)**: H1 agreements p/ office (SELECT/INSERT/UPDATE c/ amarras) —
  sem isso a aba Contract era cega e o envio dava 42501; H2 project_share_tokens p/ office (ALL c/
  amarra) — "Client link" morria; A3 invoice_payments UPDATE p/ office — recibo saía com número
  FANTASMA (UPDATE silencioso de 0 linhas); **H3 effective_owner_id()**: next_invoice_number/
  next_receipt_number chaveavam o contador em auth.uid() — office numeraria com a sequência PRÓPRIA
  e colidiria com a do dono (23505 na frente do cliente); agora o contador é do dono efetivo (solo
  idêntico) + lpad greatest() (INV/RCPT >9999 não trunca — mesma classe do fix de estimates); **M1
  portal**: get_agreement_by_token devolvia contrato COMPLETO (preços+HTML+pivô projectToken) p/
  agreement VOID via PostgREST cru — agora não-assinável/não-assinado retorna só {status,companyName}
  (provado: void = 2 chaves; assinado = 12 chaves intactas); token de teste ADIVINHÁVEL
  (test_agreement_token_2026_demo → dados reais) rotacionado p/ aleatório (provado morto).
- **App**: createAgreement lia users cru (office → contrato "Your Company") → fetchCompanyProfile
  c/ fallback RPC; ensureReceiptNumber agora FALHA ALTO se o número não persistir (nunca mais número
  fantasma em PDF); botão "Delete client" escondido p/ office (falhava em silêncio e o cliente
  "ressuscitava"); gate de trial no 3º e último entry point de câmera (ficha do cliente); copy do
  delete-account p/ MEMBRO diz a verdade (só apaga a conta pessoal/acesso — dados da empresa ficam).
- **Edge v8/v5/v3**: contador de rate-limit ignora linhas 'rate_limited' (lockout auto-renovável
  eliminado). **Portal**: mapper tolerante ao payload mínimo do void + título próprio da página de
  progresso (era "Service Agreement" na aba).
- **Gates**: tsc limpo, jest 108/108, build do portal ok. Registrados p/ futuro: FKs NO ACTION→
  CASCADE (estimates/invoices/agreements/contract_templates.user_id), RESTRICT p/ agreement assinado,
  smoke 200 real de ai-estimate/transcribe pós-deploy, warnings ESLint pré-existentes do portal.

### [2026-07-12 11:50] — fix: vereditos dos revisores D e E — todos os achados corrigidos
- **Revisor D (APROVADO c/ ressalva dura)**: A1 — o wipe de storage do delete-account usava list()
  NÃO-recursivo: pastas voltam como entradas virtuais e remove('pasta') é no-op silencioso → NENHUMA
  foto aninhada (uid/projeto/…, uid/projeto/fase/…) era apagada, enquanto a privacy policy publicada
  promete apagamento (bloqueante de SUBMISSÃO à loja). Fix: walk recursivo (id===null ⇒ pasta ⇒ desce;
  remove em lotes de 100) → **delete-account v2 deployada e RE-PROVADA E2E**: conta descartável com
  foto aninhada E duplo-aninhada → ambas mortas (400) pós-delete; latência 16,4s→4,7s (resolve M3).
  M1: PNGs de assinatura (PII do cliente final, bucket público, indexados só por
  agreements.signature_image_url) ficavam órfãos — agora os paths são coletados ANTES do cascade e
  removidos. M2: texto da privacy ajustado ("unguessable links" + remoção na exclusão). B1: copy
  "save up to 25%". B2-B6 registrados (FKs NO ACTION p/ CASCADE em migration futura; gate de office
  sob dono expirado = quando billing ativar).
- **Revisor E (REPROVOU → corrigido)**: BLOQUEANTE — 3ª mordida da classe B1: uploadProjectPhotos
  (api.ts:70) com upsert:true; office subindo na pasta do DONO só tem INSERT → x-upsert exige SELECT
  → 403-em-400 engolido pelo best-effort → fotos de capa + doc_photo_urls sumiam em TODO job criado
  pelo office. Provado pelo revisor em prod (Probe A upsert=400/403; Probe B sem upsert=200). Fix:
  upsert removido (path é projectId recém-criado — overwrite inútil). MÉDIO — UPDATE de estimates/
  invoices do office sem WITH CHECK permitia mover project_id/estimate_id p/ ref de outro tenant
  (self-harm, sem leak, mas viola a invariante documentada) → migration 20260712180000 APLICADA com
  WITH CHECK simétrico ao INSERT. BAIXO (RPC extra p/ field) documentado, inócuo.
- **Gates**: tsc limpo, jest 108/108; zero resíduos de E2E em prod (contas/objetos/policies tmp).
- **Lição de arquitetura (3 mordidas)**: TODO upload supabase.storage NUNCA usa upsert:true a menos
  que exista policy SELECT para o papel que sobe; nomes únicos (uuid/projectId) tornam upsert inútil.

### [2026-07-12 10:40] — feat: ONDA E — papel OFFICE completo (banco + app)
- **O que mudou**: o funcionário de ESCRITÓRIO virou realidade. Banco (migration 20260712170000,
  APLICADA): 24 policies novas — office lê FATURAS/pagamentos/cronograma (faltava) e ESCREVE o
  negócio do dono inteiro (clientes, jobs, orçamentos, line items, faturas, pagamentos, cronograma,
  fases, fotos, comentários, media) sempre com user_id=dono; amarras de tenant no WITH CHECK
  (user_id ∈ member_owner_ids['office'] + filho amarrado ao MESMO user_id do pai — client_id/
  estimate_id de outro tenant morre em 42501) e as restritivas anti-hijack da Onda B valem por
  cima; storage: office sobe foto de job na pasta do DONO (project-photos). O que office NÃO faz:
  equipe (project_members/team_members), billing, editar perfil da empresa, deletar cliente/job.
  RPC get_owner_defaults() (definer, só office) — orçamento do office herda imposto/margem/
  cidade do dono. **App**: TeamScreen ganhou seletor de papel Campo/Escritório (flag de preços só
  p/ campo; office sempre vê; lista esconde o switch p/ office) + erro plan_upgrade_required
  localizado; Profile de membro agora cobre field E office (edição de empresa é do dono — RLS
  falharia silencioso); fetchCompanyProfile faz merge branding+defaults p/ office. Office usa os
  MESMOS caminhos do owner no resto do app (Home com métricas, criar orçamento, enviar, faturar).
- **E2E em prod (cenário montado e desmontado)**: office criado via function ✓; lê 8 projetos/
  7 clientes/4 orçamentos/**1 fatura** (política nova) ✓; CRIA cliente pro dono 201 ✓; hijack de
  tenant aleatório 42501 ✓; EDITA cliente 200 ✓; project_members 403 (equipe é do dono) ✓;
  linha users do dono invisível (billing/margens protegidos) ✓; limpeza total (0 sobras).
- **Arquivos**: migration 20260712170000, Team.tsx, Tabs.tsx, api.ts. tsc limpo, jest 108/108.
- **Decisão técnica**: office NÃO recebeu DELETE de clients/projects/estimates (destruição fica
  com o dono); atribuição de equipe segue owner-only (AssignSheet já era gated).

### [2026-07-12 09:30] — feat: ONDA D — planos/monetização (SEM billing real) + apagar conta + privacidade
- **O que mudou**: fundação completa de monetização SEM cobrar ninguém e SEM módulo nativo (RevenueCat
  entra só na build da loja — preservando Expo Go/túnel). **Planos**: catálogo Solo $39/mês ($29 anual)
  e Team $99/mês ($79 anual, 3 assentos, +$19/extra) semeado no banco (legados Free/Pro/Enterprise
  desativados); contas NOVAS nascem com trial de 14 dias (handle_new_user); os 2 usuários reais ficam
  'active' intocados (zero risco de bloqueio). **App**: tela Plans (catálogo, toggle mensal/anual,
  status do trial; CTA é stub explicando que a compra abre com o lançamento), banner de trial na Home
  (dias restantes; vermelho quando expira), gate SOFT de criação (trial expirado bloqueia SÓ criar
  orçamento novo — dados existentes seguem 100% visíveis), linha "Assinatura" no Profile. **Apagar
  conta (App Store 5.1.1(v))**: edge function delete-account v1 (verify_jwt ON; apaga memberships dos
  2 lados, ai_jobs, pastas de storage best-effort, e o auth user — cascade leva TODO o grafo de dados;
  fail-closed) + fluxo no Profile com dupla confirmação destrutiva (380ms entre Alerts). **Gate de
  plano na equipe**: create-team-member v2 recusa plan_upgrade_required p/ Solo PAGO (inerte hoje).
- **Portal**: /privacy e /terms públicas (exigidas na ficha da loja; deployadas) + links no footer.
  De carona: fix M1 da 2ª revisão da C (agreement VOID renderizava a página de ASSINAR com termos e
  total do contrato cancelado — agora cai em "no longer available") e migration race-guard no
  sign_agreement (B1: UPDATE re-exige status assinável; double-sign concorrente morre no banco).
- **2ª revisão da Onda C (pedida pelo dono)**: APROVADA em produção — 0 bloqueante/alto; provas vivas
  (print CSS servido, lockdown vigente byte-igual, shape RPC==TS, CSP nova inócua, force-dynamic ON).
  M1/B1 corrigidos acima; B2 (cascade invoice→agreement assinado) e B3-B5 registrados p/ futuro.
- **Docs**: APP_STORE_LISTING.md draft (nome/subtítulo/descrição/keywords/nutrition labels/IAP
  pendências do dono marcadas 🔶).
- **Arquivos**: app: Plans.tsx (nova), Tabs.tsx (banner/gates/profile), Navigator, api.ts, data.ts,
  billing.test.ts (+8 ⇒ jest 108/108, tsc limpo); banco: migrations 150000 (planos+trial) e 160000
  (race guard) APLICADAS; functions delete-account v1 + create-team-member v2 deployadas; portal
  6c2148e.
- **Decisão técnica**: billing real fora do bundle até o GO da build (stub honesto na UI); gate de
  criação é soft e owner-only (member nunca vê billing); 'active'/desconhecido NUNCA bloqueia
  (fail-open a favor do usuário pagante/legado).

### [2026-07-12 07:40] — feat: ONDA C — portal: contrato assinado vira cópia permanente do cliente
- **O que mudou (portal, repo photoquote-client-portal)**: página do agreement com status `signed`
  deixou de ser beco sem saída ("contact your contractor") — agora renderiza o CONTRATO COMPLETO
  (sanitizado server-side, mesmo pipeline do fluxo de assinar) + bloco de assinatura (imagem, nome,
  data, selo ESIGN) + botão **Download PDF** (window.print + @media print: só o documento imprime) +
  link "Track project progress" quando há share token ativo. Tela de sucesso pós-assinar ganhou
  "View signed agreement" e avisa que o link é a cópia permanente. Página de progresso ganhou card
  "Service Agreement" com estado. Baixos da revisão geral: ProgressCard não mostra mais 01/01/1970
  (activatedAt null → '—'), 2 erros de ESLint zerados (drawBaseline içado; raw as any tipado),
  CSP +object-src 'none'/base-uri/form-action. `/api/sign` preparado p/ SERVICE_ROLE_KEY na Vercel
  (signingClient(): usa service role quando a env existir; sem a env, fallback byte-idêntico ao anon).
- **Banco (2 migrations APLICADAS)**: 20260712130000 RPCs +signatureImageUrl/projectToken
  (agreement) e +agreementToken/agreementStatus (progresso; signed_ip NUNCA sai); 20260712140000
  **lockdown do revisor (A1)**: a ponte progresso→contrato só existe p/ contrato JÁ ASSINADO e com
  show_values=true — sem isso, quem tivesse só o link de progresso (terceiro sem valores) alcançava
  a página de assinatura EXECUTÁVEL de contrato pendente, ou via total/assinatura contra o
  show_values. + order by explícito nos subselects (B1) e break-inside:avoid na assinatura (B2).
- **Revisão**: adversarial REPROVOU a 1ª versão pelo A1 (escalada real) → corrigido e PROVADO em
  prod nos dois sentidos: token real show_values=false + contrato assinado → agreementToken NULL;
  token descartável show_values=true (mesmo projeto) → token presente/status signed; descartável
  deletado. RPC v2 provada com o contrato assinado real (assinatura + HTML 7.9k). XSS: mesmo
  sanitizador nos dois caminhos; imagem inerte (CSP img-src); 4/4 assinaturas de prod apontam pro
  bucket. Build Next limpo, ESLint 0 erros.
- **Arquivos**: portal: agreement page/AgreementSignClient/PrintButton(novo)/p-page/ProgressCard/
  SignatureCanvas/data/types/mockData/agreementData/globals.css/next.config/api-sign; app-repo:
  2 migrations.
- **Decisão técnica**: ponte progresso→contrato fecha atrás de show_values (o cliente legítimo tem
  o link permanente do PRÓPRIO contrato; terceiro de progresso não ganha acesso a assinatura/total).
  Revokes de anon no sign_agreement/storage ficam pra quando a SERVICE_ROLE_KEY entrar na Vercel.

### [2026-07-12 06:20] — fix: REVISÃO GERAL ("revisa tudo") — 4 agentes, 2 bloqueantes + 5 altos corrigidos
- **O que mudou**: revisão adversarial completa pré-build (app inteiro, banco prod, edge functions +
  segredos, portal) com 4 agentes paralelos; TODOS os achados acionáveis corrigidos e provados em prod.
- **BLOQUEANTE 1 (banco)**: numeração de orçamentos — `generate_estimate_number()` usava `LPAD(n,3)` que
  TRUNCA acima de 999 ('1004'→'100') + UNIQUE global: a conta de teste colidia no PRÓXIMO insert e o
  Gladson quebraria no seu 100º orçamento (EST-100 global já tomado). Fix: unique por usuário
  (user_id, estimate_number), lpad sem truncar, advisory lock (mata race do MAX+1), drop do trigger
  legado adormecido + função uuid órfã. **PROVADO**: insert real → EST-1004, 201.
- **BLOQUEANTE 2 (app)**: título do job era persistido LOCALIZADO ("trabalho de Painting") e imprimia no
  CONTRATO legal do cliente (Project: …) — viola a regra "cliente sempre vê inglês". Fix: persiste
  sempre EN (`{svc} job`/'New quote'); prod tinha 0 títulos pt/es (sem reparo de dados).
- **ALTOS**: (a) editar cliente APAGAVA notes silenciosamente (state nunca hidratado + update sempre
  incluía a chave) → hidrata + select notes; (b) SendSheet herdava a aba ativa → NEXT "Send quote" na
  aba Invoice/Contract mandava PDF rotulado "Invoice" sem número/"Agreement" sem termos e não estampava
  Sent → força jobTab:'quote'; (c) sem rate-limit/teto nas 3 functions de IA (custo OpenAI scriptável)
  → 60 chamadas/usuário/hora via ai_jobs + caps (desc 2000, imagem 4M chars, áudio 15MB) — v7/v4/v2
  DEPLOYADAS e smoke-testadas; (d) fábrica do bug service_role: DEFAULT PRIVILEGES quebrados desde
  abril (toda tabela nova nascia sem DML pro service_role, anon com TRUNCATE) → corrigido estoque
  (18 tabelas) + fábrica (ALTER DEFAULT PRIVILEGES); (e) bucket contract-signatures era file-host
  público irrestrito → PNG ≤512KB só em signatures/ (provado: mime/pasta errada 400, caminho portal 200).
- **MÉDIOS**: revogação de membro agora pega no foreground (AppState → refreshMembership + clear de
  caches); Alerts pós-Modal com delay 380ms (oferta de recibo/fases sumia no iOS); ClientScreen resolve
  cliente vivo da query (Call/Text discavam número velho); show_values fail-open → fail-closed
  (COALESCE false + NOT NULL); author_type travado no INSERT de comentário do membro; ramos mortos
  admin/estimator removidos de 6 policies (get_member_role/user_has_team_access DROPADAS);
  sign_agreement com caps+validação de URL do bucket; membro agora vê só BRANDING do dono via
  get_owner_branding() (policy da linha inteira de users com rates/margens DROPADA; fetchCompanyProfile
  faz fallback via RPC); base64url no decode de JWT do ai-estimate; erros das functions genéricos
  (detalhe só no log ai_jobs).
- **BAIXOS**: depósito $0 bloqueado; strings do send.ts/Navigator no i18n; wa.me sem telefone cai no
  share sheet; placeholder INV falso → '—'; link Edit escondido em job legado sem estimate;
  handle_new_user com cap 120; pg_temp nas definer antigas; UNIQUEs de invoice/receipt por usuário;
  templates default fora do anon; revokes de higiene (anon INSERT phase_comments, EXECUTE helpers).
- **Arquivos**: migration 20260712120000_general_review_hardening.sql (APLICADA em prod), 3 edge
  functions (deployadas), Flow/Job/Misc/Navigator/data/api/auth/send no app.
- **Verificação**: invariante do owner 8/7/4/1/0 intacto pós-tudo; tsc limpo; jest 100/100; matriz de
  grants zerada (0 tabelas sem DML service_role, 0 TRUNCATE cliente); smoke das 3 functions ao vivo.
- **Decisão técnica**: SEM build EAS (regra do dono segue). Aceitos conscientemente (documentados):
  own-folder residual do storage, tokens fracos de agreements LEGADOS (v2 já gera forte), métrica
  "awaiting payment" superconta parcial (decisão de produto), sign_agreement segue executável por anon
  até a SERVICE_ROLE_KEY entrar na Vercel (Onda C), leaked-password protection = toggle no dashboard
  (pendência dono), expo-print fotos remotas = validar em device antes da build.

### [2026-07-12 03:10] — feat: v2 — ONDA B COMPLETA: equipe multi-usuário (owner+field, Opção B)
- **O que mudou**: **EQUIPE no app** — dono cria funcionário direto (nome+email+senha, sem convite; exigência
  verbatim do dono), atribui trabalhos, controla se o membro vê valores. Membro `field` loga e cai numa UI
  restrita: só os jobs atribuídos, aba Progress (fases/fotos/comentários), SEM valores/aba de negócio a menos
  que a flag `can_see_financials` esteja ligada (aí vê o orçamento SÓ dos jobs dele; faturas nunca). Papel
  `office` fica pronto no banco (RLS), UI dele é onda futura. Conta solo continua bit a bit idêntica.
- **Arquivos**: auth.tsx (membership context: ownerId/role/canSeeFinancials + gate anti-flash), api.ts (todas
  as queries chaveadas por ownerId; createTeamMember/fetchTeam/assign/remove; upload de foto de fase SEM
  upsert), Team.tsx (nova tela: criar membro c/ senha gerada, compartilhar credenciais, flag financeira,
  atribuir jobs, remover), Tabs/Job/Flow/Navigator/Misc/ui (fieldMode: home Progress-only, chip de stage
  oculto, FAB/criação escondidos), data.ts (helpers de papel/senha), team.test.ts (+9 ⇒ jest 100/100).
- **Banco (3 migrations APLICADAS em prod)**: 20260712100000 higiene RLS fase 0 (52 policies re-escritas com
  `(select auth.uid())`, 2 duplicadas consolidadas, 20 índices de FK); 20260712100100 fundação (team_members
  role office/field + can_see_financials + unique ativo por usuário, created_by nas fases/fotos, 3 helpers
  SECURITY DEFINER, 12 policies de membro + 4 RESTRITIVAS anti-hijack, clients/estimates/line_items/users/
  storage p/ membro; invoices owner-only); 20260712100200 grants service_role nas 5 tabelas de equipe
  (**bug classe ai_jobs achado no E2E**: revoke de abril deixou service_role sem DML — a function morria em
  membership_check_failed) + revoke TRUNCATE de anon/authenticated.
- **Edge function**: create-team-member v1 (verify_jwt ON) — cria auth user confirmado + membership ativa,
  rollback deleteUser se insert falha, gate de 10 assentos, 403 p/ membro criando membro.
- **Revisão + prova**: revisor adversarial integrado REPROVOU 1ª rodada (A1 bloqueante: upload de foto de
  fase com upsert:true morre sem policy SELECT — classe B1 recorrente; A2 chip de stage mentindo pro field;
  A3 timeout de membership fixava owner-empty; A4 erros da function engolidos) — TODOS corrigidos pré-commit.
  **E2E completo em PROD**: function 401/400/200/409/403 ✓; membro sem atribuição vê 0 em tudo (users=2,
  própria membership=1) ✓; atribuído vê 1 projeto/1 cliente/1 fase, atualiza fase ✓; 4 hijacks bloqueados
  (42501: roubar fase, mover p/ projeto alheio, foto com user_id próprio, foto em projeto alheio) ✓; storage
  pasta do owner OK sem upsert, pasta de terceiro 403 ✓; gate financeiro OFF=0 → ON=1 estimate (só o
  atribuído) + 2 line_items, invoices 0 ✓; cenário todo desmontado; invariante do owner idêntico nas 3
  medições (8/7/4/1/0). tsc limpo.
- **Decisão técnica**: SEM build EAS — regra do dono 11/07: build única pra Apple só depois de TUDO pronto
  e revisado. Onda termina em commit+túnel. Residual documentado: membro pode escrever na PRÓPRIA pasta do
  bucket (policy antiga own-folder; lixo inócuo, nada referencia).

### [2026-07-12 00:30] — feat: v2 — ONDA A COMPLETA: os 6 pedidos do uso real (G1-G5 + G4) → build 31
- **O que mudou**: (G5) **endereço da OBRA** — campo "Job site address" no passo do cliente (GPS reverso
  pré-preenche a rua, que antes era descartada; atalho "same as client"); projects.address volta à semântica
  de obra COM fallback pro endereço do cliente (achado do revisor: galeria sem GPS não pode gerar contrato
  sem rua); PDF/fatura ganham bloco "Job site" e o {{service_address}} do contrato sai certo. (G1)
  **observações no documento** — customer_note/customer_note_src novas (a nota interna da IA em PT segue
  ISOLADA e jamais imprime); card na tela do orçamento (cap 2000); seção "Notes" no PDF e bloco no contrato.
  (G1b) **IA tradutora** — edge function translate-note (gpt-4o-mini, JSON, log ai_jobs) DEPLOYADA e PROVADA
  ao vivo (PT→EN profissional); cartão duplo original+inglês editável; fallback imprime como escrito. (G2)
  **fotos no documento** — doc_photo_urls (subset ≤6, 4 por padrão); faixa do QuoteTab selecionável com
  check; grade 2 colunas no PDF do quote. (G3) **recibo** — RCPT-YYYY-NNNN (RPC clone do padrão endurecido),
  mint-once race-safe, PDF próprio ("Amount received", saldo restante/"Paid in full"), oferta pós-pagamento
  + reemissão pelo ledger. (G4) **fases do orçamento** — botão "Create phases from quote" no vazio, prompt
  pós-fatura, "Sync with quote" protegendo fase iniciada/com conteúdo/manual (auto_seeded).
- **Banco/Infra**: 5 migrations aditivas APLICADAS em prod (customer_note, template customer_notes_block,
  doc_photo_urls, receipt_numbering, auto_seeded); translate-note v1 deployada (verify_jwt ON);
  transcribe-audio v3 (fix base64url no decode do JWT pro log — bug herdado corrigido nas duas).
- **Revisão**: implementador (agente, 90/90 testes) + revisor adversarial: **APROVADO** com 1 achado médio
  e 4 baixos — TODOS corrigidos pré-commit: fallback do endereço; tiebreaker created_at no ledger (recibo
  reemitido estável); maxLength 2000 na nota; base64url nas edge functions; dedupe de fases imune a item
  literalmente chamado "X (2)" (+1 teste). tsc limpo, **jest 91/91**.
- **Arquivos**: data.ts, api.ts, send.ts, ai.ts, ui.tsx, Flow.tsx, Job.tsx, data.test.ts, 5 migrations,
  2 edge functions. Ressalvas registradas: fotos remotas no expo-print validar em device (plano B base64
  especificado); nota editada pós-tradução deixa legenda stale (cosmético).

### [2026-07-08 02:50] — fix: v2 — guard anti-regressão de stage no reenvio (achado do revisor) → build 30
- **O que mudou**: o revisor adversarial auditou o hotfix da madrugada (dono pediu "revisa tudo") e APROVOU
  com 1 bug real: o novo botão de reenvio (B2) tornava alcançável reenviar um quote **Approved** → o onSent
  estampava `Sent` de novo sem guard → **pipeline regredia Approved→Sent** no banco e na UI (a fatura já
  tinha o guard equivalente; o estimate não). Fix em 2 camadas: onSent só estampa 'Sent' quando o stage é
  Draft/Quoted, e `updateEstimateStatus` ganhou o guard espelho da invoice (update filtrado — 'Sent' não
  sobrescreve Approved/In Progress/Completed, para qualquer caller). Demais itens do audit: B1/B3/M1 limpos
  (paths conferidos contra as policies, portal inalterado, i18n coerente, ledger com escape e null-safety);
  registrados sem ação: PDF cancelado ainda estampa Sent (pré-existente), migration 021000 fora de ordem
  cronológica vs 090000 (inócuo), send.ts sem teste unitário (dívida). tsc limpo, jest 67/67.
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`. **Build 30** (dono autorizou previamente).

### [2026-07-08 02:15] — fix: v2 — HOTFIX do feedback real (B1 fotos/B2 reenvio/B3 PDF/M1 ledger) → build 29
- **B1 — FOTOS NÃO SUBIAM (raiz achada e morta SEM precisar de app novo)**: reproduzi o 400 dos logs com
  curl + JWT real → **403 RLS embrulhado em 400, SÓ com `x-upsert: true`** (sem upsert: 200 nos 3 buckets).
  Causa: o upsert do storage precisa de policy de **SELECT** pra enxergar a linha existente, e
  project-photos/phase-photos/company-logos só tinham INSERT/UPDATE/DELETE → **upload do app NUNCA funcionou**
  (createJob engolia o erro em silêncio — explica os 0/56 photo_urls da auditoria de 16/06; a ProgressTab
  só tornou o erro visível). Fix: migration `storage_select_own_photos_upsert_fix` (3 policies SELECT
  "own", aditiva/re-rodável) **APLICADA em prod e PROVADA** (upsert 2× no mesmo path → 200/200; path fixo
  photo_0.jpg → 200; sondas deletadas). **O build 28 do Gladson passou a subir fotos na hora.**
- **B2 — reenvio de quote**: QuoteTab ganhou botão persistente "Send quote" (ghost, ícone send) abaixo dos
  totais — disponível sempre que há estimate salvo e o job não está fechado (guard de empresa aplicado).
  Fim do beco: enviou 1×/editou → reenvia pra outro canal quando quiser.
- **B3 — PDF no envio**: opção do SendSheet renomeada "Save PDF"→**"Send as PDF"** (cria o PDF e abre o
  compartilhar do sistema — único jeito de ANEXAR arquivo; wa.me/mailto são texto por design da plataforma),
  movida pra PRIMEIRA posição com cor primária; descrições de Email/SMS corrigidas (prometiam "link+PDF"
  que nunca existiu).
- **M1 — ledger no documento**: `SendData.payment.received[]` (data · método · valor) → PDF ganha seção
  "Payments received" (valores em verde) e o texto idem, antes do Paid/Balance. onSent monta do
  inv.payments (métodos já em inglês no banco).
- **Arquivos**: `src/v2/ui.tsx` (SendSheet), `src/v2/screens/Job.tsx` (QuoteTab onSend + received + i18n),
  `src/v2/lib/send.ts`, migration `20260708xxxx_storage_select_own_photos_upsert_fix.sql`. tsc limpo,
  jest 67/67. **Build 29** na sequência (dono acordado aguardando).

### [2026-07-07 21:20] — fix: v2 — **CAUSA RAIZ DA SAGA (builds 18-27) ACHADA E MORTA**: expo-asset@56 fantasma
- **O que mudou**: o build 27 (ErrorUtils destravado) PINTOU O ERRO REAL na tela do dono:
  `Error: Cannot find native module 'ExpoAsset'`. Forense: o xcode log da EAS confirma que o pod ExpoAsset
  NUNCA compilou; `npm ls` revelou **DUAS versões de expo-asset** — a correta 12.0.13 aninhada dentro do expo,
  e uma **56.0.15 "do futuro" HOISTED no topo** do node_modules (que ainda trazia expo-constants@56.0.16 de
  carona). Vetor: `expo-audio@1.1.1` declara `expo-asset: "*"` como PEER dependency → npm moderno instala
  peers automaticamente e pegou a MAIS NOVA do registry (canary do SDK futuro). O Metro servia o JS do 56
  (que chama requireNativeModule('ExpoAsset') de API nova), o autolinking pulou o pod no conflito → binário
  sem o nativo → throw em module-scope na init do grafo `expo` → mascarado pelo guardedLoadModule do metro
  como "require undefined" → 3 semanas de tela branca/crash mudo. **No Expo Go nunca quebrou porque o Go
  embarca o ExpoAsset nativo de fábrica.**
- **Fix**: `npx expo install expo-asset` (dependência DIRETA ~12.0.13) — o peer `*` do expo-audio se satisfaz
  com ela, o npm dedupa a árvore inteira (verificado: um único expo-asset 12.0.13, um único expo-constants
  18.0.13, zero 56.x). Visor de boot MANTIDO (foi ele que quebrou o caso) e New Arch mantida ON (paridade com
  Expo Go; SDK 55 exige). tsc limpo, jest 67/67. **Build 28** com tudo.
- **Arquivos**: `package.json`, `package-lock.json`, `docs/changelog.md`.
- **Lição**: peerDependency `*` + auto-install de peers do npm = roleta de versão; conferir `npm ls` de TODO
  módulo nativo expo quando um build standalone divergir do Expo Go.

### [2026-07-07 20:30] — fix: v2 — build 27: erro REAL destravado (truque do ErrorUtils) + New Architecture LIGADA
- **O que mudou**: pesquisa profunda (agente web, fontes: require.js do metro v0.83.3, RN#18179, changelog
  @expo/metro-config sdk-54, docs New Architecture) PROVOU o mecanismo: `guardedLoadModule` do metro-runtime —
  require rodando FORA da cadeia de init do entry desvia exceção de factory p/ `ErrorUtils.reportFatalError` e
  RETORNA UNDEFINED. O "Cannot read property 'default' of undefined" era MÁSCARA; **o erro real foi capturado
  pelo próprio visor (handler global → `pending`) e NÃO era exibido — bug de precedência `boot.err ?? pending`
  no index.ts (o build 25 tinha a resposta na mão)**. Build 27: (1) precedência invertida (pending = erro real
  PRIMEIRO, boot.err anexado); (2) truque documentado: `global.ErrorUtils = undefined` durante os requires do
  boot → metro cai no branch de RETHROW → erro real com stack cai no catch sincronamente; (3)
  **`newArchEnabled: true`** — Expo Go é new-arch-ONLY, o app do dono roda PERFEITO lá = new arch comprovada
  no device; nosso build era o único ambiente legacy (SDK 54 é o último que permite legacy; discriminador
  apontado pela pesquisa). Refutados pela pesquisa: inlineRequires (default OFF no sdk-54), verboseName em
  prod, hermesc×não-minificado, live-bindings (fixes já no 54.0.16), env vars EAS.
- **Arquivos**: `index.ts`, `app.json` (newArchEnabled), `docs/changelog.md`.

### [2026-07-07 20:05] — fix: v2 — build 26: sonda+desvio no entry (commit c0811ac)
- **O que mudou**: O VISOR DO 25 ENTREGOU — dono mandou 3 prints da tela vinho com o erro POR ESCRITO:
  `TypeError: Cannot read property 'default' of undefined` no useState do Root ⇒ **`require('./App')` retorna
  UNDEFINED no bundle de release** (em prod o metro require perde as guardas __DEV__ e devolve undefined em vez
  de lançar). Diagnóstico da tela também matou a hipótese do manifest: `expoConfig.extra` chega POPULADO
  (anonKey/url/projectId visíveis no print). Forense: export:embed local gera os mesmos 907 módulos da EAS
  (logs baixados; npm ci com lockfile ✓; números de linha do Hermes são sintéticos, comparação 16 vs 3444 era
  inválida) e a factory do módulo 571 (App.tsx) existe e está correta — o defeito é de RUNTIME Hermes/metro em
  release. `index.ts` agora sonda `./src/v2/App` (fundo; App.tsx é wrapper de 1 linha) e `./App`, usa o que
  render componente e pinta typeof/keys de ambos se nenhum servir. Pesquisa paralela (agente web) varrendo
  issues metro 0.83/hermes/expo 54 por "require undefined em produção".
- **Arquivos**: `index.ts`; build 26 = d161fd7a (submission 0e624a4c automática).

### [2026-07-07 18:40] — fix: v2 — visor de boot v2 (build 24 AINDA crashou; agora nada morre calado)
- **O que mudou**: crash logs `.ips` do dono (builds 23 E 24, hoje) mostram SIGABRT idêntico na
  ExceptionsManagerQueue <1s após o launch — exceção JS fatal na avaliação inicial, com a mensagem REMOVIDA
  pela Apple. O visor v1 não pintou nada ⇒ o throw dispara FORA do alcance dele: ou dentro do `import 'expo'`
  do topo (rodava ANTES do handler instalar) ou reportado com isFatal falsy caindo no handler default (que
  aborta). Forense dos IPAs: executáveis 23/24 byte-idênticos (a diferença é SÓ o bundle JS) ⇒ o JS executa;
  fallback do supabase matou UM lançador module-scope, mas há outro. **Visor v2**: o entry importa APENAS
  react + react-native (carregados pelo prelude, não lançam); `expo` e TODO o grafo do app inicializam em
  require lazy dentro de try no primeiro render (throw em module-scope de QUALQUER módulo → tela vinho);
  em release, TODO erro reportado antes do mount é pintado (fatal ou não); a tela de erro ainda imprime
  `Constants.expoConfig.extra` (fecha a dúvida do manifest vazio) + versão do Hermes. Registro direto via
  AppRegistry('main') — mesmo efeito do registerRootComponent.
- **Arquivos**: `index.ts`
- **Decisão técnica**: com o v2, o espaço de resultados do build 25 é binário: tela vinho com o erro POR
  ESCRITO (leitura direta da causa) ou app funcionando. Fechar ainda instantâneo = JS nem rodou = crash
  100% nativo (hipótese hoje descartada pelos frames do bridge nos .ips). Simbolicação foi tentada e é
  inviável (binário stripped, 190 símbolos). tsc limpo, jest 67/67.

### [2026-07-07 17:15] — feat: v2 — ONDA 3: fluxo real (lost/archive, aprovar direto, auto-idioma, guards) + ressalvas F12
- **O que mudou**: (1) **Perdido/Arquivar** — menu "…" no Job marca Lost (confirmação) ou Archived e reabre;
  eixo ORTOGONAL ao pipeline (projects.status, coluna que o v2 não usava; deriveStage intocado): fechado sai da
  Home/pipeline (lost sai até do "collected"; arquivado pago continua contando), some dos filtros normais e ganha
  filtros próprios + chip LOST/ARCHIVED; NEXT some e vira banner com Reopen. (2) **Aprovar direto** — "cliente já
  aprovou? Marcar aprovado" sob o card NEXT (telefone/pessoalmente, sem fingir envio). (3) **Guard "Your company"**
  — enviar quote/fatura ou gerar contrato com perfil sem nome agora bloqueia com CTA pro perfil (fim do PDF
  "Your company"). (4) **Auto-idioma** — primeira execução segue o idioma do celular (expo-localization, bundled
  no Expo Go SDK 54); escolha manual na tela Language segue vencendo. (5) **Jargões** — "estimate"→"quote" (EN),
  "presupuesto"→"cotización" (ES), pipeline es/pt leigo, Skip→"Save without client", "{pct}% confident" no badge
  da IA. (6) **Topo do Job não fica mais velho** pós-edição (headerTotal deriva do detail; params só como
  fallback). (7) **Ressalvas do F12**: downgrade de parcelamento agora AVISA; parcela vencida mostra "N days
  overdue" (sem re-datar full/installments no re-save); fatura $0 bloqueada; stepper N× preserva parcelas
  editadas (resizeDraftRows); parcela $0 não é salvável (trava + aviso).
- **Arquivos**: data.ts (closedFromStatus/homeMetrics/daysFromToday/resizeDraftRows), api.ts, Job.tsx, Tabs.tsx,
  i18n.tsx + locale.ts NOVO (pickLocale), Flow/Misc/Auth (strings), package.json (+expo-localization ~17.0.9),
  testes: data/payments ampliados + locale.test.ts novo.
- **Decisão técnica**: fechado = projects.status ('Lost'/'Archived'/'Active'), SEM migration (coluna varchar sem
  CHECK, verificado em prod; zero valores legados conflitantes) e sem tocar em deriveStage/Stage (testes pinam
  equivalência bit a bit da Home sem fechados). Client-facing SEMPRE inglês reforçado: docLabel do PDF/subject
  e mensagens de compartilhamento (contrato/progresso) saíram do i18n e viraram constantes EN (regra do dono).
- **Revisão**: 2 implementadores paralelos (arquivos disjuntos) + revisor adversarial integrado: **APROVADO, 0
  bloqueantes** (validou banco vivo, portal, package-lock e integridade i18n 439 chaves × en/es/pt). 3
  recomendações baratas atendidas pré-commit (inglês client-facing; trava $0; comentário do i18n). Ressalvas
  registradas: deposit re-data no re-save (semântica "due on receipt", aceita); guard fail-closed em erro de
  rede; links de progresso/contrato de job perdido seguem vivos (produto, Onda 4). tsc limpo, jest 67/67.
- **Bug corrigido**: topo do Job stale pós-Edit (P1 do diagnóstico 07/07) + pipeline inflado por trabalho perdido.

### [2026-07-07 16:20] — feat: v2 — ONDA 2/F12: PAGAMENTO FLEXÍVEL (3 modos, ledger de pagamentos, fim do Net-15 fixo)
- **O que mudou**: fatura deixa de ser "Net-15 chumbado + status binário". Ao gerar (ou editar o plano), o
  empreiteiro escolhe em um sheet leigo-proof: **Tudo no final** (vencimento real, stepper de dias), **Entrada +
  saldo** (% OU $ absoluto, aceita 0) ou **Parcelas** (2–12, cent-exatas, indicador "falta alocar" trava o confirm).
  Ledger `invoice_payments` registra pagamentos parciais (Cash/Check/Card/ACH/Other) e o status vira derivado:
  Unpaid → **Partially Paid** → Paid (epsilon $0,005; "Mark as paid" da timeline virou Record payment com o saldo).
  FIX do bug itens-vivos×totais-congelados: editar orçamento re-sincroniza a fatura (só sem pagamentos; senão
  banner "Quote changed after invoicing"). PDF ganha Payment schedule + Paid/Balance due (inglês SEMPRE); contrato
  v2 com `{{payment_schedule_table}}` (chaves antigas mantidas p/ templates legados). Reenvio nunca sobrescreve
  status pago (`Sent` só sobre `Unpaid`).
- **Arquivos**: `src/v2/data.ts` (helpers puros: splitInstallments/planRows/statusFromPayments/rescaleSchedule/
  planFromInvoice/datas TZ-proof), `src/v2/lib/api.ts`, `src/v2/lib/send.ts`, `src/v2/screens/Job.tsx`
  (PaymentPlanSheet + RecordPaymentSheet + InvoiceTab reescrita), `src/v2/ui.tsx` (Stepper exportado),
  `src/v2/screens/Flow.tsx` (import), `src/v2/lib/__tests__/payments.test.ts` (24 testes novos),
  migrations `20260708090000_invoices_flexible_payment` + `20260708090100_contract_template_payment_schedule`
  (**APLICADAS em prod ANTES deste commit**; backfill: 8 faturas legadas → mode full + due_date=criação+15;
  nenhum ledger fabricado; template v2 é default único, verificado).
- **Decisão técnica**: parcela é porção do TOTAL (imposto dentro, nunca re-tributa); centavos de resto na última
  parcela; falha no insert do schedule degrada o mode p/ 'full' no banco (PostgREST sem transação — nunca afirmar
  parcelamento inexistente); Paid legado sem ledger vale como pago integral e nunca é rebaixado; labels/documentos
  em inglês (regra do dono), UI traduz por mapa (en/es/pt).
- **Revisão**: implementador (agente, retomado após queda por limite de sessão) + revisor adversarial: **APROVADO,
  0 achados bloqueantes** (fuzz 3.000 iterações no rescale; md5 do template conferido contra prod; RLS/backfill/
  guard de status validados no banco). 11 ressalvas não-bloqueantes registradas p/ Onda 3 (top: degradação de
  schedule é muda; re-salvar plano re-data vencimentos passados; fatura $0 nunca "quita"). tsc limpo, jest 48/48.
- **Bug corrigido**: totais congelados da fatura divergindo dos itens vivos pós-edição (agora re-sincroniza ou avisa).

### [2026-07-07 12:10] — fix: v2 — fallback hardcoded do Supabase no client (suspeito nº 1 da tela branca)
- **O que mudou**: `src/services/supabase.ts` fazia `createClient(extra?.supabaseUrl || '')` — e o supabase-js
  LANÇA "supabaseUrl is required." com string vazia, em MODULE-SCOPE (o client é construído no import). Se no
  build standalone o `Constants.expoConfig.extra` voltar vazio (caminho do manifest difere do Expo Go, ainda mais
  sem o expo-updates, removido no build 21), o JS morre na cadeia de imports ANTES de pintar qualquer coisa —
  exatamente a tela branca (New Arch) / SIGABRT no ExceptionsManagerQueue (Old Arch, build 22), e explica por que
  o Expo Go sempre funcionou (manifest do Metro carrega o extra do .env). Fallbacks hardcoded (URL + anon key,
  que é PÚBLICA por design; RLS protege) garantem que o client sempre constrói.
- **Arquivos**: `src/services/supabase.ts` (o v2 reusa esse client via re-export)
- **Decisão técnica**: vai junto com o visor de boot no build 24 — se essa era a causa, o app ABRE; se houver
  outra, o visor mostra o erro na tela. Qualquer resultado é informativo (aberto / erro legível / branco=nativo).

### [2026-07-07 12:00] — feat: v2 — visor de boot no index.ts (fim da tela branca MUDA no TestFlight)
- **O que mudou**: dono confirmou (áudio) que o build 23 — minify OFF + New Arch OFF — AINDA abre branco no
  TestFlight, e branco PURO (nem o Loading esmeralda, nem o ErrorBoundary rosa aparecem) ⇒ o JS morre ANTES de
  montar o V2App (throw em module-scope na cadeia de imports) OU o bundle nem executa (camada nativa). O `index.ts`
  agora é um "visor de boot": try/catch no require('./App') + ErrorUtils.setGlobalHandler que, em release, engole o
  fatal (o handler default aborta ANTES de pintar qualquer coisa — era o SIGABRT mudo do build 22) e PINTA o
  erro/stack na tela (fundo vinho). Se mesmo assim ficar branco → bundle não executou → problema nativo, outra
  investigação. Inofensivo em produção (só aparece em fatal); dev mantém RedBox.
- **Arquivos**: `index.ts` (sem JSX — entry é .ts), `docs/changelog.md`
- **Decisão técnica**: parar a roleta de builds mudando variável às cegas (18 crash expo-updates → 19-21 branco →
  22 exceção JS c/ Old Arch → 23 branco de novo SEM minify) e fazer o device REPORTAR a causa. Build 24 vai com o
  visor. Respondido ao dono: criar app NOVO no App Store Connect não muda nada (o registro da Apple não roda
  código; o mesmo binário daria a mesma tela) e o defeito NÃO veio das mudanças recentes (o build 23 é de 18/06;
  teclado/margem/etc só existem no túnel, que funciona).

### [2026-07-07 11:40] — feat: v2 — ONDA 2/F11: margem EMBUTIDA nos preços (documentos do cliente fecham a conta)
- **O que mudou**: o markup interno deixa de ser somado "por fora" (parcela invisível que fazia subtotal + tax ≠ total
  nos documentos do cliente) e passa a ser EMBUTIDO nos unit prices, como o multiplicador regional. `LineItem` ganha
  `basePrice`; o stepper recalcula os preços finais a partir da base (nunca compõe); edição manual digita o preço
  FINAL (base derivada); persistência grava unit_price FINAL + margin_rate/margin_percent = 0 + nova coluna
  `estimates.markup_percent` para re-hidratar no Edit; estimate LEGADO (margin_rate>0) é "foldado" ao abrir no Edit
  preservando o total; QuoteTab mostra "Markup (X%) included" informativo. PDF/fatura/contrato reconciliam:
  total = subtotal + tax.
- **Arquivos**: `src/v2/data.ts` (applyMarkup/deriveBase), `src/v2/lib/api.ts`, `src/v2/screens/{Flow,Job}.tsx`,
  `src/v2/lib/__tests__/data.test.ts`, `supabase/migrations/20260707120000_estimates_markup_percent.sql`
  (**APLICADA em prod ANTES deste commit** — coluna aditiva, app antigo intacto).
- **Decisão técnica**: o preço final persistido (unit_price) é a fonte de verdade; `markup_percent` só registra o %
  embutido e `base = round2(final/(1+pct))` recupera EXATAMENTE a base original — garantia provada por teste de
  varredura (bases × percentuais). Fold do legado reusa `applyMarkup` (itens sem basePrice). Save→Edit→Save é
  idempotente: o preço nunca infla por ciclo.
- **Revisão**: revisor adversarial APROVOU (0 bugs bloqueantes; idempotência, fold, race IA×perfil e NaN/null todos
  traçados). Ressalva de teste atendida pré-commit: `deriveBase` extraído para data.ts (fim da duplicação
  api.ts/Flow.tsx) + 5 testes novos (24/24 verdes, tsc limpo).
- **Bug corrigido**: P0 do diagnóstico 07/07 — "margem vaza": o total incluía margem que nenhum documento do cliente
  mostrava (PDF/fatura/CONTRATO ASSINADO com conta que não fecha).

### [2026-07-07 11:30] — feat: v2 — ONDA 1: Android-ready + "sair do teclado" + segurança do portal no banco
- **O que mudou (app)**: (1) **BackHandler** no stack caseiro — o botão/gesto voltar do Android agora VOLTA em vez de
  fechar o app (pop quando stack>1; minimiza no root; Sheet continua interceptando via onRequestClose); (2)
  **`android.package` + `versionCode`** no app.json — o build Android passa a ser possível (nunca existiu);
  (3) **vírgula decimal**: DecimalInput aceita "6,50" (e cola de "1.234,56"/"1,234.56" tratando o ÚLTIMO separador
  como decimal), Company tolera vírgula nos %; (4) **"sair do teclado"** (dor relatada pelo dono): tocar em área
  vazia dos Sheets fecha o teclado (numérico do iOS não tem tecla de retorno!), arrastar fecha nos formulários
  (keyboardDismissMode on-drag em ClientEdit/Company/ChangePassword/Attach/Login/Signup), rodapé do Sheet respeita
  os insets (nav bar translúcida do Android); (5) autofill/submit no Auth (textContentType/autoComplete,
  next→foca senha via forwardRef no Input, go→entra, guarda anti duplo-submit).
- **O que mudou (banco, migration `portal_security_hardening` APLICADA em prod)**: fim da SOBRESCRITA anônima no
  bucket contract-signatures (adulteração de assinatura); `get_project_by_share_token` zera estimateTotal quando
  show_values=false; `add_client_comment` com caps (2000/80) + flood guard (20/10min) + author forçado 'Client';
  2 agreements de TESTE com token previsível anulados (status 'void').
- **Arquivos**: `app.json`, `src/v2/{Navigator,ui}.tsx`, `src/v2/screens/{Auth,Misc,Flow}.tsx`,
  `supabase/migrations/20260707100000_portal_security_hardening.sql`
- **Revisão**: implementação por agente + revisor adversarial; ressalvas corrigidas (insets no Sheet, milhar no
  DecimalInput, busy guard, foco encadeado). Conhecidos aceitos: back em tab≠home minimiza (não volta pra home);
  DecimalInput exibe ponto para quem digita vírgula (cosmético). `tsc` limpo, `npm test` 15/15.

### [2026-07-07 10:40] — fix: v2 — IA gera itens SEMPRE em inglês (regra do dono: cliente final é americano)
- **O que mudou**: `ai-estimate` v6 — instrução fixa no prompt: os lineItems (description/unit) saem SEMPRE em inglês
  americano, independente do idioma da anotação/áudio do empreiteiro; a `notes` interna da IA sai no MESMO idioma do
  empreiteiro. Fecha o furo: brasileiro ditando em PT podia receber itens em português no PDF do cliente americano.
  Decisão registrada: documentos do cliente (PDF/fatura/contrato) ficam SEMPRE em inglês — descartada a ideia de
  localizar o buildHtml (P2.6 do adendo).
- **Testado AO VIVO**: descrição em português + foto real → 7 itens em inglês + notes em português (e a IA ainda avisou
  honestamente que a foto não batia com a descrição). Deploy v6 com verify_jwt mantido.
- **Arquivos**: `supabase/functions/ai-estimate/index.ts`

### [2026-07-07 10:15] — docs: ADENDO 07/07 no V2_100_PLAN — diagnóstico de lançamento (Android, fluxo, faturas)
- **O que mudou**: `docs/V2_100_PLAN.md` ganhou o adendo com os 3 diagnósticos pedidos pelo dono: **F10 Android-ready**
  (2 blockers certos: botão voltar SAI DO APP — stack caseiro sem BackHandler; falta `android.package` — build nem gera;
  + vírgula decimal quebrando preço em locale ES/PT; + lista do que provar no 1º device Android), **F11 números
  honestos/fluxo real** (P0: a margem "hidden from client" vaza como Total≠Subtotal+Tax no PDF/fatura/CONTRATO ASSINADO
  — fix recomendado: embutir markup nos preços; sem caminho pra negócio perdido/cancelado; idioma sem auto-detect;
  "Your company" no 1º PDF; topo do Job desatualizado pós-Edit) e **F12 pagamento flexível** (proposta completa:
  payment_mode + invoice_schedule + invoice_payments, 3 modos leigo-proof, PDF/contrato/portal; bug registrado:
  InvoiceTab com itens ao vivo × totais congelados). Portal ganhou plano próprio em
  `photoquote-client-portal/docs/PORTAL_100_PLAN.md` (restyle de 01/06 nunca publicado + contrato sem estilo em prod;
  segurança: HTML sem sanitização na assinatura, bucket de assinaturas com escrita/sobrescrita anônima, show_values
  não aplicado na RPC, IP forjável, sem rate-limit, 2 contratos de teste ativos; features: aprovar orçamento, fatura
  no portal, pagar depósito, PDF assinado, ES/EN).
- **Arquivos**: `docs/V2_100_PLAN.md` (adendo), portal: `docs/PORTAL_100_PLAN.md` (novo, repo do portal, não commitado lá)
- **Decisão técnica**: nada de código alterado neste commit — diagnóstico consolidado de 5 agentes + evidência de
  produção (RPCs/buckets/policies lidos no banco; screenshots mobile da Vercel). Execução aguarda GO do dono por frente.

### [2026-07-04 20:30] — feat: v2 — V2_100 F5 (acabamento): ações reais do cliente + foto no card + fim dos botões mortos
- **O que mudou**: (1) **Call/Text/Email** na ficha do cliente FUNCIONAM (`Linking` tel:/sms:/mailto:, telefone sanitizado; desabilitados quando falta o dado); (2) **"New quote for X"** agora VINCULA o cliente — ele chega pré-selecionado no Attach (aplicado só no início do fluxo: remontagem no back-nav não reverte uma troca de cliente feita depois); (3) **JobCard mostra a primeira foto real** do projeto (campo `thumb` no fetchJobs; placeholder mantido sem foto); (4) **botões decorativos REMOVIDOS** (nenhum tinha handler): sino da Home, filtro dos Jobs (os chips continuam), share do Estimate, more do Job, linha Team e toggle Notifications do Profile — some a sensação de "botão que não faz nada".
- **Arquivos**: `src/v2/data.ts`, `src/v2/lib/api.ts`, `src/v2/screens/{Tabs,Misc,Flow,Job}.tsx`
- **Revisão adversarial**: 1 bug real achado e corrigido ANTES do commit (pré-seleção do cliente reaplicada na remontagem da câmera podia reverter troca de cliente no back-nav → guard por fotos/aSel vazios) + nits (telefone sanitizado, bg no thumb, import NavBtn órfão removido). `tsc` limpo, `npm test` 15/15.
- **Fica pra próxima rodada da F5**: editar nome/nota de fase da obra (M8), datas com locale (M5), decidir OnboardScreen órfã (M6), re-sincronizar fatura ao editar orçamento já faturado.

### [2026-07-04 19:45] — fix: v2 — V2_100 F4: log da IA FINALMENTE grava (GRANT ai_jobs) + transcribe-audio com log
- **O que mudou**: descoberto e corrigido o motivo de a `ai_jobs` estar VAZIA desde 17/06: o `service_role` não tinha GRANT de INSERT na tabela — todo log das Edge Functions falhava com "permission denied" engolido pelo catch best-effort (mesma classe do bug do GRANT do `app_config` da Fase 1; provado ao vivo forçando um erro e vendo que nenhuma linha aparecia). Migration **`fix_ai_jobs_service_role_grants`**: `GRANT select, insert ON ai_jobs TO service_role` + higiene (anon fora da `ai_jobs`; TRUNCATE fora dos roles web; `app_config` sem NENHUM grant client-side — a chave OpenAI mora lá). **`transcribe-audio` v2 deployada**: agora loga em `ai_jobs` (model `gpt-4o-mini-transcribe`, duração, erro) como a `ai-estimate` — a voz também ganha rastro.
- **Banco/Funções**: migration aplicada em produção e versionada; função redeployada (`verify_jwt` mantido). **Testado AO VIVO**: 1 erro forçado em cada função → 2 linhas na `ai_jobs` (gpt-5.2 com photo_count e transcribe com duração). O diagnóstico da IA ("quebra e não sei por quê") está operacional pela primeira vez.
- **Arquivos**: `supabase/migrations/20260704190000_fix_ai_jobs_service_role_grants.sql` (novo), `supabase/functions/transcribe-audio/index.ts`

### [2026-07-04 19:30] — fix: v2 — V2_100 F1 (teclado em TODAS as telas) + F2 (navegação/estado) + F3 (velocidade)
- **O que mudou**:
  - **F1 TECLADO**: novo `Kav` (KeyboardAvoidingView `padding` nas 2 plataformas) aplicado no `Sheet` central — conserta de uma vez comentário da obra, nova fase e editor de item — e nos formulários ClientEdit/Company/ChangePassword/Attach/Login/Forgot/Signup; Login agora rola (ScrollView). Decisão: NÃO setar `android.softwareKeyboardLayoutMode` (é ignorado com `edgeToEdgeEnabled:true`); com edge-to-edge o Android não redimensiona sozinho → o KAV `padding` compensa nas duas plataformas.
  - **F2 NAVEGAÇÃO/ESTADO**: pós-save reseta a pilha para `[home, job]` e limpa o fluxo (`FLOW_RESET`; acaba o "voltar atravessando o fluxo morto" e o vazamento de fotos/itens entre cotações). "Edit" do orçamento num job salvo agora HIDRATA os itens reais do job e salva de volta no MESMO estimate (`updateEstimateItems`; o trigger do banco recalcula os totais — antes mostrava os itens do último fluxo de captura e o Continue criaria um job DUPLICADO). A IA re-roda quando o conjunto de fotos muda (`aiSig`), preservando edições quando as fotos são as mesmas.
  - **F3 VELOCIDADE**: `up` estável (useCallback) + contexto memoizado (era re-render da tela inteira por tecla), lista de Trabalhos virtualizada (FlatList), fotos encolhidas para 1280px NA ORIGEM (o strip parava de decodificar 12MP por thumbnail; importação da galeria serializada com spinner pra não estourar memória), logs `[BOOT]` removidos (mantidos ErrorBoundary e timeouts).
- **Arquivos**: `src/v2/ui.tsx`, `src/v2/Navigator.tsx`, `src/v2/screens/{Flow,Job,Misc,Auth,Tabs}.tsx`, `src/v2/lib/api.ts`, `src/v2/App.tsx`, `index.ts`
- **Revisão**: 3 revisores adversariais (1 por fase), todos "aprovado com ressalvas" — ressalvas CORRIGIDAS: behavior Android `height`→`padding`; `paddingBottom` do Login engolido pelo KAV (movido pro ScrollView interno); cabeçalho do job recém-salvo dizia "Sem cliente"/"Sem endereço"/título genérico porque o store já estava resetado (agora prioriza `realClient` do banco + `title` via params); galeria com `Promise.all` de 30 decodes → serializada.
- **Pendências anotadas**: editar orçamento já FATURADO não re-sincroniza a fatura (decidir na F5); datas ainda `en-US`; `go`/`back` não memoizados (ganho marginal). `tsc` limpo, `npm test` 15/15.

### [2026-07-04 18:00] — chore: v2 — plano V2_100 (diagnóstico completo 04/07) + script do túnel da VPS
- **O que mudou**: adicionado `docs/V2_100_PLAN.md` — diagnóstico completo pedido pelo dono (áudio 04/07: teclado, telas lentas, "sessões que empilham") com causa-raiz por arquivo:linha e plano de execução F1–F9. Inclui bug PROVADO ao vivo: `ai_jobs` nunca logou (service_role sem GRANT INSERT — insert da Edge Function falha em silêncio). Também versionado o `start-tunnel.sh` (túnel permanente cloudflared na VPS de extração, porta 8082, tmux `pquote`).
- **Arquivos**: `docs/V2_100_PLAN.md` (novo), `start-tunnel.sh` (novo)
- **Decisão técnica**: ordem de execução F1 teclado → F2 navegação/estado → F3 velocidade (o que o dono sente) → F4 IA observável → F5 acabamento → F6 build → F7 segurança → F8 testes → F9 faxina. Método por fase: fazer → revisão adversarial → testar no túnel → commit.

### [2026-07-04 17:55] — fix: v2 — câmera fullbleed + teclado na captura (iOS) + TabBar com inset real + gravação animada
- **O que mudou**: (1) `CameraView` em `position:absolute` cobrindo a tela toda (fim do preview "filetinha" no Expo Go), com controles/ficha sobrepostos na base; (2) esses controles agora sobem com o teclado (`KeyboardAvoidingView` iOS) e o bottom-sheet encolheu 380→300 com `keyboardDismissMode="on-drag"`; (3) TabBar usa `useSafeAreaInsets` (paddingBottom dinâmico) e o `SafeAreaView` das abas libera a borda inferior; (4) indicador de gravação de voz virou animação viva (bolinha pulsando + waveform em loop, `useNativeDriver`) — cosmética, não reflete amplitude do mic.
- **Arquivos**: `src/v2/screens/Flow.tsx`, `src/v2/Navigator.tsx`, `src/v2/ui.tsx`
- **Contexto**: mudanças feitas em 20/06 via hot-reload no túnel da VPS (testadas pelo dono no Expo Go) e que estavam sem commit desde então. Commit de backup antes de iniciar o V2_100_PLAN.

### [2026-06-18 01:10] — fix: v2 — desabilita minificação (exceção JS no build de release)
- **O que mudou**: criado `metro.config.js` com `minifierConfig: { compress: false, mangle: false, keep_classnames/keep_fnames: true }`. O build 22 (New Arch off) PAROU a tela branca e passou a **crashar com exceção JS** (crash logs `.ips` 22:02: thread `com.facebook.react.ExceptionsManagerQueue` → SIGABRT/abort, exceção JS não tratada; a Apple não inclui a mensagem no log). **Diagnóstico por triangulação:** build 21 (NewArch+minify)=tela branca, build 22 (OldArch+minify)=exceção JS, **túnel Expo Go em modo release SEM minify = app abre PERFEITO** (foto da Home). A **minificação** é a variável comum nas duas falhas; sem ela funciona. Desabilitar minify confirma/corrige a causa.
- **Arquivos**: `metro.config.js` (novo)
- **Build 23** disparado (New Arch off + minify off). Se resolver, refinar depois (achar o offender exato e re-habilitar minify parcial); se não, é Old Arch ou módulo nativo.

### [2026-06-17 20:25] — fix: v2 — desabilita New Architecture (tentativa p/ tela branca no build)
- **O que mudou**: `newArchEnabled: false` no `app.json`. Após remover o expo-updates, o build 21 AINDA dava tela branca no TestFlight (dono confirmou que é o 21; sem crash log novo = JS não chega a montar no release), enquanto no Expo Go (dev) o app boota 100%. Tentei reproduzir em modo release via túnel (`--no-dev`/`--minify`), mas o dono não conseguiu escanear (cansaço + timeout do `--minify`). O sintoma — **tela branca em build de produção que funciona no Expo Go** — é classicamente causado pela **New Architecture**: o build EAS compila os módulos nativos do projeto com New Arch e pode quebrar onde o runtime fixo do Expo Go não quebra. Desabilitar volta pra Old Architecture (Paper), suportada por todas as libs do projeto (svg, lucide, camera, audio, location, gradient, screens, safe-area).
- **Arquivos**: `app.json`
- **Build 22** disparado. Se não resolver, o próximo passo é o diagnóstico definitivo via túnel em modo release (isola JS-de-produção vs camada nativa).

### [2026-06-17 15:55] — fix: v2 — REMOVE expo-updates de vez (corrige tela branca no build de release)
- **O que mudou**: removido o pacote **`expo-updates`** + toda a config (`updates`/`runtimeVersion` no `app.json`, `channel` nos 3 perfis do `eas.json`). **DIAGNÓSTICO definitivo via túnel Expo Go**: montei um túnel (`expo start --tunnel`, SDK 54) e instrumentei o boot com logs `[BOOT]`. Os logs (ao vivo no Metro) provaram que o app **BOOTA 100%**: `index.ts → V2App (colors.primary ok) → fonts loaded=true → Navigator loading=false hasSession=true` → renderiza a HomeScreen logado. Ou seja, **o código está OK e o problema é EXCLUSIVO do build de release** (o dono confirmou: abre no Expo Go, tela branca só no TestFlight). O `expo-updates` (que já causou o crash do build 18; eu só tinha desligado com `enabled:false` nos builds 19/20) continuava impedindo o bundle JS de ser carregado no app instalado → tela branca sem erro. Removê-lo faz o app carregar o `main.jsbundle` embarcado pelo caminho padrão do RN.
- **Arquivos**: `package.json`, `package-lock.json`, `app.json`, `eas.json`; logs `[BOOT]` temporários em `index.ts`, `src/v2/App.tsx`, `src/v2/Navigator.tsx`.
- **Bug corrigido**: tela branca no boot do build de release (builds 18–20). Mantidas as melhorias defensivas da instrumentação (ErrorBoundary global, timeout de fontes/sessão).

### [2026-06-17 07:10] — fix: v2 — instrumenta o boot p/ diagnosticar TELA BRANCA (TestFlight)
- **O que mudou**: o build 19 (expo-updates off) **parou de crashar** — abre, mas fica em **tela branca estática** (não muda ao esperar/reabrir). Tela branca NÃO gera crash log, então instrumentei o boot pra trocar "branco" por telas COLORIDAS com texto/erro e descobrir onde trava: (1) **ErrorBoundary** global → erro de render vira tela rosa com mensagem+stack; (2) **useFonts com timeout de 4s** → nunca trava no splash por fontes (renderiza mesmo sem elas); (3) loading inicial + loading do Navigator com fundo **esmeralda + texto** ("Starting…"/"Connecting…"), distinguível de branco; (4) `auth.getSession` com `.catch` + timeout de 6s → não trava o loading se a sessão emperrar.
- **Arquivos**: `src/v2/App.tsx`, `src/v2/lib/auth.tsx`, `src/v2/Navigator.tsx`
- **Objetivo**: o **build 20** mostra EXATAMENTE o estado (cor/texto) ou o erro → diagnóstico determinístico da tela branca. Hipótese principal: boot preso em fontes/sessão (JS); se ainda assim der branco, é o carregamento nativo do bundle (expo-updates) → próximo passo é remover o pacote.

### [2026-06-17 06:50] — fix: v2 — desabilita expo-updates (corrige CRASH no boot do TestFlight)
- **O que mudou**: `updates.enabled: false` no `app.json`. O **build 18 (1º build nativo do v2) crashava no launch** no TestFlight. Diagnóstico via 3 crash logs (.ips) enviados pelo dono: **SIGABRT/abort() na thread da queue `expo.controller.errorRecoveryQueue`** → o **expo-updates** lançava uma NSException não capturada no boot (stack: `NSException raise → PhotoQuoteAI`). O expo-updates fica DESLIGADO no Expo Go (via `EXPO_GO_DEV`) e LIGA só no build de produção → por isso o crash só apareceu no app instalado, nunca no teste rápido.
- **Arquivos**: `app.json`
- **Decisão técnica**: desligar o OTA (expo-updates) estabiliza o boot; o dono não precisa de OTA agora. URL mantida no config pra religar/diagnosticar depois. Antes de concluir, baixei o próprio `.ipa` do build 18 e verifiquei que Supabase (URL+anon key), fontes e o embedded manifest estavam no bundle → descartei essas hipóteses; só os crash logs nativos cravaram a causa (expo-updates).
- **Bug corrigido**: crash imediato no launch do build 18.
- **Rebuild**: build **19** (autoIncrement 18→19) disparado com `--auto-submit` → vai pra Apple automaticamente ao terminar de compilar. Build `fac419c0-e120-4e4f-a09a-56fccb60f26f`, submission `c7e80506-663a-4201-ac6b-c14ced53f4ec`.

### [2026-06-17 06:30] — chore: v2 Fase J — build 18 ENVIADO pra Apple (TestFlight)
- **O que mudou**: build de produção iOS (**v2.0.0, build 18**) compilado no EAS e **enviado pro App Store Connect / TestFlight** com sucesso. `buildNumber` 17→18 (autoIncrement do EAS, refletido no `app.json`). Apple processando (~5-10 min) antes de liberar no TestFlight.
- **Arquivos**: `app.json` (buildNumber 18)
- **Decisão técnica**: token Expo do dono validado (logado `rodrigosagach`); credenciais iOS (Distribution Cert + Provisioning Profile, válidos até abr/2027, time GUIVI TECNOLOGIA) **e** a App Store Connect API Key (`4988H39952`, do EAS servers) **já existiam** (do v1) → `eas build` + `eas submit` rodaram **não-interativos**, sem login Apple. `ITSAppUsesNonExemptEncryption=false` dispensa a pergunta de export compliance → vai direto pro TestFlight.
- **IDs**: build `cbb3fe67-e072-4943-931e-2e5d1b0fa6c4`, submission `5ff752b0-9869-402b-ade9-62d57781c2ab`, ASC App `6761633213`, EAS project `08ab6d86…`.
- **Nota**: o build EAS compilou em ~4 min (bem mais rápido que builds antigos do v1); a sondagem de credencial acabou executando o submit completo, que era justamente o objetivo (dono pediu "manda pra apple"). Segurança verificada antes: chave OpenAI NÃO vai pro bundle v2.

### [2026-06-17 06:15] — chore: v2 Fase J — version 2.0.0 (atualização v2 na App Store)
- **O que mudou**: bump da version **1.0.0 → 2.0.0** (a grande atualização do redesenho v2) em `app.json` e `package.json`, preparando o build de produção. Mantém a identidade do app (bundle `com.photoquoteai.app`, EAS projectId `08ab6d86…`, ascAppId `6761633213`) → entra como **ATUALIZAÇÃO** do app existente. O `buildNumber` é resolvido pelo EAS (`autoIncrement` no perfil `production`), evitando colisão de versão na Apple.
- **Arquivos**: `app.json`, `package.json`
- **Pendência (depende do dono)**: o build/submit roda na nuvem do Expo (conta do dono) + conta Apple. Aguardando o dono passar um token de acesso Expo OU rodar `eas build`/`eas submit` no Mac dele. O H (segurança) foi adiado pelo dono — não bloqueia o envio/teste.

### [2026-06-17 06:00] — fix: v2 — revisão da Fase G (ui.tsx traduzido: status/abas/envio + ajustes ES/PT)
- **O que mudou** (fecha a tradução): `ui.tsx` internacionalizado — rótulos de **status** (`StageChip` + Timeline + filtros: Draft/Quoted/Sent/Approved/Invoiced/Paid traduzidos, **valor lógico preservado**), **TabBar** (Início/Trabalhos/Clientes/Perfil), **SendSheet** (título + opções Email/SMS/WhatsApp/PDF, **valor passado a `onSent`/`sendDoc` mantido em EN**), e o "optional" dos campos. Ajustes: "Pipeline" (ES, era "Embudo") e a confirmação de exclusão de cliente virou 2 chaves (singular/plural) com concordância correta em ES/PT.
- **Arquivos**: `src/v2/ui.tsx`, `src/v2/screens/Job.tsx`, `src/v2/screens/Tabs.tsx`, `src/v2/screens/Misc.tsx`
- **Revisão adversarial**: lógica 100% preservada (Stage/status/author_type/categorias/rotas/query-keys como dado), `t` sem colisão (`tr` no Flow/SendSheet), templates `{var}` conferidos, 0 chaves órfãs. `tsc` limpo, `npm test` 15/15.
- **Pendência 🟡 menor**: datas ainda formatadas em `en-US` (formato, não tradução). **Fase G COMPLETA.**

### [2026-06-17 05:40] — feat: v2 Fase G (telas) — strings extraídas e traduzidas (EN/ES/PT)
- **O que mudou**: as 5 telas principais (Auth, Tabs, Flow, Job, Misc) tiveram as strings de UI extraídas para o i18n e traduzidas para **inglês, espanhol e português** (~330 chaves). Cada tela registra suas strings (`registerStrings`) e lê via `t()`. Trocar o idioma no Perfil → Language muda o app inteiro. Stage/status, ícones, campos do banco e a lógica foram preservados (hooks `t` renomeados onde colidiam: `tr`/`v`/`id`).
- **Arquivos**: `src/v2/screens/{Auth,Tabs,Flow,Job,Misc}.tsx`
- **Validação**: `tsc` limpo, `npm test` 15/15. Check de chaves: **0 órfãs** (toda chave usada está registrada), **0 mortas**.
- **Pendência menor**: TabBar (rótulos das abas, `ui.tsx`) e poucas strings de `ui.tsx`/`SendSheet` ainda em EN — próximo incremento.

### [2026-06-17 05:20] — feat: v2 Fase G (base) — infraestrutura de i18n + seletor de idioma
- **O que mudou**: base do multi-idioma (EN/ES/PT). `lib/i18n.tsx`: dicionário com **EN como fonte/fallback** (ES/PT por chave), `t()`/`translate` com interpolação `{var}`, locale persistido (AsyncStorage), `registerStrings` (cada tela co-localiza suas strings), `useT`/`useLocale` (re-render ao trocar idioma). `I18nProvider` no `App`. Tela **Language** no perfil (Profile → Language) com as 3 opções; **inglês ativo por padrão**.
- **Arquivos**: `src/v2/lib/i18n.tsx` (novo), `src/v2/App.tsx`, `src/v2/screens/Misc.tsx` (LanguageScreen), `src/v2/Navigator.tsx`, `src/v2/screens/Tabs.tsx`
- **Validação**: `tsc` limpo, `npm test` 15/15.
- **Próximo (G-telas)**: extrair as strings das telas para chaves `t()` e traduzir ES/PT (EN segue ativo/fallback).

### [2026-06-17 05:05] — fix: v2 — ajustes da revisão da Fase F (10 serviços na tela + token 0 no log)
- **O que mudou**: a tela de criar orçamento (CameraScreen) mostra os **10 tipos de serviço** (de `SERVICE_TYPES`), alinhando com o catálogo do orçamento-base (era só 7); removido o chip "Custom" sem ação. Na Edge Function, o log de tokens preserva `0` em vez de virar `null`. `ai-estimate` redeployada (v5).
- **Arquivos**: `src/v2/screens/Flow.tsx`, `supabase/functions/ai-estimate/index.ts`
- **Validação**: `tsc` limpo, `npm test` 15/15.

### [2026-06-17 04:55] — feat: v2 Fase F2 — log das chamadas de IA (ai_jobs)
- **O que mudou**: toda chamada da IA (`ai-estimate`) agora é registrada em `public.ai_jobs` — status (done/rejected/error), modelo, nº de fotos, duração (ms), tokens de saída e mensagem de erro. Resolve a dor original ("a IA quebra e não sei por quê") dando rastro pra diagnosticar. Gravado pela Edge Function via service role (best-effort — nunca afeta a resposta); o dono lê só os próprios (RLS por `auth.uid()`); `user_id` extraído do JWT.
- **Arquivos**: `supabase/migrations/20260617045000_create_ai_jobs.sql`, `supabase/functions/ai-estimate/index.ts`
- **Banco**: tabela `ai_jobs` aplicada; Edge Function `ai-estimate` redeployada (v4, `verify_jwt` mantido). **Fase F COMPLETA** (fallback offline + logs).

### [2026-06-17 04:45] — feat: v2 Fase F1 — orçamento-base offline quando a IA falha
- **O que mudou**: se a IA não responde (erro/sem internet), o EstimateScreen oferece **"Starter estimate"** — um orçamento-base determinístico montado a partir dos serviços selecionados (catálogo por tipo: Painting/Roofing/Flooring/Drywall/Plumbing/Electrical/Carpentry/Concrete/Landscaping/Demolition) × multiplicador regional, totalmente editável. Acaba a "tela vazia" no erro. `buildStarterEstimate` em `data.ts` (função pura) + 5 testes.
- **Arquivos**: `src/v2/data.ts`, `src/v2/screens/Flow.tsx`, `src/v2/lib/__tests__/data.test.ts`
- **Validação**: `tsc` limpo, `npm test` 15/15.

### [2026-06-17 04:30] — fix: v2 — revisão geral A–E (limpeza de mock no Job + fatura mais recente em fetchJobs)
- **O que mudou** (revisão holística de todas as fases de hoje, 2 revisores: integração + banco):
  - Removidos os últimos imports mock `CLIENTS`/`COMPANY` do `Job.tsx` (footgun: um cliente real com nome igual a um mock poderia ligar a dados falsos se a lógica mudasse; hoje o caminho de job existente usa `realClient`).
  - `fetchJobs` lê a fatura mais RECENTE por projeto (`order created_at desc` + first-wins), batendo com `fetchJobDetail` — evita estágio/valor divergentes entre lista e detalhe caso um projeto tenha 2+ faturas.
- **Arquivos**: `src/v2/screens/Job.tsx`, `src/v2/lib/api.ts`
- **Veredito da revisão geral**: NENHUM bug crítico no conjunto. Fluxo foto→orçamento→fatura→contrato→obra→cliente coerente; **depósito idêntico nos 3 documentos**; estágio derivado por uma única função; banco íntegro (0 projetos órfãos, 0 faturas duplicadas, contadores corretos, advisors sem nada novo crítico). `tsc` limpo, `npm test` 10/10.

### [2026-06-17 04:15] — fix: v2 — revisão da Fase E (default não sobrescreve edição manual)
- **O que mudou**: revisão adversarial da Fase E (código + banco/RLS). Único bug encontrado: a alimentação do default de alíquota/margem no orçamento novo podia sobrescrever um ajuste manual feito antes do perfil carregar → agora só semeia enquanto os valores estão no inicial (8.25%/0).
- **Arquivos**: `src/v2/screens/Flow.tsx`
- **Validação**: `tsc` limpo, `npm test` 10/10. Verificado em prod: colunas/RLS de `users`, bucket `company-logos` público, storage policies por `auth.uid()`. Demais itens corretos.

### [2026-06-17 04:05] — feat: v2 Fase E (senha) — trocar senha estando logado
- **O que mudou**: o "Change password" do perfil saiu do mock — abre uma tela que troca a senha do usuário logado (`supabase.auth.updateUser`, com confirmação e mínimo de 6 caracteres). `auth.tsx` ganhou `updatePassword`; nova `ChangePasswordScreen` + rota `changePassword`.
- **Arquivos**: `src/v2/lib/auth.tsx`, `src/v2/screens/Misc.tsx`, `src/v2/Navigator.tsx`, `src/v2/screens/Tabs.tsx`
- **Validação**: `tsc` limpo, `npm test` 10/10.
- **Pendência menor**: o "esqueci a senha" (deslogado) já envia o e-mail; falta o deep-link pro app capturar o link e definir a nova senha (precisa configurar o scheme + testar no device). Idem "payment terms" (sem coluna dedicada — usa pdf_terms_template no futuro).

### [2026-06-17 03:55] — feat: v2 Fase E (perfil) — logo da empresa + alíquota/margem/depósito configuráveis
- **O que mudou**:
  - **Logo da empresa**: upload no perfil — `uploadCompanyLogo` (bucket público `company-logos`, resize 512) → `users.logo_url`; aparece no avatar do perfil e o portal já usa no acompanhamento da obra.
  - **Defaults configuráveis**: campos Default tax % / margin % / deposit % no perfil (gravam `default_tax_percent`/`default_margin_percent`/`default_deposit_percent`); a tela de Perfil mostra os valores reais (saiu o 8.25%/25% chumbado de exibição) e tudo abre o editor.
  - **Alimentação**: o orçamento novo nasce com a alíquota/margem padrão do perfil (useEffect ref-guarded no EstimateScreen quando é `fresh`) — saiu o 8.25% fixo. O depósito já alimentava fatura/contrato desde a Fase C.
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Misc.tsx`, `src/v2/screens/Tabs.tsx`, `src/v2/screens/Flow.tsx`
- **Validação**: `tsc` limpo, `npm test` 10/10.

### [2026-06-17 03:40] — feat: v2 Fase E (cliente) — ficha com histórico real + busca + contagem
- **O que mudou**: a ficha do cliente saiu do mock — mostra o **histórico real** de trabalhos (filtra `fetchJobs` por `clientId`, novo campo em `RealJob`); `fetchClients` conta os trabalhos reais por cliente (era `0` fixo); a busca de clientes cobre nome/telefone/email/cidade (era só nome). Removidos os últimos imports mock `JOBS`/`CLIENTS` (Misc) e `COMPANY` (Tabs).
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Misc.tsx`, `src/v2/screens/Tabs.tsx`
- **Validação**: `tsc` limpo, `npm test` 10/10.

### [2026-06-17 03:20] — feat: v2 Fase D (parte 2) — comentários por fase (cliente ↔ contractor)
- **O que mudou**: a aba Progresso agora mostra e responde comentários por fase.
  - `fetchPhases` traz os `phase_comments` de cada fase (cliente e contractor), em paralelo com as fotos.
  - **Thread por fase** (sheet): lista os comentários (badge CLIENT/YOU, cores distintas) + campo pro contractor responder; contador na fase + ponto azul quando há comentário do cliente não-lido visualmente.
  - `addPhaseComment` grava a resposta do contractor (`author_type='contractor'`, nome da empresa); os comentários do cliente vêm do portal (`add_client_comment`).
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`
- **Validação**: `tsc` limpo, `npm test` 10/10. RLS de `phase_comments` é por dono do projeto (contractor insere; cliente via portal).
- **Fase D COMPLETA** (núcleo + comentários). Falta editar nome/nota da fase (menor) e provar o fluxo no device.

### [2026-06-17 03:05] — fix: v2 — revisão da Fase D (ordem de fase + avançar status otimista)
- **O que mudou** (revisão adversarial da Fase D — código + portal):
  - **Ordem da fase**: nova fase usa `max(order)+1` (era `phases.length`, que colidia ao recriar após excluir uma fase do meio).
  - **Avançar status otimista**: `cycleStatus` atualiza o cache na hora (toques rápidos não são mais "engolidos") e reverte em falha — consistente com o resto da tela.
- **Arquivos**: `src/v2/screens/Job.tsx`
- **Revisão**: nenhum bug crítico; o "Client link" pode criar token extra só numa janela de corrida estreita já coberta pelo `disabled` (aceitável). Consistência com o portal confirmada (status/visibilidade/fotos/activated_at). `tsc` limpo, `npm test` 10/10.

### [2026-06-17 02:55] — feat: v2 Fase D (núcleo) — acompanhamento da obra real (fases, fotos, link do cliente)
- **O que mudou**: a aba **Progress** do Trabalho saiu do mock e virou real, ligada ao backend que o portal do cliente já consome.
  - **Fases reais** (`fetchPhases`): lê `project_phases` (status not_started/in_progress/completed, ordem, notas) + as fotos de cada fase.
  - **CRUD de fase**: adicionar (bottom sheet), avançar status (toque cicla not_started→in_progress→completed), excluir. `createPhase`/`updatePhase`/`deletePhase` (delete confia no CASCADE das FKs).
  - **Fotos por fase** (`addPhasePhotos`): galeria → resize/JPEG → upload pro bucket público `phase-photos` → grava `phase_photos`.
  - **Link do cliente** (`ensureShareToken`): gera/reusa `project_share_tokens` (32 hex via expo-crypto) e carimba `projects.activated_at` (início, usado pelo portal); compartilha `/p/<token>`.
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`
- **Verificado**: bucket `phase-photos` público existe; RLS das 3 tabelas é `user_id = auth.uid()` (app grava user_id em tudo → passa); FKs dos filhos são ON DELETE CASCADE; `project_phases.estimate_id` NOT NULL (passado do job). `tsc` limpo, `npm test` 10/10.
- **Falta (Fase D parte 2)**: comentários (ler do cliente + responder); editar nome/nota da fase; provar no device (criar fase → subir foto → abrir o link no portal).

### [2026-06-17 02:35] — fix: v2 — revisão da Fase C (CHECK de range no depósito)
- **O que mudou**: revisão adversarial da Fase C (2 revisores: código + banco) não achou bug de correção. Como defesa em profundidade, adicionado CHECK `0–100` em `users.default_deposit_percent` e `invoices.deposit_percent` (a UI já limita; o CHECK garante no banco contra valores absurdos).
- **Arquivos**: `supabase/migrations/20260617023500_deposit_percent_range_check.sql`
- **Validação**: migration aplicada em prod (dados atuais NULL passam no CHECK); cobertura de variáveis do template confirmada 23/23 (zero órfãs); portal `get_agreement_by_token` compatível com o novo fluxo.

### [2026-06-17 02:30] — feat: v2 Fase C — contrato com modelo US genérico, depósito configurável e token seguro
- **O que mudou**:
  - **Modelo de contrato US genérico** (migration): novo template `contract_templates` (state `US`, `is_default`) válido em qualquer estado — o específico da Flórida virou variante não-default. `createAgreement` usa sempre o template padrão. Cláusulas completas (escopo, preço, pagamento, prazo, change orders, garantia, cancelamento, responsabilidade, lei aplicável, entire agreement) + termos gerais via `terms_blocks` (antes saíam em branco).
  - **Depósito configurável pelo usuário**: coluna `users.default_deposit_percent` (definido no Perfil → "Default deposit %") + `invoices.deposit_percent` (snapshot na geração da fatura). **Fatura e contrato usam o MESMO %** (lido da fatura) — acaba a divergência 25%/50%; o `%` é parametrizado no template (`{{deposit_percent}}`).
  - **Token de assinatura seguro**: gerado via `expo-crypto` (`Crypto.randomUUID`) no lugar de `Math.random()`.
  - **Metadados de envio**: `agreements.sent_at`/`sent_method` gravados ao gerar.
- **Arquivos**: `supabase/migrations/20260617021500_phase_c_deposit_and_us_template.sql`, `src/v2/lib/api.ts`, `src/v2/screens/Misc.tsx`, `src/v2/screens/Job.tsx`, `package.json`/`package-lock.json` (expo-crypto)
- **Banco (aplicado em prod, verificado)**: template US é o único `is_default` (FL desmarcado); colunas de depósito criadas; `{{deposit_percent}}`/`{{terms_blocks}}` presentes.
- **Validação**: `tsc` limpo, `npm test` 10/10.
- **Nota**: template é um Service Agreement padrão (sem revisão jurídica) — adequado nacionalmente; revisão por advogado pode vir depois. Falta provar o fluxo no device (gerar contrato → assinar no portal).

### [2026-06-16 22:20] — fix: v2 — correções da revisão (override de estágio, segurança/unicidade da numeração)
- **O que mudou** (revisão adversarial de tudo que foi feito hoje, 2 revisores):
  - **Override de estágio robusto** (`Job.tsx`): a guarda de `id` passou para ANTES do update otimista, e o override é limpo no sucesso (o estágio derivado do banco assume) e revertido na falha — antes, um write que falhasse deixava um estágio falso preso na UI, divergindo do banco. `generateInvoice` também limpa o override (deriva "Invoiced").
  - **Numeração de fatura segura** (migration): `next_invoice_number` agora usa `auth.uid()` internamente (sem argumento) — fecha o furo cross-tenant (um usuário podia incrementar o contador de outro). `createInvoice` chama a RPC sem `p_user`.
  - **UNIQUE (user_id, invoice_number)** em `invoices` — garante por construção que um número nunca duplica, mesmo se o contador falhar.
- **Arquivos**: `src/v2/screens/Job.tsx`, `src/v2/lib/api.ts`, `supabase/migrations/20260616221500_harden_invoice_numbering.sql`
- **Banco (aplicado em prod, verificado)**: função sem-arg criada (pronargs=0), versão (uuid) removida, índice único `invoices_user_number_uniq` criado.
- **Validação**: `tsc` limpo, `npm test` 10/10.
- **Achados da revisão para depois (🟡)**: depósito 25% (fatura) vs 50% (contrato) → unificar na Fase C (configurável); endereço de cliente legado pode desestruturar no 1º save (degradação leve). Dados hoje: íntegros (0 órfãos, 0 colisões).

### [2026-06-16 22:00] — test: v2 Fase A6 — primeiros testes automáticos (jest) + funções de cálculo puras
- **O que mudou**: configurado **jest** (preset `jest-expo`, script `npm test`). `deriveStage` movido para `data.ts` (módulo puro) e reexportado por `api.ts`; imports de tipo (`import type`) em `theme.ts`/`data.ts` para o módulo de dados ficar sem dependência nativa. **10 testes** cobrindo `calcTotals` (subtotal, imposto só em itens taxáveis, margem sobre subtotal+imposto, lista vazia) e `deriveStage` (Draft/Quoted/Sent/Approved, case-insensitive, Completed≠Paid, fatura paga vs não-paga).
- **Arquivos**: `src/v2/lib/__tests__/data.test.ts` (novo), `src/v2/data.ts`, `src/v2/theme.ts`, `src/v2/lib/api.ts`, `package.json`, `package-lock.json`
- **Validação**: `npm test` → 10/10 passam; `tsc --noEmit` limpo.

### [2026-06-16 21:45] — feat: v2 Fase B — estágio e status persistidos + numeração de fatura atômica
- **O que mudou**:
  - **B1 · Estágio persiste**: avançar para "Aprovado" grava `estimates.status` no banco (era um override em memória que sumia ao recarregar). O estágio exibido passa a ser derivado do banco (`deriveStage` do detalhe). (`screens/Job.tsx`, `updateEstimateStatus`)
  - **B2 · Status da fatura persiste**: enviar a fatura grava `invoices.status='Sent'` e "Mark paid" grava `='Paid'`; enviar o orçamento grava `estimates.status='Sent'`. Tudo com refetch. (`updateInvoiceStatus`)
  - **B3 · Número de fatura atômico**: tabela `invoice_counters` + função `next_invoice_number(user)` (SECURITY DEFINER, INSERT…ON CONFLICT increment) geram `INV-AAAA-NNNN` sem corrida nem colisão ao deletar — saiu o `count+1` do cliente. Seed continua a sequência atual de cada usuário. (migration, `createInvoice`)
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`, `supabase/migrations/20260616213000_invoice_number_counter.sql`
- **Banco (aplicado em prod, testado)**: `next_invoice_number` retornou 0001/0002 sequenciais; seed = max(count, maior sufixo) por usuário (user A seq=7→próx 0008; user B seq=1→próx 0002).
- **Bug corrigido**: marcar Aprovado/Enviado/Pago não persistia (sumia ao reabrir); número de fatura podia duplicar/colidir.
- **Validação**: `tsc --noEmit` limpo.

### [2026-06-16 21:30] — fix: v2 Fase A — integridade de dados (cliente, estágio, métricas, cadastro, exclusão)
- **O que mudou**:
  - **A1 · Endereço do cliente persiste**: `createClient`/`updateClient` gravam as colunas estruturadas `address_street/city/state/zip` (antes só `address`); o editor separa "City, ST" e o CEP do autofill agora é salvo. `fetchClients` lê os campos certos. (`lib/api.ts`, `screens/Misc.tsx`, `data.ts`)
  - **A2 · Status capitalizado**: `createJob` grava `status='Draft'` (era `'draft'` minúsculo) e `deriveStage` virou case-insensitive — fim da inconsistência de casing.
  - **A3 · "Recebido" honesto**: orçamento `Completed` SEM fatura deixa de contar como dinheiro recebido (mapeia para `Approved`); só fatura `Paid` entra em "Collected".
  - **A4 · Nome da empresa no cadastro**: o signup passa o nome em `user_metadata` e o trigger `handle_new_user` o lê — o perfil nasce com o nome mesmo com confirmação de e-mail ligada (antes ficava vazio por bloqueio de RLS). (`lib/auth.tsx`, migration)
  - **A5 · Exclusão de cliente segura**: FK `projects.client_id` passou de `ON DELETE CASCADE` para `SET NULL` — apagar cliente NÃO apaga mais os trabalhos, só desvincula; o app avisa quantos serão desvinculados. (migration, `countClientProjects`, `screens/Misc.tsx`)
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/lib/auth.tsx`, `src/v2/screens/Misc.tsx`, `src/v2/data.ts`, `supabase/migrations/20260616211500_signup_company_name_from_metadata.sql`, `supabase/migrations/20260616211600_projects_client_id_set_null.sql`
- **Banco (aplicado em produção, verificado)**: `handle_new_user` lê `raw_user_meta_data->>'company_name'`; FK `projects_client_id_fkey` agora `ON DELETE SET NULL` (confdeltype='n'). Migrations versionadas no repo.
- **Bug corrigido**: cidade/CEP do cliente sumiam ao recarregar; "Recebido" inflava com orçamentos concluídos não pagos; apagar cliente apagava os trabalhos junto; nome da empresa nascia vazio no cadastro com confirmação de e-mail.
- **Validação**: `tsc --noEmit` limpo.

### [2026-06-16 21:12] — feat: v2 — contrato real (ContractTab) + plano de execução para finalizar
- **O que mudou**:
  - **Contrato/Agreement REAL** (saiu o mock): `createAgreement` (`lib/api.ts`) gera o contrato a partir da fatura — lê o template de `contract_templates` por estado (fallback `is_default`), preenche as variáveis com escape de HTML, grava em `agreements` com token e `status='sent'`, e devolve o link de assinatura do portal. `fetchJobDetail` traz o `agreement` (status/signed_name/signed_date). A `ContractTab` (`screens/Job.tsx`) mostra status real (DRAFT/SENT/SIGNED), compartilha o link e lê o estado assinado de volta.
  - **Auditoria + plano**: `docs/V2_FINISH_PLAN.md` — auditoria de 6 frentes (código v2, banco, Edge Functions, portal) + runbook de 10 fases (A–J) para finalizar a v2, com as decisões do dono (chave OpenAI fica por ora; 50 estados → template US genérico; depósito definido pelo usuário; i18n EN/ES/PT com EN ativo).
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`, `docs/V2_FINISH_PLAN.md`, `docs/changelog.md`
- **Decisão técnica**: contrato gera do template por estado com fallback para o default; round-trip validado contra o RPC `sign_agreement` do portal (exige `status='sent'` + invoice/cliente vinculados).
- **Pendência (Fase C do plano)**: token ainda usa `Math.random()` (trocar por CSPRNG), `terms_blocks` sai vazio, e o depósito está chumbado (50% no contrato vs 25% na fatura) — será unificado e tornado configurável pelo usuário.

### [2026-06-01 15:20] — feat: v2 Fase 3 — gerar fatura real do orçamento
- **O que mudou**:
  - **`createInvoice`** (`lib/api.ts`): gera a fatura a partir do orçamento — copia os totais do estimate (fonte de verdade do trigger) e cria **número sequencial** `INV-AAAA-NNNN` (count por usuário; não há trigger de número). Status 'Unpaid'.
  - **Job**: o botão "Generate invoice" (e o CTA da timeline no estágio Aprovado) agora CRIA a fatura no banco (handler async `generateInvoice` + invalida `jobDetail`/`jobs`), com loading. Antes só mudava o estágio local sem persistir.
  - **Datas reais** na fatura: emitida = `created_at`, vencimento = +15 dias (Net 15) — saiu o "May 31 · Jun 15" fixo. `fetchJobDetail` passou a trazer `invoice.created_at`.
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`
- **Decisão técnica**: a fatura COPIA os totais do estimate (não recalcula) — o estimate já é a fonte de verdade (trigger `update_estimate_totals`). Número sequencial gerado no app (count+1) por falta de trigger; ok pra 1 contratante. Vencimento Net 15 / depósito 25% fixos por ora (sem coluna no banco — configurável fica pro futuro). Envio (PDF/email/WhatsApp) já existia via SendSheet.
- **Verificação**: `tsc` 0 erros + bundle iOS limpo. Testado no banco real: fatura de um orçamento de $5.998,50 → número `INV-2026-0002`, totais idênticos ao estimate (`totais_batem=true`); teste removido depois (conta rodrigo intacta).
- **Falta provar no device**: aprovar orçamento → gerar fatura → ver número/datas/totais + enviar.

### [2026-06-01 13:35] — fix: v2 — câmera ao vivo (expo-camera) + CEP autofill no cliente
- **O que mudou**:
  - **Câmera ao vivo**: `CameraScreen` usa `expo-camera` `<CameraView>` (preview de verdade) no lugar do fundo escuro. **Permissões de câmera + microfone pedidas ao ABRIR a tela** (useEffect no mount) → os prompts aparecem na hora (corrige a falha reportada: "tela preta" sem pedir permissão). Shutter captura do preview (`takePictureAsync`); botão de virar câmera (frente/trás); fallback claro se a permissão for negada (com botão "Allow camera").
  - **CEP autofill no cadastro de cliente**: o campo ZIP do `ClientEditScreen` chama `lookupZip` (Zippopotam) e preenche cidade/estado automático — saiu o mock hardcoded "Austin, TX".
  - Ícone `flip` adicionado ao set; plugin `expo-camera` no `app.config`.
- **Arquivos**: `src/v2/screens/Flow.tsx`, `src/v2/screens/Misc.tsx`, `src/v2/Icon.tsx`, `app.config.js`, `package*.json`
- **Decisão técnica**: `expo-camera` (no SDK 54/Expo Go) dá o preview ao vivo; permissões no mount atendem ao pedido do dono ("aprovar na hora"). Precisou **reiniciar o metro com `--clear`** (o cache antigo não resolvia `expo-camera/Camera.types`).
- **Verificação**: `tsc` 0 erros + bundle iOS limpo (42 refs de câmera) + manifesto via túnel 200.
- **Falta provar no device**: abrir nova cotação → câmera ao vivo + prompts; CEP no cliente preenchendo cidade.

### [2026-06-01 01:00] — feat: v2 — preço regional por CEP (índice por estado)
- **O que mudou**:
  - **Tabela `regional_pricing`** (estado → multiplicador de custo, 51 linhas US, avg=1.00) no servidor — editável sem republicar o app. Leitura pública (RLS `using(true)` + grant select).
  - **Localização movida pro setup** (CameraScreen): campo de CEP + botão GPS no painel de baixo. `lookupZip`/`getMyLocation` agora também retornam o multiplicador (consultam `regional_pricing` pelo estado). Store ganhou `regionMult`/`regionState`.
  - **Multiplicador aplicado na GERAÇÃO**: `requestEstimate(regionMult)` escala os unit prices da IA → o usuário revisa os preços já ajustados pra região (respeita edições, pois é antes da revisão). Selo na EstimateScreen: "Austin, TX · regional pricing +X% applied".
  - `createJob` grava `zip`/`property_state` no projeto. `AttachScreen` simplificada (location virou resumo read-only; inputs migraram pro setup).
- **Arquivos**: `src/v2/lib/{api,ai}.ts`, `src/v2/screens/Flow.tsx`, `src/v2/{ui,Navigator}.tsx`, migration `create_regional_pricing` (arquivo local)
- **Decisão técnica**: aplicar na geração (não no trigger) — NÃO mexe no trigger de totais (mais seguro) e mantém line items = total (preços locais já embutidos). Índice por ESTADO no v1 (cobre os EUA); refino por cidade/CEP nas regiões caras fica pro futuro. Valores do índice são aproximados (RSMeans-like), ajustáveis na tabela.
- **Verificação**: `tsc` 0 erros + bundle iOS limpo. Cadeia testada: 90210→CA→+21%, 10001→NY→+20%, Miami→FL→-3%, Austin→TX→-2% (Zippopotam + tabela). Tabela seedada (51 estados).
- **Falta provar no device**: digitar CEP no setup → orçamento sair ajustado.

### [2026-06-01 00:40] — feat: v2 — fotos persistidas no Trabalho + CEP/GPS reais
- **O que mudou**:
  - **Fotos do orçamento PERSISTEM**: `createJob` sobe as fotos pro Storage (`project-photos/${userId}/${projectId}/`, resize 1280/jpeg 0.7, em paralelo, best-effort) e grava as URLs públicas em `projects.photo_urls` (coluna nova). O detalhe do Trabalho (aba Quote) mostra as fotos reais; a lista de Trabalhos mostra a contagem. Antes sumiam ao salvar.
  - **CEP real**: a tela de local usa `lookupZip` (Zippopotam, API pública sem chave) → cidade/estado de verdade (acabou o mock "Austin"). **GPS real**: "Use my location" usa `expo-location` (reverse-geocode → cidade/estado/CEP). Com loading.
  - **Fixes da revisão**: (1) `Save`/`Skip` SEM cliente quebrava (`sel.addr` com `sel` null) → corrigido; (2) "Full form" de cliente agora pré-seleciona o cliente criado ao voltar pra Attach (antes era preciso buscar de novo).
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/{Flow,Job,Misc}.tsx`, `app.config.js`, migrations `projects_add_photo_urls` + `projects_client_id_optional` (arquivos locais), `package*.json`
- **Decisão técnica**: `photo_urls jsonb` é coluna ADITIVA (não-quebra o portal externo). Upload paralelo (`Promise.all`) pra save rápido. Fotos best-effort: o orçamento já está salvo antes do upload, então uma foto que falha não perde o Trabalho. Índice de preço regional por CEP fica pro futuro (precisa tabela CEP→índice no servidor).
- **Verificação**: `tsc` 0 erros + bundle iOS limpo. Cadeia de Storage testada com JWT real (upload RLS por uid → 200, URL pública → 200 image/jpeg). Zippopotam testado (78701 → Austin, TX). RLS/trigger de totais já validados antes.
- **Falta provar no device**: câmera tirando foto + upload, GPS, gravação de voz.

### [2026-06-01 00:15] — feat: v2 — transcrição de voz (OpenAI) + tirar a chave do bundle
- **O que mudou**:
  - **Transcrição de voz REAL**: nova Edge Function `transcribe-audio` (lê a chave do `app_config`, chama OpenAI `gpt-4o-mini-transcribe`) + gravação real na `DescriptionInput` com **expo-audio** (record/stop + permissão de mic). O contratante dita o serviço → o áudio é transcrito e **vira a descrição** que alimenta o orçamento. Estados gravando/transcrevendo/erro. Testada com áudio real (~4s, transcrição fiel).
  - **Segurança**: `openaiApiKey` REMOVIDO do `extra` do `app.config.js` — a chave não vai mais no bundle/manifesto (fecha o **crítico #1 do audit**); o v2 só usa OpenAI via Edge Functions. Plugins `expo-audio` (mic) e `expo-image-picker` (câmera/fotos) adicionados pro build futuro.
  - **Fix (revisão)**: o `EstimateScreen` re-rodava a IA (e apagava edições) ao voltar de "Attach" — o Navigator remonta a tela do topo. Agora guarda em `store.items.length` (só roda a IA se ainda não há itens).
  - **Honestidade**: o banner mostra o nº de fotos REALMENTE analisadas (máx 5, `MAX_AI_PHOTOS`), não o total tirado.
- **Arquivos**: `supabase/functions/transcribe-audio/index.ts` (novo), `src/v2/lib/ai.ts`, `src/v2/screens/Flow.tsx`, `app.config.js`, `package.json`, `package-lock.json`
- **Decisão técnica**: transcrição via Edge Function (não no app) pelo mesmo motivo da IA da foto — a chave fica no servidor. `gpt-4o-mini-transcribe` (rápido/barato, auto-detecta idioma). `expo-audio` (não `expo-av`, deprecado) — compatível com Expo Go SDK 54.
- **Verificação**: `tsc` 0 erros + bundle iOS limpo. Edge Function testada com áudio real em PT. **No device:** falta o dono testar a GRAVAÇÃO (expo-audio no Expo Go); a transcrição em si já está provada.
- **Pendente**: a chave em si ainda é a VAZADA (saiu do app, mas trocar no Supabase no cutover); upload das fotos pro Storage; `calc-totals`/`zip-lookup`.

### [2026-06-01 00:05] — feat: v2 Fase 1 — fluxo criar-trabalho REAL (câmera + IA + persistência)
- **O que mudou**:
  - **IA real**: Edge Function `ai-estimate` (Deno) no ar no Supabase — recebe fotos, lê a chave OpenAI no servidor (tabela `app_config`, RLS travada + `GRANT select` só pro `service_role`) e chama o **gpt-5.2** (rápido, ~14s) devolvendo `{lineItems, confidence, notes}` ou `{rejected, reason}`. A chave SAIU do bundle (corrige o achado #1 do audit).
  - **Câmera real** (`CameraScreen`): `expo-image-picker` (tirar foto + galeria múltipla) com permissões e thumbnails reais — acabou o mock de fotos.
  - **`EstimateScreen`** chama a IA de verdade (saiu o timer fake de 2,2s): estados analyzing/done/rejected/error com confiança e nota reais; novo `src/v2/lib/ai.ts` (resize+compress via `expo-image-manipulator`, máx 5 fotos, → base64 → `supabase.functions.invoke`).
  - **Persistência**: novo `createJob` (`lib/api.ts`) grava project + estimate + line_items; o `AttachScreen` agora busca **clientes REAIS** (era lista mock) e "Save job"/"Skip" gravam de verdade (com cliente existente, quick-add que cria o cliente, ou **sem cliente**). `JobScreen` lê o id real persistido. Invalida `['jobs']`/`['clients']` pra atualizar as listas.
  - **Cliente opcional**: migration `projects.client_id` → nullable (orçar/rascunhar sem cliente, como combinado).
- **Arquivos**: `supabase/functions/ai-estimate/index.ts` (novo), `src/v2/lib/ai.ts` (novo), `src/v2/lib/api.ts`, `src/v2/screens/Flow.tsx`, `src/v2/screens/Job.tsx`, `src/v2/Navigator.tsx`, `src/v2/ui.tsx`, `src/v2/data.ts`, migration `projects_client_id_optional`
- **Decisão técnica**: `ai-estimate` ficou **SÍNCRONA** (não o async/`ai_jobs`/Realtime do blueprint) — gpt-5.2 responde em ~14s, retorno direto é simples e suficiente; revisitar só se virar gargalo. Totais NÃO são calculados no client: o estimate é inserido com `tax_rate`/`margin_rate` setados ANTES dos line_items, e o trigger `update_estimate_totals` calcula subtotal/imposto/margem/total (fonte única de verdade).
- **Verificação**: `tsc` 0 erros + bundle iOS limpo (código novo confirmado no bundle). Edge Function testada via curl (foto de cozinha → 9 itens, 74% de confiança, descreveu a foto). Persistência testada contra o banco real (conta rodrigo): orçamento → subtotal $4.120, imposto só no item taxável (8,25% de $1.440 = $118,80), total **$4.238,80**, todas as colunas duplicadas em sincronia; e insert SEM cliente (`client_id` null) ok. Linhas de teste removidas depois.
- **Pendente**: rotacionar a chave OpenAI (é a vazada) e movê-la pra Supabase secret no cutover; upload das fotos pro Storage; voz real; funções `calc-totals`/`zip-lookup`.

### [2026-05-31 22:20] — feat: v2 Fase 2 — envio (PDF + Email/SMS/WhatsApp)
- **O que mudou**: novo `src/v2/lib/send.ts` — gera **PDF** do orçamento/fatura (HTML **100% escapado**, corrige o XSS dos PDFs do v1) via `expo-print` + `expo-sharing`, e envia por **Email** (mailto), **SMS** (sms:) e **WhatsApp** (wa.me) via `Linking`, com dados reais (empresa, cliente, itens, totais). **Margem NÃO entra no documento** (lucro interno). Ligado ao `SendSheet` do Trabalho; o orçamento avança Draft/Quoted→Sent ao enviar. Botões "PDF" passam a abrir as opções de envio.
- **Arquivos**: `src/v2/lib/send.ts` (novo), `src/v2/screens/Job.tsx`
- **Decisão técnica**: o envio real (Linking/expo-print abrindo Email/WhatsApp/PDF) só dá pra testar no device; aqui validei compilação, bundle e o wiring dos dados. `tsc` + bundle nativo limpos.

### [2026-05-31 22:14] — fix: v2 — correções da revisão (decimais, imposto, fatura/orçamento reais)
- **O que mudou** (a partir de uma revisão em 3 frentes: financeiro, dados/auth, RN/UI):
  - **DecimalInput** portado pro v2 (`ui.tsx`) e usado no editor de itens — volta a dar pra digitar "6.50" (regressão da Fase 3 que tinha ficado na árvore legada).
  - **Label de imposto** usa a **alíquota REAL** do orçamento/fatura, não mais "8.25%" fixo (era grave num documento financeiro).
  - **Quote/Invoice usam os totais SALVOS** do orçamento/fatura como fonte de verdade (não o recálculo do client), então o topo (banco) e as abas **batem sempre**; a fatura mostra os valores DELA, não os do orçamento atual.
  - **"From" da fatura = empresa real** (tabela `users`) e **"Bill to" = cliente real** (era mock "Apex Renovations"/"Maria Alvarez").
  - **`fetchJobDetail` propaga erro** das 3 queries (não mostra mais `$0` silencioso em falha de RLS/rede).
  - **QueryClient compartilhado** (`lib/query.ts`) + `clear()` no `signOut` — não retém cache entre contas.
  - `key={p}` no strip de fotos da câmera.
- **Arquivos**: `src/v2/ui.tsx`, `src/v2/screens/Flow.tsx`, `src/v2/screens/Job.tsx`, `src/v2/lib/api.ts`, `src/v2/lib/auth.tsx`, `src/v2/lib/query.ts` (novo), `src/v2/App.tsx`
- **Verificação (render real logado como conta de teste)**: Quote "Tax (8.25% on $9,000.00) = $742.50" (só no item taxável), hero $13,042.50 consistente; fatura com empresa (Rodrigo Reformas) e cliente (Davis) reais; 0 erros de console. `tsc` limpo, bundles nativo e web limpos. A matemática base (`calcTotals`) já estava idêntica ao trigger do banco.

### [2026-05-31 21:53] — feat: v2 Fase 2 (parte 2) — detalhe do Trabalho, CRUD de cliente, Perfil real
- **O que mudou**: o detalhe do Trabalho agora lê os **itens + totais do orçamento real** (aba Quote) e a **fatura real** (número/status, aba Invoice) via `fetchJobDetail`. **CRUD completo de Cliente** (criar/editar/excluir, com confirmação). **Perfil** e **Business details** lendo/gravando na tabela `users` (`fetchCompanyProfile`/`updateCompanyProfile`).
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Job.tsx`, `src/v2/screens/Misc.tsx`, `src/v2/screens/Tabs.tsx`
- **Teste**: line_items semeados nos 3 orçamentos da conta rodrigo (o trigger `update_estimate_totals` recalculou os totais respeitando o flag `taxable`). `tsc` limpo, bundle iOS ok.

### [2026-05-31 21:45] — feat: v2 Fase 2 (parte 1) — Home e Trabalhos com dados reais
- **O que mudou**: a Home (métricas Pipeline/Faturado/Recebido + nome real da empresa + jobs recentes) e a aba **Trabalhos** (busca + filtros por estágio) agora leem do Supabase real, via `fetchJobs` (projetos + orçamentos + faturas → "Trabalho" com estágio derivado). O detalhe do Trabalho usa o job real no cabeçalho (título/cliente/valor/estágio). Adicionados `updateClient`/`deleteClient`/`fetchCompanyProfile` na API.
- **Arquivos**: `src/v2/lib/api.ts`, `src/v2/screens/Tabs.tsx`, `src/v2/screens/Job.tsx`
- **Decisão técnica**: "Job" = projeto + seu orçamento/fatura mais recente; estágio derivado (Paid se fatura paga → Invoiced se há fatura → senão do status do orçamento: Approved/Sent/Quoted/Draft). Line items do detalhe + telas de Orçamentos/Faturas/Perfil + CRUD completo de cliente ficam pro próximo incremento.
- **Teste**: conta `rodrigo@gmail.com` semeada com 3 clientes / 3 projetos / 3 orçamentos / 1 fatura pra visualizar populado. `tsc` limpo, bundle iOS ok.

### [2026-05-31 21:20] — fix: rodar o v2 no Expo Go (deps SDK 54 + gating EAS no app.config)
- **O que mudou**: `expo install --fix` alinhou 6 dependências às versões do SDK 54 (react-native-svg 15.15.3→**15.12.1**, expo→54.0.35, expo-file-system/font/image-picker/updates) — a divergência quebrava no Expo Go. `app.config.js` passou a **remover o bloco EAS/expo-updates** (`updates`, `owner`, `runtimeVersion`, `extra.eas`) quando `EXPO_GO_DEV=1`, pra o app rodar no Expo Go via túnel sem exigir login na conta Expo. **Produção (sem `EXPO_GO_DEV`) fica intacta.**
- **Arquivos**: `package.json`, `package-lock.json`, `app.config.js`, `docs/changelog.md`
- **Bug corrigido**: o app v2 não abria no iPhone via Expo Go (HTTP 500 `CommandError ... EXPO_TOKEN`). Causa real = **expo-updates/EAS exigindo auth no manifesto** (não era o SDK nem o túnel — o erro deu igual no exp.direct e no ngrok). Validado abrindo no device real do dono ("Agora foi").
- **Como testar no Expo Go**: `EXPO_GO_DEV=1 EXPO_OFFLINE=1 npx expo start` + túnel cru (ngrok/cloudflared na porta 8081) + `EXPO_PACKAGER_PROXY_URL=<url-do-túnel>`. O `--tunnel` nativo da Expo (exp.direct) NÃO funciona sem login Expo.

### [2026-05-31 20:16] — feat: v2 Fase 0 — login real + Supabase + React Query
- **O que mudou**: ligada a Fase 0 do app v2 ao backend real. Auth real (login/cadastro/esqueci-senha/logout) via Supabase com **gate de sessão** (deslogado→fluxo de auth; logado→app). React Query adicionado (provider). Tela de **Clientes lê do banco real** (RLS por usuário) e o editor cria cliente real; o detalhe usa dados reais (via params).
- **Arquivos**: `src/v2/lib/supabase.ts`, `src/v2/lib/auth.tsx`, `src/v2/lib/api.ts` (novos), `src/v2/App.tsx`, `src/v2/Navigator.tsx`, `src/v2/screens/Auth.tsx`, `src/v2/screens/Tabs.tsx`, `src/v2/screens/Misc.tsx`, `package.json`/`package-lock.json` (@tanstack/react-query).
- **Decisão técnica**: reusa o client Supabase existente (`src/services/supabase.ts`, AsyncStorage; **SecureStore fica pra Fase 5**). Auth lean sem PII em log. `signUp` faz upsert no perfil (`users`) p/ evitar conflito com trigger.
- **Validação**: `tsc --noEmit` limpo; `expo export` web ok; smoke test de conexão (Supabase rejeita login inválido com "Invalid login credentials") e render real do app mostrando esse erro — **o login está hitando o backend de verdade**.

### [2026-05-31 17:43] — feat: app v2 (redesenho) — front novo em React Native a partir do Claude Design
- **O que mudou**: implementado o app v2 INTEIRO em `src/v2/` (design system Emerald & Gold + ~15 telas + navegação) a partir do handoff do Claude Design. Entry religado: `App.tsx`→`src/v2/App` (v1 preservado em `App.legacy.tsx`). Fontes Manrope + Space Grotesk. Adicionados os docs `APP_BLUEPRINT.md` (estado atual do app original), `REDESIGN_SPEC.md` (spec do redesenho) e `V2_BUILD_PLAN.md` (plano de build em fases).
- **Arquivos**: `src/v2/**` (theme, Icon, data, ui, screens/Auth|Tabs|Flow|Job|Misc, Navigator, App), `App.tsx`, `App.legacy.tsx`, `package.json`/`package-lock.json` (@expo-google-fonts/manrope+space-grotesk), `.gitignore` (.design_tmp), `docs/APP_BLUEPRINT.md`, `docs/REDESIGN_SPEC.md`, `docs/V2_BUILD_PLAN.md`, `docs/changelog.md`.
- **Decisão técnica**: construído na MESMA base Expo pra herdar a identidade da App Store (bundle id, EAS, ascAppId) + o Supabase — senão viraria um app separado e os usuários atuais não receberiam o update. 1ª passada roda com dados de exemplo (`src/v2/data.ts`); backend (Supabase + Edge Functions ai-estimate/calc-totals/zip-lookup) será ligado nas próximas fases (ver V2_BUILD_PLAN.md). `tsc --noEmit` limpo; `expo export` web ok; telas validadas por render real.
- **Bug corrigido**: na estrutura do v2 já vão corrigidos por design — fatura sem mostrar margem ao cliente, número sequencial, vencimento; pendências de produção (revogar chave OpenAI, XSS nos PDFs, backfill de faturas) catalogadas nas fases 1/5/6 do plano.

### [2026-05-20 12:25] — chore: hardening de segurança (Fase 4)
- **O que mudou**: removidas as 4 policies de listagem de buckets públicos (`project-photos`, `phase-photos`, `company-logos`, `contract-signatures`); `search_path` fixado em 9 funções; `EXECUTE` de `handle_new_user` revogado de public/anon/authenticated.
- **Arquivos**: `supabase/migrations/20260520121500_harden_security_phase4.sql`, `docs/changelog.md`
- **Decisão técnica**: NÃO revoguei `EXECUTE` das helpers `user_has_*`/`get_member_role` (usadas dentro das policies de RLS — revogar quebraria a RLS e travaria o app); as funções do portal do cliente (`get_agreement_by_token`, `sign_agreement`, `get_project_by_share_token`, `add_client_comment`) precisam de `anon` e foram mantidas. Acesso por URL pública dos buckets continua funcionando (buckets públicos servem objeto sem policy SELECT).
- **Resultado**: advisors `function_search_path_mutable` 10→0 e `public_bucket_allows_listing` 4→0.
- **Pendência manual**: ativar "Leaked password protection" no dashboard (Authentication → Policies) — não há API/SQL para isso.

### [2026-05-20 12:15] — fix: permitir digitar decimais nos itens (Fase 3)
- **O que mudou**: novo componente `DecimalInput` (buffer de texto próprio) usado nos campos Qty e preço dos editores de itens (Preview e Detail). Agora é possível digitar "6.50".
- **Arquivos**: `src/components/ui/DecimalInput.tsx` (novo), `src/components/ui/index.ts`, `src/screens/EstimatePreviewScreen.tsx`, `src/screens/EstimateDetailScreen.tsx`, `docs/changelog.md`
- **Bug corrigido**: `value={String(n)}` + `parseFloat` imediato apagava o ponto decimal enquanto se digitava — era impossível inserir centavos.

### [2026-05-20 12:05] — chore: remover código morto app/ + tipos do DB (Fase 2)
- **O que mudou**: deletado o diretório `app/` (cópia duplicada e desatualizada do projeto, não usada pela build — 37 arquivos). Interfaces `DBEstimate`/`DBLineItem` atualizadas para refletir as colunas reais (margin_rate, margin_amount, grand_total, confidence, subtotal, unit, taxable).
- **Arquivos**: `app/**` (removido), `src/services/database.ts`, `docs/changelog.md`
- **Decisão técnica**: a build ativa usa só o `src/` da raiz (`index.ts`→`App.tsx`→`./src`); `app/` era um projeto Expo aninhado legado. ⚠️ O passo "sync app/ dir" do guia de deploy fica **obsoleto** — não copiar mais nada para `app/`.

### [2026-05-20 11:55] — feat: IA confiável na cotação (Fase 1)
- **O que mudou**: a estimativa-base agora aparece imediatamente (acabou o spinner de tela cheia que travava ~90s); a IA refina em segundo plano e, se falhar, vira um aviso inline em vez de `Alert` bloqueante. `max_output_tokens` 4096→16000 e timeout 120s→180s.
- **Arquivos**: `src/services/openaiService.ts`, `src/screens/EstimatePreviewScreen.tsx`, `docs/changelog.md`
- **Decisão técnica**: `gpt-5.2-pro` é reasoning lento (medido: ~88s com 1 foto); com até 5 fotos estourava o timeout de 120s e disparava o erro que o usuário via. Fallback imediato + tokens/timeout maiores mantêm a tela sempre utilizável.

### [2026-05-20 11:45] — fix: imposto/margem zerados no orçamento (Fase 0)
- **O que mudou**: trigger `update_estimate_totals` reescrito — lê `COALESCE(tax_rate, tax_percent)` (coluna que o app grava), aplica imposto só sobre itens `taxable`, sincroniza os pares de colunas duplicadas e fixa `search_path`. Fórmula de margem do `EstimateDetailScreen` alinhada para `(subtotal+tax)×margem`. Todos os orçamentos recalculados pelo trigger real.
- **Arquivos**: `supabase/migrations/20260520113700_fix_estimate_totals_trigger.sql`, `src/screens/EstimateDetailScreen.tsx`, `docs/changelog.md`
- **Decisão técnica**: trigger é a fonte única de verdade dos totais; mantém `*_rate`=`*_percent` e `total`=`grand_total` em sincronia para nunca mais divergirem.
- **Bug corrigido**: 28 orçamentos tinham alíquota mas imposto R$/US$ 0 → **$6.638,03 em imposto recuperado** (sum_tax 0,00 → 6.638,03; total 279.455 → 286.093). `tax_rate≠tax_percent` em 39 → 0. Faturas já geradas mantêm seus valores próprios (fora do escopo deste recálculo).

### [2026-05-20 11:37] — build: escopar typecheck ao src/ e corrigir tipagem do Card
- **O que mudou**: tsconfig passa a incluir só `src/` + entrypoints e excluir `dist/` e `app/`; `Card.style` agora é `StyleProp<ViewStyle>`.
- **Arquivos**: `tsconfig.json`, `src/components/ui/Card.tsx`, `docs/changelog.md`
- **Decisão técnica**: sem `include/exclude`, o `allowJs` do expo base fazia o tsc parsear o bundle de `dist/` e a cópia morta `app/`, estourando a pilha (`Maximum call stack size exceeded`). Escopar dá um gate de build confiável (`npx tsc --noEmit`).
- **Bug corrigido**: erro de tipo pré-existente em `ProjectMembersScreen.tsx:186` (array de estilos em prop `ViewStyle`).

### [2026-05-20 11:37] — chore: bump buildNumber to 17
- **O que mudou**: buildNumber iOS 16 → 17 (mudança local pendente, commitada para limpar a árvore).
- **Arquivos**: `app.json`
