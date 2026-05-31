# PhotoQuote v2 — Plano de Build (front novo → app vivo com dados reais)

> Objetivo: levar o app v2 (já implementado em `src/v2/`, hoje com dados de exemplo) a **funcional de ponta a ponta com dados reais**, atingindo e **superando** a paridade com o app original — sem deixar escapar nenhuma função.
> Princípio: por FASES, cada uma testável e demonstrável. Backend = Supabase atual (mantido) + Edge Functions novas. Nada de produção é tocado sem teste + OK.
> Referências: `docs/APP_BLUEPRINT.md` (o que o original faz), `docs/REDESIGN_SPEC.md` (como o v2 deve ser).

---

## 0. Onde estamos
- ✅ Front v2 inteiro em RN (`src/v2/`): design system (tema/ícones/componentes), ~15 telas, navegação, fontes Manrope/Space Grotesk. `tsc` limpo, empacota (web) sem erro, renderização validada.
- ⚠️ Roda em **dados de exemplo** (`src/v2/data.ts`). NÃO ligado ao Supabase. IA simulada (timer). Câmera/voz/CEP/envio são placeholders.
- 📦 App v1 preservado em `App.legacy.tsx` (referência).

---

## 1. Checklist de paridade (TODAS as funções do original) — nada escapa

Legenda: ✅ pronto no v2 · 🟦 UI pronta, falta ligar · 🟥 falta construir · ⭐ melhoria nova.

### Autenticação & conta
- [ ] 🟦 Login real (Supabase `signInWithPassword`)
- [ ] 🟦 Cadastro real + criação de perfil **atômica** (trigger/Edge Function — corrige conta órfã do v1)
- [ ] 🟥 Recuperação de senha (reset por email) ⭐ (v1 não tinha)
- [ ] 🟦 Logout (limpa sessão + cache)
- [ ] 🟥 Sessão em **SecureStore** (não AsyncStorage) ⭐
- [ ] 🟦 Perfil da empresa (`users`): nome, endereço, telefone, email, licença, logo (upload), defaults

### Clientes
- [ ] 🟦 Listar (busca) · [ ] 🟦 Criar · [ ] 🟦 Editar · [ ] 🟥 Excluir (com aviso de jobs) · [ ] 🟦 Detalhe + histórico de jobs
- [ ] ⭐ CEP autopreenche cidade/estado (zip-lookup)

### Projetos / Jobs
- [ ] 🟦 Listar (busca + filtro por estágio) · [ ] 🟦 Criar (foto-first) · [ ] 🟦 Detalhe (timeline + abas)
- [ ] ⭐ Cliente **opcional** (rascunho sem cliente; `client_id` nullable)
- [ ] 🟥 Status/estágio persistido no banco

### Fotos & Câmera
- [ ] 🟥 Câmera real (expo-camera) + galeria (expo-image-picker)
- [ ] 🟥 Conversão HEIC→JPEG + upload p/ bucket `project-photos` + linha em `media`
- [ ] 🟥 Remover foto propaga (deleta storage + `media`) — corrige bug do v1
- [ ] 🟥 Voz: gravar (expo-av) → upload → transcrever (Whisper) → vira descrição ⭐

### Estimativa / IA
- [ ] 🟥 IA real foto→orçamento via Edge Function `ai-estimate` (assíncrona + Realtime)
- [ ] 🟥 Estimativa-base determinística (fallback offline)
- [ ] 🟥 Tela de "fotos inválidas" (rejeição da IA)
- [ ] 🟦 Editar itens (add/remover/qty/preço/unidade/categoria/taxável)
- [ ] 🟥 Totais via Edge Function `calc-totals` (fonte única) + persistir
- [ ] ⭐ Markup interno (margem) oculto do cliente

### Fatura
- [ ] 🟥 Gerar fatura real a partir do orçamento (número **sequencial** INV-AAAA-NNNN)
- [ ] 🟥 Totais via `calc-totals` (acaba a fatura congelada divergente do v1)
- [ ] ⭐ Data de emissão + **vencimento** (Net 15/30); depósito **configurável**
- [ ] 🟥 PDF (expo-print) com **HTML escapado** (corrige XSS); mudar status; enviar (email/SMS/WhatsApp)
- [ ] ⭐ Margem NÃO aparece no documento do cliente

### Contrato (agreement)
- [ ] 🟥 Gerar a partir do template por estado (`contract_templates`) + token seguro
- [ ] 🟥 Enviar p/ assinatura (URL do portal Next.js) + status (draft/sent/signed)
- [ ] 🟥 Ler estado assinado (nome/data/assinatura) de volta no app

### Progresso da obra
- [ ] 🟥 Fases CRUD (add/editar status/excluir) · [ ] 🟥 fotos por fase · [ ] 🟥 comentários
- [ ] 🟥 Link público de progresso (`project_share_tokens`) + portal
- [ ] 🟥 Unificar upload de fotos (um caminho só, com conversão) — corrige inconsistência do v1

### Equipe & permissões
- [ ] 🟥 Convidar membro (email/nome/papel) + status pending→active (fluxo de aceite) ⭐
- [ ] 🟥 Trocar papel / remover (soft-delete)
- [ ] 🟥 Membros por projeto (acesso view/edit/full) — **e de fato aplicar** (RLS) ⭐
- [ ] 🟦 Decisão: simplificar p/ 1 modelo ou manter dois (ver REDESIGN_SPEC §7)

### Dashboard / Home
- [ ] 🟥 Métricas reais: Pipeline (orçado) / Faturado / **Recebido** (faturas pagas) — honestas ⭐
- [ ] 🟥 Jobs recentes reais

