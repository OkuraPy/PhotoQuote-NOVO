# PhotoQuote v2 — Especificação de Redesenho (build spec)

> **Para quem implementa (Claude Code):** este arquivo descreve COMO cada tela do app novo deve funcionar — fluxo, lógica, dados, estados e navegação. Decisões já fechadas com o dono em 31/05/2026.
> **Base que NÃO muda:** o banco Supabase atual é mantido (dados reais + portal Next.js externo dependem dele). Mudanças no schema são *ajustes* (migrations pontuais), não recriação. A lógica de IA/totais/preço sai do client e vai pra **Edge Functions**. O front é refeito do zero.
> **Companion:** `docs/APP_BLUEPRINT.md` documenta o app ATUAL (tela por tela, modelo de dados real, dívida). Use-o como referência do "como é hoje". Este arquivo é o "como passa a ser".

---

## 0. Princípios do redesenho
1. **Foto-first:** o caminho comum começa tirando foto, não preenchendo cadastro. Valor (a estimativa) aparece antes de qualquer formulário.
2. **Menos passos, menos entidades expostas:** 1 objeto-espinha = **Trabalho (Job)**. Orçamento, fatura, contrato e progresso são ETAPAS dentro do Trabalho.
3. **Nada é obrigatório pra orçar:** cliente é opcional na hora do orçamento; dados completos só na fatura/contrato.
4. **Lógica no servidor:** IA, cálculo de totais e preço regional viram Edge Functions (logadas, seguras, única fonte de verdade).
5. **3 abas:** Início · Trabalhos · Clientes. Perfil/Empresa/Equipe sob menu de perfil.

---

## 1. Arquitetura técnica
- **App:** Expo/React Native (manter SDK atual), TypeScript estrito.
- **Estado/dados:** **React Query (TanStack Query)** sobre o Supabase — substitui o `AppContext` god-object. Cache, paginação, refetch e optimistic updates vêm de graça. Sem recálculo financeiro no client.
- **Navegação:** React Navigation. Bottom tabs (3) + stack de fluxo.
- **Backend:** Supabase existente + **Edge Functions** novas:
  - `ai-estimate` (assíncrona): foto → orçamento, com logs e retry.
  - `calc-totals`: fonte única de verdade dos totais (orçamento E fatura).
  - `zip-lookup`: CEP → cidade/estado/região + índice de preço regional.
- **Segredos:** chave OpenAI vira **secret de Edge Function** (nunca no bundle). API de CEP: usar opção **grátis e sem chave** (ex. Zippopotam.us) — não vira segredo.

---

## 2. Navegação (mapa do app novo)

```
Tabs (bottom):
├── Início        → HomeScreen
├── Trabalhos     → JobsListScreen        (filtros por estágio)
└── Clientes      → ClientsScreen

Stack de fluxo (push):
├── NovoOrcamento → NewQuoteCameraScreen   (FOTO-FIRST — ponto de entrada do CTA principal)
├── Estimativa    → EstimateScreen         (IA + edição) { quoteDraftId | jobId }
├── VincularCliente → AttachClientScreen   (opcional) { jobId }
├── Trabalho      → JobScreen              (timeline + abas internas) { jobId }
│     ├─ aba Orçamento
│     ├─ aba Fatura
│     ├─ aba Contrato
│     └─ aba Progresso
├── ClienteDetalhe → ClientScreen          { clientId }
├── NovoCliente   → ClientEditScreen        { clientId? }
└── Perfil        → ProfileScreen           (empresa, equipe, config, logout)
```

**CTA principal global:** botão "+ Novo Orçamento" (em Início e Trabalhos) → abre direto a câmera (`NewQuoteCameraScreen`).

---

## 3. Fluxo principal (happy path) — passo a passo

