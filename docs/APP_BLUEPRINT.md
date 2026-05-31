# PhotoQuote — Blueprint Funcional & Plano de Redesenho

> Documento-fonte para o redesenho do app. Gerado em 31/05/2026 a partir de uma leitura completa do código real (`src/`, 18 telas, services, context, migrations) — **não** dos `.md` antigos da raiz (que estão desatualizados).
> Objetivo: ser a "planta" que alimenta o redesenho das telas (Claude Design) e a reconstrução da camada de lógica em Edge Functions.

## Índice
0. Decisão de arquitetura (ler primeiro)
1. Análise de fluxo & UX — *o que eu acho* (com fluxo mínimo proposto)
2. Mapa de navegação atual
3. Modelo de dados
4. Telas — especificação funcional (tela por tela)
5. Fluxo de IA (foto → orçamento) — contrato para a Edge Function
6. Fluxos de negócio
7. Edge Functions propostas
8. Dívida técnica & correções a carregar pro redesenho

---

## 0. Decisão de arquitetura (ler primeiro)

O "backend" são **duas camadas** e elas têm destinos diferentes:

- 🗄️ **Camada de DADOS** (tabelas Supabase, RLS, os orçamentos/faturas/clientes reais, a presença na App Store). **MANTER.** É o ativo já depurado e são dados reais de clientes. Jogar fora = perder dados + quebrar o portal Next.js externo que lê o mesmo banco. O que se faz aqui é **limpar no lugar** (unificar colunas duplicadas com cuidado, corrigir faturas antigas).
- ⚙️ **Camada de LÓGICA/integração** (como o app fala com o banco, a chamada de IA, o cálculo de totais espalhado entre app e trigger, a falta de logs). **RECONSTRUIR** como **Edge Functions** — limpo, logado, fonte única de verdade.
- 📱 **FRONT** (telas, componentes, navegação, estado). **REDESENHAR do zero** com design novo e arquitetura de dados decente (ex: React Query no lugar do `AppContext` god-object).

**Cutover:** sobe como atualização na MESMA listagem da App Store (mesmo bundle id) → usuários recebem update, sem migração de dados, e o portal continua intacto.

---

## 1. Análise de fluxo & UX — *o que eu acho*

**Veredito honesto:** a espinha do fluxo está **certa** (foto → IA → orçamento → fatura → contrato é lógico e o foco na IA é o grande acerto do app). Mas o caminho está **longo demais** e expõe **entidades demais** ao usuário. Dá pra cortar ~40% dos passos do caminho comum e ir de 5 abas para 3 sem perder funcionalidade.

### ✅ O que está bom (manter)
- **IA por foto** como feature central — é a mágica do produto.
- **Cache-first** no carregamento (percepção de velocidade boa).
- **Portal de progresso do cliente** por link compartilhável (`project_share_tokens`) — bom diferencial.
- **Roteamento esperto**: projeto com orçamento → detalhe; sem orçamento → fotos.
- Fallback determinístico de orçamento quando a IA falha (tela nunca fica travada).

### ⚠️ Pontos de fricção (priorizados)

**1. Muito formulário ANTES da mágica.**
Hoje, para gerar um orçamento: `NewProject` (nome, cliente, endereço, cidade, zip, tipo de imóvel, nível de acesso, andar, elevador, estacionamento) → só então `PhotoUpload` (fotos, serviços, descrição, sqft, linear feet) → `Generate`. O usuário preenche uma parede de campos antes de ver qualquer valor. App bom entrega o "aha" rápido. **Inverter:** começar pela FOTO; a IA já dá um número; cliente/endereço/condições são coletados DEPOIS (ou como ajuste fino opcional, com defaults). "Orçar é tirar foto", não "preencher cadastro". As condições (acesso/andar/elevador) viram toggles opcionais que refinam o preço, não um portão de entrada.

> **Decisão (conversa 31/05):** localização é crítica pro preço (cada CEP/região dos EUA tem custo diferente) — então ela FICA, mas vira **1 campo**. O usuário digita só o **CEP** (ou GPS preenche) e uma **API pública de CEP grátis/sem-chave** (ex. Zippopotam.us) autopreenche cidade/estado/região. O MESMO CEP serve pra duas coisas: (1) preencher o endereço na tela e (2) alimentar a **tabela de preço regional na Edge Function** — hoje o multiplicador de localização está CHUMBADO só pra Flórida no client; vira uma tabela `CEP → índice regional` no servidor, atualizável sem republicar o app (o produto está expandindo pros EUA todo). **Rua/número só são necessários DEPOIS**, na geração da fatura/contrato (documento legal), puxados do cadastro do cliente. Assim orçar = 1 campo (CEP) ou 1 toque (GPS).