### Defaults / Config
- [ ] 🟥 Moeda/locale, alíquota padrão, condições de pagamento, % depósito (persistir em `users`)

---

## 2. Backend a construir

### Edge Functions
| Função | Faz | Resolve |
|---|---|---|
| `ai-estimate` (async) | recebe `{jobId, photoUrls, services, desc, conditions, zip}` → cria `ai_jobs` (log) → chama OpenAI (Responses API, chave = **secret**) com retry → grava resultado; app escuta via Realtime | IA que "sempre quebra" + sem logs + chave vazada |
| `calc-totals` | `{lineItems, taxRate, marginRate}` → `{subtotal, taxableSubtotal, tax, margin, total}` (fórmula §9) | fonte única de verdade (orçamento E fatura) |
| `zip-lookup` | `{zip}` → `{city, state, regionIndex}` (API pública grátis de CEP + tabela regional) | localização em 1 campo + preço regional fora do app |
| `transcribe` (opcional) | áudio → texto (Whisper) | nota de voz vira descrição |

### Migrations (Supabase) — pontuais, testadas em branch
- [ ] `ai_jobs` (status, model, request, response, error, duration_ms, tokens, created_at)
- [ ] `regional_pricing` (zip_prefix/region → index) + seed
- [ ] `projects.client_id` → **nullable** (rascunho sem cliente)
- [ ] Numeração **sequencial** de fatura (sequence/contador por `user_id`)
- [ ] Campos de fatura: `due_date`, `deposit_percent` (configurável)
- [ ] **Backfill** das faturas antigas erradas (imposto 0) via `calc-totals` — dívida do audit
- [ ] (follow-up, com portal) unificar colunas duplicadas de `estimates`

### Segurança (do audit — fechar nesta migração de fase)
- [ ] **Revogar a chave OpenAI vazada** e usar secret na Edge Function (precisa **chave nova do usuário**)
- [ ] Ativar "Leaked password protection" no dashboard (manual)
- [ ] `escapeHtml` em todos os PDFs; PII de log atrás de `__DEV__`

---

## 3. Fases de desenvolvimento (ordem de execução)

**FASE 0 — Fundação de dados** (sem tocar produção)
- Supabase client no v2 (reaproveita `src/services/supabase.ts`), **React Query** (provider + hooks), tipos do DB, mappers DB↔app.
- Auth real: login/cadastro/sessão/logout; perfil atômico; SecureStore.
- _Pronto quando:_ login com conta real entra e a sessão persiste.

**FASE 1 — Edge Functions + schema**
- Criar/deployar `calc-totals`, `zip-lookup` (+ seed), `ai-estimate` (+ `ai_jobs`); migrations da §2; secret OpenAI.
- _Pronto quando:_ functions testadas via curl; chave fora do bundle.

**FASE 2 — Fluxo central real**
- Clientes (CRUD+busca); criar job; **Câmera real** (foto+upload); **Estimativa** (ai-estimate + Realtime + calc-totals + edição persistida); Vincular cliente (busca/cria + zip-lookup).
- _Pronto quando:_ dá pra criar um orçamento real de ponta a ponta a partir de fotos reais.

**FASE 3 — Cobrança real**
- Estágio persistido; **Fatura** real (número sequencial, calc-totals, vencimento, depósito); **envio** (email/SMS/WhatsApp + PDF escapado); **Contrato** (template+token+portal); **Progresso** (fases/fotos/comentários/share link).
- _Pronto quando:_ orçamento→fatura→contrato→assinatura no portal, tudo real.

**FASE 4 — Perfil/Equipe/Config + Dashboard + Voz**
- `users`/empresa; **Equipe** (convite/papéis/status/aceite) + membros por projeto (com RLS aplicada); defaults persistidos; métricas reais; nota de voz real (gravar+transcrever).
- _Pronto quando:_ paridade total + os recursos novos do redesenho.

**FASE 5 — Segurança, qualidade, testes**
- Fechar críticos do audit; **testes** de `calc-totals`/mappers; estados de erro/vazio/offline; decisão i18n (UI em inglês como o design vs pt-BR).
- _Pronto quando:_ 0 críticos do audit; testes passam; `tsc` limpo.

**FASE 6 — Loja & deploy**
- Herdar identidade (**bundle id, EAS projectId, ascAppId 6761633213**, version/buildNumber) no app v2; runtimeVersion/rollout; backfill faturas; build + submit; remover `App.legacy.tsx`/`src/` antigo quando o v2 estiver 100%.
- _Pronto quando:_ v2 sobe como **atualização do mesmo app** na App Store, usuários atuais recebem.

---

## 4. Dependências do usuário (preciso de você)
1. **Chave OpenAI NOVA** (a atual vazou e será revogada) — pra eu pôr como secret da Edge Function.
2. Confirmar acesso/projeto Supabase (`tojgbcwzvijhdmmreqaf`) pra deploy de functions/migrations.
3. Decisões: (a) idioma da UI — inglês (como o design) ou pt-BR? (b) equipe — simplificar pra 1 modelo ou manter dois níveis? (c) % de depósito e condições padrão.
4. No fim: revisar e aprovar o build antes do submit à loja.

---

## 5. Como vou trabalhar
- Uma fase por vez, com commits pequenos + entrada no `docs/changelog.md` (Regra #0).
- Ao fim de cada fase, te mostro rodando (screenshots/print do real) antes de seguir.
- Nada de produção (deploy de function, migration, submit) sem teste e seu OK.

*Plano vivo — marco os checkboxes conforme entrego.*