1. Usuário toca **"+ Novo Orçamento"** → abre **câmera** direto.
2. Tira/seleciona fotos (1–N). Opcional: marca tipos de serviço (chips) + 1 linha de descrição. Botão **"Gerar estimativa"**.
3. App cria um **rascunho de Trabalho** (Job em estado `rascunho`, sem cliente) e dispara a Edge Function `ai-estimate` (assíncrona).
4. **EstimateScreen**: aparece na hora a estimativa-base (fallback local) e, quando a IA responde via Realtime, ela atualiza. Usuário edita itens/qty/preço/taxável, vê subtotal/imposto/total (calculados por `calc-totals`).
5. Usuário toca **"Continuar"** → **AttachClientScreen** (opcional):
   - "Já existe?" → busca cliente; se acha, **puxa tudo**; se não, **adiciona rápido** (só nome) ou cadastro completo (com CEP/GPS); ou **pula** (segue como rascunho sem cliente).
   - Localização do trabalho: **GPS** ou **digitar CEP** → `zip-lookup` autopreenche cidade/estado/região (recalcula preço regional). Se cliente tem endereço, pré-preenche.
6. **JobScreen**: o Trabalho está salvo. Mostra a **timeline** (Orçado → Enviado → Aprovado → Faturado → Pago) com **1 CTA do próximo passo**.
7. **Enviar orçamento** (bottom sheet: Email/SMS/WhatsApp/PDF) → status vai a `Enviado`.
8. Cliente aprova → usuário marca **Aprovado**.
9. **"Gerar fatura"** → cria fatura (estrutura correta, §6; totais via `calc-totals`) → enviar → status `Faturado`.
10. **"Gerar contrato"** (opcional) → agreement + token → enviar pro portal → assinatura.
11. Marcar **Pago** quando receber. Acompanhar obra em **Progresso** (fases).

> Caminho rápido garantido: passos 1–4 (foto → número) sem exigir cadastro de nada.

---

## 4. Telas — design + lógica

> Template: **Objetivo · O que mostra · Ações/CTAs · Lógica · Navegação · Estados.** Strings em **pt-BR** (i18n-ready). Sem hardcode de Flórida/Miami/USD: moeda e formato por locale/config da empresa.

### 4.1 HomeScreen (aba Início)
- **Objetivo:** visão rápida + ação principal.
- **Mostra:** saudação com nome da empresa (de `companyProfile.name`); cards de métrica **honestos** — *Pipeline* (Σ orçamentos não fechados), *Faturado* (Σ faturas enviadas), *Recebido* (Σ faturas **Pagas**), nº de trabalhos ativos; lista de trabalhos recentes (status + cliente + valor).
- **CTAs:** **"+ Novo Orçamento"** (destaque); atalhos: Novo Cliente, Ver Trabalhos.
- **Lógica:** métricas vêm de queries agregadas (React Query). NÃO confundir orçado com recebido (erro do app atual).
- **Navegação:** card de trabalho → `JobScreen`; CTA → `NewQuoteCameraScreen`.
- **Estados:** vazio (primeiro uso) com onboarding "tire a 1ª foto"; loading skeleton.

### 4.2 JobsListScreen (aba Trabalhos) — *unifica Projetos + Orçamentos + Faturas de hoje*
- **Objetivo:** a espinha. Toda obra/orçamento vive aqui.
- **Mostra:** lista de Trabalhos (cards: cliente ou "Sem cliente", endereço/CEP, valor total, **chip de estágio**, data). Busca + **filtro por estágio** (Rascunho/Orçado/Enviado/Aprovado/Faturado/Pago).
- **CTAs:** "+ Novo Orçamento".
- **Lógica:** um Trabalho = um `project` + seu orçamento/fatura/contrato. Estágio derivado do estado real (ver §5.3). Paginação real (não carregar tudo).
- **Navegação:** tap → `JobScreen`.
- **Estados:** vazio; sem-resultado-de-busca; loading.