**2. "Projeto" e "Orçamento" são a mesma coisa na cabeça do usuário — mas são 2 abas.**
O contratante pensa "vou orçar pro João". O app faz: criar Projeto → virar Orçamento, e mantém aba **Projetos** E aba **Orçamentos** com listas quase iguais (o status do projeto inclusive deriva do 1º orçamento). Confunde. **Colapsar** num único objeto de espinha — "Trabalho/Job" — e orçamento/fatura/contrato/progresso viram ETAPAS dentro dele.

**3. Navegação inchada: 5 abas com conteúdo sobreposto.**
Tabs atuais: Home, Projetos, Orçamentos, Faturas, Clientes. Projetos/Orçamentos/Faturas são três listas de cards roteadas por status. Ainda por cima, "Novo Projeto" mora no Dashboard, não na aba Projetos (incoerente). **Propor 3 abas:** Home · Trabalhos · Clientes. Orçamentos e Faturas viram filtros/seções dentro de Trabalhos (ou uma seção "Financeiro"). Perfil/Empresa/Equipe sob um menu de perfil.

**4. Cobrança = 3 passos manuais com status independentes e UX fiddly.**
`Orçamento → Fatura → Contrato`: cada um é criado manualmente, tem status próprio, os dados são copiados (snapshot) a cada salto, o status avança clicando numa **bolinha + confirmando num Alert**, e o envio é por **Alerts aninhados** (formato? → canal?). **Propor:** UMA linha do tempo do trabalho (Orçado → Enviado → Aprovado → Faturado → Pago, + Contrato assinado) com **1 botão claro de "próximo passo"** em cada estágio; envio por bottom sheet, não Alert; auto-avanço de status em ações reais (já existe parcialmente).

**5. "Adicionar pessoas" é over-engineered e não faz nada hoje.**
Há **dois** sistemas de permissão: papel global (`team_members.role`: viewer/estimator/admin) e acesso por projeto (`project_members.access_level`: view/edit/full), acessíveis de lugares diferentes (Team via Dashboard; ProjectMembers só de dentro do EstimateDetail). **Nenhum dos dois é aplicado de verdade** — são só rótulos. Isso adiciona passos e confusão sem payoff. **Propor:** ou deixar equipe pra depois (esconder até existir necessidade multi-usuário real), ou unificar em UM modelo só e de fato aplicá-lo.

**6. Polimento que afeta o "feel".**
UI 100% em inglês (sem i18n) num produto pt-BR; hardcode de Flórida/Miami/USD/`, FL` espalhado; dois caminhos diferentes de upload de foto; `Revenue` do Dashboard soma orçamentos (não o recebido), o que engana.

### 🎯 Fluxo mínimo proposto (caminho comum: "orçar um job")
1. **Home → "Novo Orçamento"** (1 botão grande).
2. **Fotos primeiro** — câmera/galeria; opcionalmente marca tipos de serviço + 1 linha de descrição.
3. **IA gera o orçamento** (com base de fallback). Edita itens inline.
4. **Vincula a um cliente** (escolhe existente ou cria rápido) + endereço — coletado AQUI, depois de ver valor. Condições de dificuldade = toggles opcionais de ajuste.
5. **Salva → nasce o Trabalho.** Uma tela = o Trabalho, com pipeline claro e 1 CTA por estágio.
6. Fatura/contrato/progresso/equipe vivem DENTRO do Trabalho, não espalhados em abas.

> **Decisão (31/05) — cliente NÃO é obrigatório pra orçar:** hoje o app EXIGE cliente cadastrado antes de criar projeto (`NewProjectScreen` trava sem cliente e empurra pro `AddClient`). No redesenho, orçar não exige cadastro nenhum: cliente é **opcional** no momento do orçamento — escolher um existente, **adicionar rápido só com o nome**, ou deixar **sem cliente / rascunho**. Os dados completos do cliente (endereço/email/telefone) só viram obrigatórios na geração de **FATURA/CONTRATO** (documento legal). A localização vem de GPS/CEP **independente** de ter cliente (3 caminhos: GPS, digitar CEP, ou puxar do cliente se houver). Implicação no dado: `projects.client_id` nullable / estado "rascunho sem cliente".

### 🧭 IA de navegação proposta
- **3 tabs:** `Home` (resumo + ações rápidas) · `Trabalhos` (a espinha; filtros por estágio Orçado/Enviado/Aprovado/Faturado/Pago) · `Clientes`.
- **Perfil** (engrenagem): empresa, equipe, logout, configurações.
- Orçamento/Fatura/Contrato/Progresso = **abas/estágios dentro do Trabalho**.

---

## 2. Mapa de navegação atual

Estrutura em `src/navigation/AppNavigator.tsx`. Um Stack raiz (`headerShown:false`) que alterna por `useAuth().user`.

