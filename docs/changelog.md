# Changelog — PhotoQuote-NOVO

Registro por commit (Regra #0). Mais recente no topo.

---

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