### 4.3 NewQuoteCameraScreen (Novo Orçamento — FOTO-FIRST)
- **Objetivo:** capturar fotos e disparar a IA com atrito mínimo.
- **Mostra:** câmera/galeria; grid das fotos adicionadas (até 30); chips de **tipos de serviço** (multi-seleção, + custom); campo opcional "descreva o serviço (ajuda a IA)"; (opcional) sqft/linear feet.
- **CTAs:** "Tirar foto" / "Galeria"; **"Gerar estimativa"** (habilita com ≥1 foto).
- **Lógica:** cada foto → upload pro Storage (`project-photos`, **um único caminho** com conversão JPEG/HEIC). Remover foto **deve** apagar de Storage + `media` (corrigir bug atual). Ao gerar: cria Job `rascunho`, salva fotos/serviços, chama `ai-estimate` → navega `EstimateScreen`.
- **Navegação:** → `EstimateScreen { jobId }`.
- **Estados:** uploading; permissões negadas (câmera/galeria) com CTA pra ajustes; vazio ("nenhuma foto ainda").

### 4.4 EstimateScreen (Estimativa — IA + edição)
- **Objetivo:** mostrar e refinar o orçamento gerado.
- **Mostra:** banner de status da IA (analisando / pronto / erro não-bloqueante / **fotos inválidas** → tela de re-upload); lista de line items editáveis (categoria, descrição, qtd, unidade, preço, **toggle taxável**); resumo **Subtotal / Imposto (X% sobre taxável) / Total**. **Margem é interna** (markup), editável aqui como campo separado, mas **NÃO** aparece pro cliente (ver §6).
- **CTAs:** add/remover item; editar campos (input decimal que aceita "6.50"); editar % de imposto e % de margem; **"Continuar"**.
- **Lógica:** totais via `calc-totals` (nunca recalcular financeiro no client de forma divergente). IA chega via Realtime e **mescla** (não apaga edições já feitas pelo usuário — melhoria sobre o atual que sobrescreve). Imposto só sobre itens taxáveis; preço regional já aplicado pelo `zip-lookup` quando houver CEP.
- **Navegação:** "Continuar" → `AttachClientScreen { jobId }` (ou direto pro `JobScreen` se cliente já vinculado).
- **Estados:** loading IA (com texto honesto do nº real de fotos analisadas); erro inline; fotos rejeitadas.

### 4.5 AttachClientScreen (Vincular cliente — OPCIONAL) — *lógica que o dono pediu*
- **Objetivo:** associar cliente e localização sem travar o fluxo.
- **Mostra:** busca de cliente; resultado da busca; bloco de localização (GPS / CEP); botão "Pular por enquanto".
- **Lógica do cliente (regra explícita):**
  1. Campo de busca por nome/telefone/email.
  2. **Se o cliente JÁ EXISTE** (achou na busca) → seleciona e **puxa todos os dados** (endereço, email, telefone) automaticamente.
  3. **Se NÃO existe** → duas opções: **(a) "Adicionar rápido"** (só o nome, cadastra mínimo) ou **(b) "Cadastro completo"** (abre form com nome + CEP/GPS autopreenchendo cidade/estado, telefone, email).
  4. **Pular** → Trabalho segue como `rascunho` sem cliente (permitido).
- **Lógica de localização:** botão **"Usar minha localização" (GPS)** → resolve CEP → `zip-lookup` preenche cidade/estado/região. Ou **digitar CEP** → mesma coisa. Se cliente selecionado tem endereço, pré-preenche. O CEP atualiza o **multiplicador de preço regional** no orçamento.
- **Navegação:** → `JobScreen { jobId }`.
- **Estados:** buscando; "nenhum cliente — adicione"; GPS sem permissão (fallback pra CEP manual).