```
NavigationContainer
└── Stack (root)
    ├── NÃO autenticado (user == null):
    │   ├── Login   → LoginScreen   (sem params)
    │   └── SignUp  → SignUpScreen  (sem params)
    └── autenticado:
        ├── Main → MainTabs (bottom tabs):
        │   ├── Dashboard  ("Home", Home)        → DashboardScreen
        │   ├── Projects   ("Projects", FolderOpen) → ProjectsListScreen
        │   ├── Estimates  ("Estimates", FileText)  → EstimatesListScreen
        │   ├── Invoices   ("Invoices", Receipt)    → InvoicesListScreen
        │   └── Clients    ("Clients", Users)       → ClientsScreen
        ├── NewProject      → NewProjectScreen     (—; ao salvar → PhotoUpload{projectId})
        ├── AddClient       → AddClientScreen      { clientId?: string }
        ├── PhotoUpload     → PhotoUploadScreen     { projectId?: string } → EstimatePreview{projectId}
        ├── EstimatePreview → EstimatePreviewScreen { projectId?: string }
        ├── EstimateDetail  → EstimateDetailScreen  { estimateId: string }
        ├── InvoiceDetail   → InvoiceDetailScreen   { invoiceId: string }
        ├── CompanyProfile  → CompanyProfileScreen  (—)
        ├── Team            → TeamScreen            (—)
        ├── ProjectMembers  → ProjectMembersScreen  { projectId: string }
        └── ProjectProgress → ProjectProgressScreen { projectId: string }
```

Fases (fotos/comentários/share link) vivem dentro de **ProjectProgress**; geração/envio de contrato vive dentro de **InvoiceDetail** — não são rotas próprias.

---

## 3. Modelo de dados

> Fonte: `src/services/database.ts` + tipos em `src/context/AppContext.tsx`. O `DATABASE_SCHEMA.md` da raiz está DESATUALIZADO — os campos abaixo refletem o que o app realmente usa. Tabelas tocadas pelo app: `users`, `clients`, `projects`, `media`, `estimates`, `line_items`, `invoices`, `invoice_line_items`, `team_members`, `project_members`, `project_phases`, `phase_photos`, `phase_comments`, `project_share_tokens`, `agreements`, `contract_templates`.

### User / CompanyProfile — tabela `users`
O perfil da empresa É a linha de `users` (1 usuário = 1 empresa). `id` = `auth.users.id`. Campos (snake → camel): `company_name→name`, `company_address→address`, `company_phone→phone`, `company_email→email`, `company_website→website`, `company_license→licenseNumber`, `default_city→city`, `default_state→state` (default `'FL'`), `default_zip→zip`, `logo_url→logoUri`. (`logoScale` só existe no app, não persiste.)

### Client — tabela `clients`
`id`, `user_id` (dono/tenant), `full_name→name`, `phone`, `email`, `address`, `notes`, `created_at`.

### Project — tabela `projects`
`id`, `user_id`, `client_id→clientId`, `name`, `address`/`city`/`zip`, `property_type→propertyType`, `access_level→accessLevel`, `floor_level→floorLevel`, `has_elevator→hasElevator`, `parking_type→parkingType`, `service_type→serviceType`, `service_description→serviceDescription`, `square_feet→squareFeet` (string!), `linear_feet→linearFeet` (string!), `status` (`Draft|Approved|In Progress|Completed`), `created_at`. As **fotos NÃO ficam aqui** — vêm da tabela `media` (`media_type='photo'`) como `photos: string[]`.

### PhotoMedia — tabela `media`
Mídia genérica de projeto. App usa só `media_type='photo'`: `project_id`, `file_url`, `display_order`.

### Estimate — tabela `estimates` ⚠️ COLUNAS DUPLICADAS
A tabela crítica. Dois conjuntos de colunas para os mesmos conceitos. **O app usa o lado esquerdo; o portal Next.js externo lê o lado direito; um trigger (`update_estimate_totals`) sincroniza.**

| App grava/lê | Lado canônico (portal) |
|---|---|
| `tax_rate` | `tax_percent` (tinha DEFAULT 0 → causou o bug de imposto zerado) |
| `margin_rate` | `margin_percent` |
| `total` | `grand_total` |
| `confidence` | `ai_confidence_score` |
| `notes` | `estimate_notes` |

Demais: `id`, `user_id`, `project_id`, `estimate_number` (gerado por trigger no DB), `title` (app grava fixo `'Estimate'`), `status` (`Draft|Sent|Approved|In Progress|Completed`), `subtotal`, `tax_amount→tax`, `margin_amount→margin` (calculados pelo trigger), `valid_until`, `created_at`. **Bug histórico (corrigido):** trigger lia `COALESCE(tax_percent, tax_rate)` e `tax_percent` DEFAULT 0 zerava imposto; fix → `COALESCE(tax_rate, tax_percent, 0)` + imposto só em itens `taxable`.

