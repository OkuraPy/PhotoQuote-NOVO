# Changelog — PhotoQuote-NOVO

Registro por commit (Regra #0). Mais recente no topo.

---

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