### 4.6 JobScreen (Trabalho — detalhe com timeline e abas)
- **Objetivo:** centralizar TUDO de um trabalho num lugar só.
- **Mostra:** cabeçalho (cliente/sem-cliente, endereço/CEP, valor); **timeline horizontal** dos estágios; abas internas: **Orçamento · Fatura · Contrato · Progresso**.
- **CTA dinâmico (1 por estágio):** Rascunho→"Enviar orçamento"; Orçado/Enviado→"Marcar aprovado"; Aprovado→"Gerar fatura"; Faturado→"Marcar pago"; etc. Sempre 1 ação óbvia.
- **Lógica:** estágio derivado do estado dos sub-objetos (§5.3). Envio por **bottom sheet** (Email/SMS/WhatsApp/PDF), não Alerts aninhados. Auto-avanço de estágio em ações reais.
- **Navegação:** abas internas; "Progresso" abre fases; "Gerar contrato" na aba Contrato.
- **Estados:** por aba (ver telas específicas).

### 4.7 InvoiceTab/InvoiceScreen (Fatura) — ver §6 (estrutura correta)
### 4.8 ContractTab (Contrato)
- **Mostra:** estado do contrato (Rascunho/Enviado/Assinado + nome/data); preview; CTAs "Gerar", "Enviar p/ assinatura", "Ver PDF".
- **Lógica:** agreement do template por estado + token seguro; envio gera link do portal; portal externo assina. **PDF com HTML escapado (corrigir XSS).** Depósito **configurável** (não fixo 50%).

### 4.9 ProgressTab/ProjectProgressScreen (Progresso/Fases)
- **Mostra:** fases (status not_started/in_progress/completed), fotos e comentários por fase, link público pro cliente.
- **Lógica:** **um único caminho de upload** de foto (igual ao do orçamento, com conversão). Cascade real no banco (não deletar filhos manualmente). Nome real da empresa nos comentários (não "Contractor"). URL do portal por config, não hardcoded.

### 4.10 ClientsScreen (aba Clientes) / ClientScreen / ClientEditScreen
- **ClientsScreen:** lista com busca + nº de trabalhos; CTA "+ Novo Cliente"; swipe/menu pra editar/excluir (com aviso se tiver trabalhos).
- **ClientScreen:** detalhe + histórico de trabalhos do cliente.
- **ClientEditScreen:** criar/editar — nome (obrig.), telefone, email, **CEP com autopreenchimento** (cidade/estado), endereço, notas. Validação de email/telefone.

### 4.11 ProfileScreen (Perfil/Empresa/Equipe/Config)
- **Empresa:** dados + logo (editor com escala), usados nos PDFs.
- **Equipe (simplificada):** ver §7 — UM modelo de papel, e que **de fato** restrinja algo, ou esconder até existir necessidade real. Convite por email com fluxo de aceite real (pending→active).
- **Config:** moeda/locale, condições de pagamento padrão (Net 15/30), % de depósito padrão, % de imposto padrão.
- **Conta:** logout, trocar senha, recuperar senha.

### 4.12 Auth (Login / SignUp / Onboarding)
- **Login:** email+senha; **link "esqueci a senha"** (hoje não existe); validação inline.
- **SignUp:** criar conta. **Criação de perfil deve ser atômica** (trigger no Postgres ou Edge Function) — corrigir o bug atual de conta órfã sem perfil.
- **Onboarding:** coletar dados da empresa em **etapas curtas** (não um form gigante), pulável e completável depois.

---

## 5. Lógicas transversais

### 5.1 Lógica de cliente (resumo da regra do dono)
`buscar → existe? → SIM: puxa tudo | NÃO: (adiciona rápido só nome | cadastro completo c/ CEP-GPS) | pular (rascunho)`. Cliente **nunca** bloqueia o orçamento.

### 5.2 Lógica de localização/preço
CEP (GPS ou digitado) → `zip-lookup` → cidade/estado/região + **índice regional** → entra no cálculo do orçamento. Tabela de índices fica no servidor (Edge Function/DB), atualizável sem republicar app (suporta expansão pros EUA todo).