### LineItem — tabela `line_items`
`id`, `estimate_id`, `description`, `quantity`, `unit_price→unitPrice`, `total`/`subtotal` (app grava o mesmo valor nos dois), `unit` (default `'job'`), `taxable` (default `true`, usado pelo trigger), `item_order`, `category` (default `'Item'`). Inserir/atualizar line_items dispara o trigger que recalcula o estimate pai.

### Invoice — tabela `invoices`
**SEM colunas duplicadas e SEM trigger** — o app grava os totais direto. `id`, `user_id`, `estimate_id→estimateId`, `project_id`, `invoice_number→invoiceNumber` (gerado no app `INV-<timestamp base36>`), `status` (`Unpaid|Sent|Paid|Overdue`), `subtotal`, `tax_rate`/`tax_amount`, `margin_rate`/`margin_amount`, `total`, `notes`, `created_at`.

### InvoiceLineItem — tabela `invoice_line_items`
Mesmos campos do `line_items`, FK = `invoice_id`.

### Agreement / Contract — `agreements` + `contract_templates`
`agreements`: `id`, `invoice_id`, `project_id`, `client_id`, `user_id`, `state` (default `'FL'`, escolhe template), `template_id`, `contract_html` (snapshot HTML), `token` (32 chars, `crypto.getRandomValues`, p/ assinatura externa), `status` (`draft|sent|pending_signature|signed`), `signature_image_url`, `signed_name`, `signed_date`, `pdf_url`, `sent_at`, `created_at`. `contract_templates`: `state`, `is_default`, `content` (HTML com `{{var}}`), `terms_blocks` (JSON). App não escreve em templates. Assinatura é feita por funções no DB (`get_agreement_by_token`, `sign_agreement`) + portal externo.

### Fases — `project_phases`, `phase_photos`, `phase_comments`
`project_phases`: `id`, `project_id`, `estimate_id`, `user_id`, `name`, `phase_order`, `status` (`not_started|in_progress|completed`), `notes`, datas, `is_visible_to_client`. `phase_photos`: `id`, `phase_id`, `project_id`, `user_id`, `file_url`, `caption`, `display_order`. `phase_comments`: `id`, `phase_id`, `project_id`, `author_type` (`contractor|client`), `author_name`, `content`. **Sem ON DELETE CASCADE** — o app deleta filhos manualmente.

### TeamMember — `team_members`
`id`, `owner_id` (dono que convidou), `member_email`, `member_user_id` (null até aceitar), `full_name`, `role` (`admin|estimator|viewer`), `status` (`pending|active|removed` — remoção é soft). 

### ProjectMember — `project_members`
Junção projeto↔membro: `id`, `project_id`, `member_id` (→`team_members.id`), `access_level` (`view|edit|full`), `assigned_by`, `assigned_at` + join desnormalizado `memberName/Email/Role`.

### ShareToken — `project_share_tokens`
`id`, `project_id`, `user_id`, `token` (32 chars), `is_active`, `show_values` (default `false`), `expires_at`.

### Relacionamentos (cardinalidades reais)
```
auth.users 1:1 users (perfil)
users 1:N clients, projects, estimates, invoices, team_members(owner)
clients 1:N projects
projects 1:N media(fotos), estimates, project_phases, project_members, project_share_tokens
estimates 1:N line_items ; 1:N project_phases ; 1:(0..N) invoices  [app trata 1:1]
invoices 1:N invoice_line_items ; 1:(0..N) agreements  [app trata 1:1]
project_phases 1:N phase_photos, phase_comments
team_members N:N projects (via project_members)
agreements N:1 contract_templates, clients
```
Notas: estimate→invoice e invoice→agreement são 1:N no banco mas o app trata 1:1 (pega o único/mais recente). `media` (fotos do projeto) ≠ `phase_photos` (fotos de fase).

### Storage (buckets)
| Bucket | Guarda | Path |
|---|---|---|
| `company-logos` | logo | `{userId}/logo.jpg` (upsert) |
| `project-photos` | fotos do projeto | `{userId}/{projectId}/{photoId}.jpg` (JPEG) |
| `estimate-pdfs` | PDFs | `{userId}/{estimateId}.pdf` (upsert) |

⚠️ **Não existe bucket `phase-photos`** — fotos de fase vão no MESMO `project-photos`, sob prefixo `phase-photos/{projectId}/...`, por um caminho de upload diferente (`fetch`+`arrayBuffer`, sem conversão HEIC). `contract-signatures` não é usado pelo app (só aparece como policy removida; assinatura é do portal). **Unificar upload no redesenho.**