### 5.3 Estágios do Trabalho (máquina de estados)
`Rascunho` (criado, sem envio) → `Orçado` (orçamento salvo) → `Enviado` → `Aprovado` → `Faturado` (fatura gerada) → `Pago`. Cada transição tem 1 CTA. Contrato e Progresso são paralelos (não bloqueiam a timeline financeira).

---

## 6. Fatura — estrutura CORRETA (validação pedida pelo dono)

> **Veredito:** a lógica de fatura do app atual está **incompleta e em parte errada**. Abaixo a estrutura correta para um documento de cobrança profissional. Itens marcados ✳️ são correções sobre o atual.

**Cabeçalho:**
- ✳️ **Número sequencial e legível** (ex. `INV-2026-0001`), não timestamp base36. Gerado no servidor com contador por empresa.
- **Data de emissão** + ✳️ **Data de vencimento** (de condições Net 15/30 — hoje não existe vencimento).
- **De (empresa):** nome, endereço, telefone, email, licença, logo.
- **Para (cliente):** nome, endereço, email, telefone.
- **Referência:** nome do trabalho/projeto.

**Corpo:**
- **Itens:** categoria, descrição, qtd, unidade, preço unit., valor. (Marcação `taxável` por item.)
- **Subtotal** = Σ(qtd × preço).
- **Imposto** = Σ(itens taxáveis) × alíquota; mostrar "Imposto (X% sobre $Y)".
- ✳️ **Margem NÃO aparece pro cliente.** Margem é markup interno (lucro) — deve estar **embutida nos preços**, nunca como linha visível na fatura do cliente. (O app atual mostra "Margin" no PDF se marginRate>0 — incorreto pra documento de cobrança.)
- **Total devido.**
- ✳️ **Depósito / Pago / Saldo devedor** — depósito **configurável** (não fixo em 50%).

**Rodapé:**
- **Instruções de pagamento** (métodos aceitos).
- **Termos/observações.**

**Lógica de cálculo (crítica):**
- ✳️ **Fonte única de verdade = Edge Function `calc-totals`.** Orçamento E fatura usam a MESMA função. A fatura **NÃO** é uma cópia congelada que pode divergir (bug atual: faturas antigas com imposto 0 enquanto o orçamento foi corrigido).
- Ao gerar a fatura: snapshot dos itens (uma fatura é um documento, então congela os itens no momento), **mas os totais são calculados por `calc-totals`**, não copiados de um campo possivelmente errado.
- ✳️ Editar a fatura recalcula via `calc-totals` (não há recálculo client divergente).
- ✳️ **PDF com HTML escapado** (corrigir XSS — hoje descrição/notas da IA entram cruas no HTML).

---

## 7. Equipe / permissões (simplificar)
Hoje há DOIS modelos (papel global + acesso por projeto) e **nenhum é aplicado** (só rótulos). Decisão: **um único modelo de papel** (ex.: Dono / Membro) que **de fato** controle o que cada um vê/edita, **ou** esconder equipe até haver necessidade multiusuário real. Não expor dois sistemas de permissão decorativos.

---

## 8. Edge Functions — contratos

### `ai-estimate` (assíncrona)
- **In:** `{ jobId, photoUrls[], services[], description, sqft, linearFeet, conditions, zip }`.
- **Faz:** cria registro em `ai_jobs` (status, modelo, request, duração, tokens, response, erro); chama OpenAI (Responses API, chave = secret); com retry/backoff; grava resultado.
- **Out (via Realtime/tabela):** `{ status, lineItems[], confidence, notes, photoAnalysis }` ou `{ rejected:true, reason }` ou `{ error }`.
- **Por quê:** resolve a IA que "sempre quebra" (logs visíveis), o timeout (sem bloquear UI) e o vazamento da chave.

### `calc-totals`
- **In:** `{ lineItems[], taxRate, marginRate }`.
- **Out:** `{ subtotal, taxableSubtotal, tax, margin, total }`. Fórmula oficial (§9). Usada por orçamento e fatura.

### `zip-lookup`
- **In:** `{ zip }`.
- **Out:** `{ city, state, regionIndex }`. Usa API pública grátis de CEP + tabela de índice regional no DB.

---

## 9. Fórmulas oficiais (única fonte de verdade)
```
subtotal        = Σ(quantity × unitPrice)              // todos os itens
taxableSubtotal = Σ(quantity × unitPrice) | taxable    // só itens taxáveis
tax             = taxableSubtotal × (taxRate/100)
margin          = (subtotal + tax) × (marginRate/100)  // INTERNO, não exibido ao cliente
total           = subtotal + tax + margin
```
Imposto só sobre itens taxáveis. Preço unitário já reflete o multiplicador regional (do CEP).

---

## 10. O que NÃO repetir do app atual (anti-padrões a evitar)
- Exigir cliente/cadastro antes de orçar. → cliente opcional.
- 5 abas com listas sobrepostas. → 3 abas + objeto Trabalho.
- Cálculo financeiro espalhado entre client e trigger, faturas congeladas divergentes. → `calc-totals` única fonte.
- Chave OpenAI no bundle. → secret de Edge Function.
- PDF com HTML não escapado (XSS). → escapar tudo.
- Mostrar margem (lucro) pro cliente. → margem interna.
- Status por bolinha+Alert e envio por Alerts aninhados. → timeline com 1 CTA + bottom sheet.
- Hardcode FL/Miami/USD/inglês. → locale/config; i18n pt-BR.
- Dois caminhos de upload de foto; remover foto deixa órfãos. → um caminho, remoção propaga.
- `AppContext` god-object sem memo. → React Query.
- Sem testes num app financeiro. → testes ao menos das fórmulas e do `calc-totals`.

---

## 11. Direção visual (alto nível)

> Objetivo declarado: app **bonito, sofisticado, profissional**. Princípio: *menos é mais* — muito espaço em branco, números grandes (o dinheiro é o herói), as fotos do trabalho em destaque, cromo mínimo, 1 ação principal por tela.

**Paleta (proposta):**
| Papel | Cor | Uso |
|---|---|---|
| Tinta | `#0C1116` | texto principal, superfícies escuras |
| Primária (marca) | `#11705A` (esmeralda profundo) | botões, marca — sóbrio, vibe dinheiro/confiança (evolui o verde atual) |
| Acento premium | `#C8A24B` (dourado discreto) | destaques pontuais (selo de confiança da IA, premium) — com parcimônia |
| Fundo | `#F7F8FA` | tela |
| Cartões | `#FFFFFF` | superfícies |
| Bordas | `#E6E9EE` | divisores |
| Texto secundário | `#5B6573` | legendas |
| Sucesso | `#1E9E6A` · Alerta `#E0A100` · Erro `#D24B4B` · Info `#2F6FED` | semânticos |

**Estágios (timeline da cobrança):** Rascunho cinza · Orçado azul · Enviado índigo · Aprovado teal · Faturado âmbar · Pago verde.

**Dark mode:** suportar (inverter tinta/fundo, manter primária/acento).

**Tipografia:** **Inter** (já no app) — pesos fortes pra hierarquia; **números tabulares grandes** nos valores. Opcional: um display sóbrio só pros títulos/valores-herói.

**Forma & sensação:** cantos 12–16px (arredondado, não "bubble"); sombras suaves e sutis; ícones em **linha fina** (Lucide, já usado); botões sólidos na primária; **bottom sheets** no lugar de Alerts; transições suaves; foto em destaque nos cards.

---

*Decisões fechadas em 31/05/2026 via conversa com o dono. Detalhe do estado atual em `docs/APP_BLUEPRINT.md`.*