### Estado global (AppContext)
Fatias (todas `useState`): `clients`, `projects`, `estimates`, `invoices`, `teamMembers`, `companyProfile` (default `state:'FL'`), `loading`. Project members NÃO ficam no estado (sob demanda). Padrão **cache-first**: carrega do AsyncStorage e popula imediato → dispara os 6 services em paralelo (`Promise.allSettled`, falha individual cai pro cache) → regrava cache. Mutações são otimistas + regravam cache. Cache só cobre 5 entidades (`@photoquote_{clients,projects,estimates,invoices,company_profile}`).

### Multi-tenant / papéis / RLS
Cada `users.id` = tenant; toda query filtra por `user_id`. Dois níveis de papel: global (`team_members.role`) e por projeto (`project_members.access_level`) — **hoje só rótulos, não aplicados no app**. RLS no servidor apoiada em funções SECURITY DEFINER (`user_has_project_access`, `user_has_team_access`, `get_member_role`) — não revogar EXECUTE delas (quebra RLS). As policies RLS em si NÃO estão versionadas nas 2 migrations presentes (só ajustes de search_path/grants) — **auditar/versionar no redesenho**.

---

## 4. Telas — especificação funcional

### 4.1 Autenticação & Empresa

#### LoginScreen (`src/screens/LoginScreen.tsx`)
- **Objetivo:** autenticar usuário existente (email + senha).
- **Como se chega:** rota raiz não autenticada.
- **Lê/Grava:** nada do banco; dispara `signIn` → `supabase.auth.signInWithPassword`.
- **Validações:** email e senha obrigatórios (Alert). Sem validação de formato, sem "esqueci a senha".
- **Ações:** Sign In (não navega — a sessão dispara a troca de stack); link → SignUp.
- **Estados:** `loading` desabilita inputs + spinner; erro via Alert.
- **Redesenho:** traduzir (strings em inglês); adicionar recuperação de senha; validação inline; rever branding ("Florida's #1...").

#### SignUpScreen (`src/screens/SignUpScreen.tsx`)
- **Objetivo:** criar conta + gravar perfil inicial da empresa no mesmo passo.
- **Lê/Grava:** monta `CompanyProfile` e chama `signUp` → cria auth user + INSERT em `users` (mapeando p/ snake_case).
- **Validações:** obrigatórios email/senha/companyName/phone; senha ≥6; senha==confirmação; state 2 chars; zip numérico.
- **⚠️ Risco:** se o INSERT em `users` falha, o erro é engolido e retorna sucesso → conta auth órfã sem perfil (mitigado de forma frágil por um `useEffect` no CompanyProfile).
- **Redesenho:** criação de perfil deveria ser atômica (trigger/Edge Function); onboarding em etapas em vez de um form gigante; traduzir.

#### LoadingScreen (`src/components/LoadingScreen.tsx`)
- Spinner full-screen enquanto a sessão resolve e durante logout. Sem branding. **Redesenho:** logo + skeleton, unificar com splash.

#### CompanyProfileScreen (`src/screens/CompanyProfileScreen.tsx`)
- **Objetivo:** ver/editar perfil da empresa + logout.
- **Lê/Grava:** `companyProfile` (tabela `users`); upload de logo (bucket `company-logos`) se `file://`; campos: name/address/city/state/zip/phone/email/website/license/logoUri/logoScale.
- **Validações:** só `name` obrigatório; `logoScale` clamp 0.5–2.0.
- **Ações:** trocar/escalar/remover logo; Save (→ goBack); Logout (confirmação → signOut).
- **Redesenho:** logout deveria viver em "Configurações" dedicada; validação de email/telefone; traduzir; o `useEffect` de sync é workaround do bug do signup.

**Fluxo de auth (resumo):** `AuthProvider` inicia `loading=true` → `getSession()` restaura sessão → `onAuthStateChange` mantém `user/session`. `AppNavigator` mostra Loading enquanto `loading`; sem user → Login/SignUp; com user → MainTabs. Logout zera estado + `cacheService.clearAll()`. Flag `MAINTENANCE_MODE` (hoje false) força logout e bloqueia acesso.

### 4.2 Clientes & Projetos

#### ClientsScreen (`src/screens/ClientsScreen.tsx`)
- Lista clientes com busca (name/phone/email) + contagem de projetos. Tap → `AddClient{clientId}` (editar); Add → `AddClient`. `handleDelete` existe mas **não está ligado a botão** (código latente). Empty states distintos (sem clientes vs sem resultado). **Redesenho:** decidir swipe/menu pra excluir; tratar projetos órfãos; traduzir.

#### AddClientScreen (`src/screens/AddClientScreen.tsx`)
- Form único criar/editar. Grava em `clients` (`full_name`, `phone`, `email`, `address`, `notes`). Obrigatórios: name + phone. **Redesenho:** máscara de telefone, validação de email, toast em vez de Alert→OK→goBack.

#### ProjectsListScreen (`src/screens/ProjectsListScreen.tsx`)
- Lista projetos (cliente, status, data, nº estimates, endereço). **Roteamento condicional:** com estimate → `EstimateDetail`; sem → `PhotoUpload`. Status vem do 1º estimate. Sem "Novo Projeto" aqui (mora no Dashboard — incoerente). Sem busca/filtro. **Redesenho:** ver §1 (colapsar com Estimates).

#### NewProjectScreen (`src/screens/NewProjectScreen.tsx`)
- Cria projeto (dados + localização + condições que alimentam o multiplicador de dificuldade) → `PhotoUpload`. Grava em `projects` (`status:'Draft'`; city default 'Miami'). Campos de serviço vão vazios (preenchidos no PhotoUpload). Obrigatórios: nome, cliente (modal), endereço, zip. **Redesenho:** ver §1 ponto 1 — mover condições pra depois/opcional; remover hardcode Miami; seletor de cliente inline.

#### PhotoUploadScreen (`src/screens/PhotoUploadScreen.tsx`) ⭐
- **Objetivo:** subir fotos (até 30), capturar serviços + descrição + medidas, disparar orçamento por IA.
- **Grava:** Storage (`project-photos`, converte p/ JPEG), tabela `media`, e ao "Generate" atualiza `projects` (serviceType como CSV "a, b"). **NÃO chama a IA** — navega `EstimatePreview{projectId}`; a IA roda lá lendo `project.photos`.
- **⚠️ Bug latente:** remover foto no grid só altera estado local — fica órfã em `media`/Storage e ainda vai pra IA via `project.photos`.
- **Redesenho:** sincronizar remoção; manter conversão JPEG/limite 30/multi-seleção; CSV de serviceType é frágil.

#### ProjectProgressScreen (`src/screens/ProjectProgressScreen.tsx`) ⭐
- Acompanhamento por **fases** (status not_started/in_progress/completed), cada uma com fotos e comentários, + link público de progresso pro cliente (`project_share_tokens` → portal Vercel). Fase exige um `estimate_id`. Upload de foto de fase usa caminho próprio (cru, sem conversão). Delete de fase apaga filhos manualmente (sem cascade). **Redesenho:** unificar upload; cascade no banco; nome real do contractor (hoje fixo "Contractor"); URL do portal hardcoded.

#### ProjectMembersScreen (`src/screens/ProjectMembersScreen.tsx`)
- Atribui membros da equipe a um projeto com acesso view/edit/full (via Alert com 3 botões). Separa "Atribuídos" vs "Disponíveis". Acessível só de dentro do EstimateDetail. **Redesenho:** ver §1 ponto 5 (acesso não é aplicado; seletor inline; unificar com Team).

### 4.3 Orçamentos & IA

#### EstimatesListScreen (`src/screens/EstimatesListScreen.tsx`)
- Lista orçamentos (projeto/cliente, total, status, data, nº itens, confiança). Read-only. Tap → `EstimateDetail{estimateId}`. Sem busca/filtro/ordenação. **Redesenho:** ver §1 (colapsar com Projetos).

#### EstimatePreviewScreen (`src/screens/EstimatePreviewScreen.tsx`) — criação
- **Objetivo:** gerar (IA + fallback determinístico) e editar o orçamento antes de salvar.
- **Lógica:** mostra **estimativa-base** local instantânea (`buildLineItems` com catálogo `SERVICE_ITEMS` × `getDifficultyMultiplier` × `getLocationMultiplier` + parsing de keywords da descrição), e em paralelo chama a IA (uma vez, guard `aiCalled`). Quando a IA responde, **substitui** a lista inteira.
- **Cálculos (useMemo):** `subtotal=Σ(qty×price)`; `taxableSubtotal=Σ só dos taxable`; `tax=taxableSubtotal×taxRate/100`; `margin=(subtotal+tax)×marginRate/100`; `total=subtotal+tax+margin`. **Bate com o trigger.** `marginRate` inicia `'0'`.
- **Grava:** `addEstimate` → `estimates` (`tax_rate`, `margin_rate`, `confidence`, `notes`) + `line_items`. NÃO grava totais (trigger calcula e o service relê). Depois `replace('EstimateDetail')`.
- **Estados:** banner loading IA / banner amarelo não-bloqueante em erro/timeout / banner verde sucesso / tela inteira de "fotos inválidas" (PhotoValidationError).
- **Redesenho:** IA sobrescreve a base (usuário perde edições) — avaliar merge; extrair toda a lógica de pricing pra um serviço de domínio / Edge Function; `, FL` hardcoded; default margin 0 (já causou bug).

#### EstimateDetailScreen (`src/screens/EstimateDetailScreen.tsx`) — detalhe
- **Objetivo:** ver/editar (só em Draft), avançar status, enviar (texto/PDF por email/SMS/WhatsApp), gerar fatura, abrir progresso/equipe, deletar.
- **Cálculos:** mesma fórmula do Preview/trigger; **mas a UI de edição NÃO deixa alterar a margem** (só tax). Edição faz delete+insert de todos os line_items (perde UUIDs).
- **⚠️:** `handleGenerateInvoice` sem try/catch; status via bolinha+Alert; envio por Alerts aninhados; `, FL` hardcoded; fatura é cópia imutável dos totais.
- **Redesenho:** permitir editar margem; pipeline com 1 CTA; envio por bottom sheet.

### 4.4 Faturas, Dashboard & Equipe

#### InvoicesListScreen (`src/screens/InvoicesListScreen.tsx`)
- Lista faturas (número, projeto/cliente, total, status, data). Tap → `InvoiceDetail`; lixeira → delete (cascade nos itens). Sem filtro/soma/agrupamento. USD/datas US hardcoded.

#### InvoiceDetailScreen (`src/screens/InvoiceDetailScreen.tsx`)
- **Objetivo:** detalhe da fatura (timeline de status Unpaid→Sent→Paid→Overdue), PDF, e contrato (agreement) ligado.
- **Não recalcula totais** — exibe os persistidos (fonte do bug das faturas erradas: snapshot congelado sem trigger). Auto-avança Unpaid→Sent ao enviar.
- **Contrato:** Generate (cria `agreement` com template por state + token) → Send for Signing (URL `.../agreement/sign/<token>` por email/WhatsApp/Share, marca `sent`) → portal externo assina. Status de fatura e de contrato são independentes. `deposit=50%` do total hardcoded.
- **Redesenho:** Alerts aninhados → bottom sheet; FL/USD/URL hardcoded; template de PDF compartilhado com estimate; **escapar HTML (XSS)**.

#### DashboardScreen (`src/screens/DashboardScreen.tsx`)
- 4 métricas (Clients, Projects, Estimates, **Revenue = soma de TODOS os estimates** — engana, não é recebido) + quick actions (New Project/Client/Team) + 5 projetos recentes. Nome "PhotoQuote AI" fixo no header (não usa `companyProfile.name`). **Redesenho:** separar pipeline (orçado) de recebido (faturas Paid); usar nome real da empresa; filtro por período.

#### TeamScreen (`src/screens/TeamScreen.tsx`)
- Convidar (nome+email+papel viewer/estimator/admin), trocar papel, remover (soft-delete). **Papéis são só rótulos — não restringem nada.** Duplicado detectado por substring "duplicate" (frágil). Membro `pending` nunca vira `active` por aqui (sem fluxo de aceite). **Redesenho:** ver §1 ponto 5.

---

## 5. Fluxo de IA (foto → orçamento) — contrato para a Edge Function

Implementado em `src/services/openaiService.ts`, `generateAIEstimate(params)`. Hoje **sai direto do device** (chave embarcada). Vai virar Edge Function.

- **Modelo/endpoint:** `gpt-5.2-pro-2025-12-11` via OpenAI **Responses API** `POST /v1/responses`. Chave de `expoConfig.extra.openaiApiKey`.
- **Fotos:** máx **5** (`slice(0,5)`); cada uma → base64 data-URL `data:image/jpeg;base64,...`.
- **Timeout:** **180s** via AbortController → "AI request timed out".
- **Body:** `{ model, instructions: systemPrompt, input:[{role:'user', content:[input_text, ...input_image]}], text:{format:{type:'json_object'}}, max_output_tokens:16000 }`.
- **Prompt:** system = "estimador de construção 20+ anos" com 3 tarefas (descrever fotos, **validar** que são de construção senão `rejected:true`+motivo, gerar estimativa 4–8 itens/serviço, materiais geralmente `taxable`). user = injeta services/description/city/state/propertyType/área/condições + schema JSON exato de saída.
- **Contrato I/O:**
  - **Input:** `{ photoUris: string[], services: string[], description, sqft, linearFeet, propertyType, accessLevel, floorLevel, hasElevator, parkingType, city, state }`.
  - **Output sucesso:** `{ lineItems: {category, description, unit, quantity, unitPrice, taxable}[], confidence, notes, photoAnalysis }`.
  - **Output rejeição:** `PhotoValidationError(message, photoAnalysis)`.
- **Parsing:** extrai `output[].type==='message' → content[].type==='output_text'`; limpa fences markdown; `JSON.parse` (fallback regex do maior objeto); se `rejected` → erro de validação; filtra itens sem preço/qty; normaliza (`taxable` default true; `confidence` clamp 0–100, fallback 85).
- **Pontos críticos p/ a Edge Function:** (1) tirar a chave do client; (2) a Function recebe URLs do Storage e baixa lá (não base64 do device); (3) **timeout de 3 min excede o limite de Edge Function → ir de assíncrono** (job + tabela de logs + Realtime); (4) replicar Responses API + json_object + max_output_tokens; (5) distinguir HTTP rejeição (`{rejected:true}`) de falha.

---

## 6. Fluxos de negócio

### Orçamento → Fatura → Contrato
1. **Orçamento** é a fonte dos valores (totais via trigger).
2. **Fatura** nasce por "Generate Invoice": **copia** lineItems + totais do orçamento, `status:'Unpaid'`, número `INV-<timestamp base36>`. **Sem trigger** — totais congelados no cliente. Se já existe fatura, só navega pra ela.
3. **Contrato** por "Generate Contract": carrega `contract_template` por state, gera token (32 chars), preenche template (escapando HTML/`$`), `deposit=total/2`, salva snapshot `contract_html`, `status:'draft'`.
4. **Assinatura:** token → URL do portal Vercel; "Send for Signing" envia e marca `sent`; portal externo assina e grava `status='signed'`/`signed_name`/`signed_date`/`signature_image_url`. Os três status (orçamento/fatura/contrato) evoluem independentes.

### Projeto → Fases → Portal do cliente
Projeto tem N fases (cada uma amarrada a um estimate); fase tem N fotos + N comentários (contractor/client). `project_share_tokens` gera link público (`show_values` controla se mostra $) pro portal externo, onde o cliente vê progresso e comenta como `client`.

---

## 7. Edge Functions propostas

1. **`ai-estimate`** (resolve o vazamento da chave + a IA que "sempre quebra" + falta de logs):
   - **Assíncrona:** app envia fotos (URLs do Storage) → function cria um job (`ai_jobs`: status, modelo, duração, tokens, request, response, erro) e responde NA HORA com `jobId` → processa OpenAI em background → grava resultado/erro no job → app escuta via **Realtime** e a estimativa "cai" sozinha. Sem timeout pra estourar.
   - Retry com backoff; opção de modelo mais rápido na 1ª passada. Chave OpenAI como **secret** da function (fora do bundle).
   - Versão simples possível pra começar: function síncrona com logs + retry, evoluir pro async.
2. **`recompute-totals`** (fonte única de verdade): calcula subtotal/tax/margin/total para orçamento E fatura com a mesma fórmula → mata o bug das faturas erradas e a divergência app×banco. Backfill das faturas antigas com a mesma função.

---

## 8. Dívida técnica & correções a carregar pro redesenho

**🔴 Críticos (de hoje, em produção):**
- Chave OpenAI vazada no bundle (`app.config.js` → `expo.extra`; confirmada no `dist/`). **Revogar + Edge Function.**
- Faturas antigas com imposto errado (snapshot sem trigger; ex. `INV-MNZ9D36W` imposto 0 vs orçamento corrigido $178,50). **Backfill.**
- XSS nos PDFs de orçamento/fatura (`buildInvoicePdf`/`buildPdfHtml` sem escape; só agreements foi corrigido). **Aplicar escapeHtml.**
- Zero testes automatizados num app financeiro.

**🟡 Médios:** limite default 1000 linhas do Supabase em todo `getAll` (trunca em silêncio); N+1 em todo `getAll`; `AppContext` god-object sem memo (re-render global → React Query); `loadData` sem guarda de corrida + cache não namespaced por user (vazamento entre contas); margem nasce 0 e é não-editável no Detail; `estimateService.update` não relê totais; sessão em AsyncStorage (não SecureStore); logs com email/userId sem `__DEV__`; OTA `production` atinge 100% dos 1.0.0 de uma vez (sem staged rollout); `DATABASE_SCHEMA.md` enganoso; RLS policies não versionadas.

**🔵 Baixos:** `test-openai.ts` órfão; remover foto deixa órfãos em `media`/Storage; `phaseService.delete` não checa erro dos filhos; `logoScale` não persiste; `DecimalInput` mostra 0 como vazio; 9 `.md` da raiz são da fase MVP (só `docs/changelog.md` é confiável); dois caminhos de upload de foto; hardcode FL/Miami/USD/inglês.

---

*Fim do blueprint. Próximos passos sugeridos: (1) validar a IA de navegação proposta (§1); (2) desenhar as telas a partir deste doc; (3) eu construo a Edge Function `ai-estimate` (serve o app atual e o novo).*
