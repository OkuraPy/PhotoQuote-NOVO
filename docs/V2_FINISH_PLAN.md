# PhotoQuote v2 — Plano de Execução para FINALIZAR (runbook detalhado)

> Gerado em **16/06/2026** a partir de uma auditoria exaustiva (6 frentes) do código real em `src/v2/`, do banco Supabase de produção (`tojgbcwzvijhdmmreqaf`), das Edge Functions e do portal do cliente (`photoquote-client-portal`). Cada achado tem referência `arquivo:linha`. **Incorpora as decisões do dono de 16/06** (seção 0). Este é o documento-fonte para fechar a v2.
> Complementa `V2_BUILD_PLAN.md`, `APP_BLUEPRINT.md` e `REDESIGN_SPEC.md`.

---

## 0. Decisões do dono (16/06) — TRAVADAS

| # | Tema | Decisão |
|---|------|---------|
| 1 | **Chave OpenAI** | Manter a chave atual (vazada) **por enquanto**; o dono troca depois. **Não bloqueia o desenvolvimento.** Rotacionar continua no plano (Fase H) para antes de publicar. |
| 2 | **Cobertura geográfica** | Atua em **todos os 50 estados dos EUA**. → Contrato usa **1 template US genérico** (`is_default`), parametrizado, válido em qualquer estado (sem seed por estado agora). |
| 3 | **Depósito** | **100% definido pelo usuário** (o contractor escolhe o %: 10%, 20%, etc.). **Sem padrão fixo.** Campo configurável por trabalho/fatura; o mesmo valor vale para fatura e contrato. |
| 4 | **Idioma / i18n** | App multi-idioma: **EN (principal) · ES (2º) · PT (3º)**. **Por enquanto fica em inglês.** → Montar a infra de i18n + extrair strings agora (EN ativo); traduções ES/PT entram em seguida, sem retrabalho. |
| 5 | **Equipe/permissões** | **Adiar** (no v1 também eram só rótulos). |

---

## 1. Estado atual (resumo)

**Pronto e real (não mexer):** login/cadastro/logout + gate de sessão; clientes CRUD; criar orçamento foto-first (câmera ao vivo, GPS/CEP, preço regional por estado); IA foto→orçamento (síncrona) + voz→texto; edição de itens com totais corretos (trigger do banco == `calcTotals`); margem oculta do cliente; fatura sequencial; **PDF com HTML escapado** (XSS do v1 corrigido) e envio email/SMS/WhatsApp; Home com métricas; e o **Contrato** (no working tree, round-trip com o portal validado contra o RPC `sign_agreement`).

**Correção factual (vs. registros anteriores):** **NÃO há dívida de imposto.** 8 faturas, 0 divergem do orçamento; as 10 estimativas com `tax_rate>0 & tax_amount=0` têm `taxable_subtotal=0` (itens não-taxáveis). **Backfill = desnecessário.**

**Falta:** corrigir bugs de integridade (§2), persistir estágio/status, fechar contrato, construir a UI do acompanhamento da obra (backend já existe e populado), completar perfil/config, robustez da IA, i18n, segurança/reprodutibilidade, testes, publicar.

---

## 2. Achados da auditoria — por severidade (com `arquivo:linha`)

### 🔴 Críticos (corrompem dados ou enganam)
1. **Cidade/ZIP do cliente não persistem.** `createClient`/`updateClient` gravam só `address` (`api.ts:95-111`); schema tem `address_city/state/zip`; `fetchClients` lê os estruturados (`api.ts:80,90`). → `c.city` sempre vazio; CEP do autofill descartado (`Misc.tsx:105`).
2. **Estágio não persiste** — `setStage`→`store.stageOverride` em memória (`Job.tsx:56,58`); `Sent/Approved/Paid` somem no reload.
3. **Status da fatura nunca vira `Sent`/`Paid` no banco** — só `Unpaid` na criação (`api.ts:227`); badge derivado de memória (`Job.tsx:287`). Regressão vs v1.
4. **"Recebido" (Collected) infla** — `deriveStage` retorna `Paid` para estimate `Completed` sem fatura (`api.ts:331-336`); Home conta como recebido (`Tabs.tsx:60`).
5. **`createJob` grava status minúsculo `'draft'`** (`api.ts:151,161`); `deriveStage` faz switch em `'Draft'` (`api.ts:326-340`) → orçamento novo vira "Quoted", nunca "Draft".
6. **Apagar cliente faz CASCADE** — FK `projects.client_id` é `ON DELETE CASCADE`; `deleteClient` apaga direto, sem aviso (`api.ts:113`, `Misc.tsx:126`) → apaga os projetos junto.
7. **Nome da empresa some no cadastro com confirmação de e-mail** — upsert sem sessão bloqueado por RLS, erro engolido (`auth.tsx:53-56`) → `company_name=''`.
8. **`contract_templates` só tem FL** (1 linha) → contrato fora da Flórida cai no fallback FL.

### 🟠 Médios
9. **Depósito divergente:** fatura 25% (`Job.tsx:265`) vs contrato 50% (`api.ts:308`). (Resolvido pela decisão #3: configurável, valor único.)
10. **Número de fatura gerado no cliente** por `count+1` (`api.ts:217-218`): risco de corrida/colisão.
11. **"Edit" dos itens não edita** — navega com params vazios (`Job.tsx:233`).
12. **Sem fallback offline da IA** — IA falha = lista vazia (`Flow.tsx:399`).
13. **Token de assinatura usa `Math.random()`** (não CSPRNG) (`api.ts:313`).
14. **`terms_blocks` do contrato sai vazio** (`api.ts:310`) → cláusulas em branco.
15. **Reset de senha incompleto** — envia e-mail (`auth.tsx:61-64`) mas não há tela `updateUser` nem deep-link.

### 🟡 Baixos / paridade
16. **Upload de logo não portado** (`logo_url` nunca gravado) — e o portal usa `users.logo_url` no progresso.
17. **Defaults/Config são dead UI** (`Tabs.tsx:265-300`): Currency, Tax rate, Payment terms, Deposit, Notifications, Change password, Logo, Team sem `onPress`; `default_*` ignorados; 8.25% chumbado (`Navigator.tsx:52`).
18. **Histórico de jobs do cliente é mock** (`Misc.tsx:19`, array `JOBS`).
19. **Busca de clientes só por nome** (`Tabs.tsx:201`).
20. **`jobs:0` hardcoded** em `fetchClients` (`api.ts:91`) → "0 jobs" no vincular-cliente (`Flow.tsx:632`).
21. **`due_date`/Net hardcoded 15d na UI** (`Job.tsx:270`); `invoices` sem `due_date`/`deposit_*`.
22. **PDF da fatura mais pobre que a tela**; caminho `kind==='contract'` em `sendDoc` é código morto (`send.ts:98-101`).
23. **Onboarding órfão** (`Auth.tsx:131`); signup grava "Full name" em `company_name`.
24. Imports mock remanescentes: `COMPANY`/`CLIENTS` (`Job.tsx:5,53`, `Tabs.tsx:8`, `Misc.tsx:18`).

### 🔵 Divergências do plano (funcionam)
- IA **síncrona** (`gpt-5.2`, 60s) sem `ai_jobs`/logs; sem Edge Functions `calc-totals`/`zip-lookup` (trigger + client cobrem); fotos em `projects.photo_urls` (0/56 populado) e abandonou `media`.

### 🔴 Dívida estrutural / segurança
- **Chave OpenAI vazada ainda em uso** (`app_config`, `sk-proj…`). Rotacionar (Fase H, quando o dono der a nova).
- **17 migrations base + `app_config` não versionados** no repo → sem reprodutibilidade.
- **Sessão em AsyncStorage** (não SecureStore); **leaked-password protection desligada**; perf (49 RLS `auth.uid()`/linha, 19 FKs sem índice, 55 policies duplicadas).

---

## 3. Runbook de execução (passo a passo, sem erro)

> Regras: uma fase por vez; commits pequenos + `docs/changelog.md` (Regra #0); **nada que toque produção (deploy de function, migration, submit) sem teste + OK do dono**; ao fim de cada fase, demonstrar rodando e provar no device. Migrations testadas em branch do Supabase antes do remoto.

### FASE A — Integridade de dados (estanca corrupção; rápido)
- **A1 · Endereço estruturado do cliente.** `api.ts` (`createClient`/`updateClient`/`fetchClients`), `Misc.tsx` (editor). Gravar `address_street/city/state/zip` separados + `address` legado sincronizado; CEP do autofill grava `address_zip`+city+state. _Migration:_ nenhuma (colunas existem). _Teste:_ criar cliente com CEP → reabrir → persiste; conferir via SQL. _Pronto:_ gravado == lido.
- **A2 · Normalizar status.** `api.ts` — `createJob` grava `'Draft'` capitalizado **e** `deriveStage` aceita case-insensitive (cinto + suspensório). _Teste:_ job novo aparece "Draft". 
- **A3 · "Recebido" honesto.** `api.ts:331-336` separar `Completed` de `Paid`; `Tabs.tsx:60` contar só `invoices.status='Paid'`. _Teste:_ estimate Completed sem fatura **não** entra em Recebido.
- **A4 · Nome da empresa no signup.** Passar o nome em `raw_user_meta_data` e o trigger `handle_new_user` lê dele (migration no trigger); separar "nome da pessoa" de "nome da empresa"; tratar erro do upsert. _Migration:_ ALTER do trigger (produção → OK do dono). _Teste:_ cadastrar com confirmação de e-mail → `company_name` correto.
- **A5 · Exclusão de cliente segura.** Migration: `projects.client_id` FK `ON DELETE CASCADE`→**`SET NULL`**; `api.ts`/`Misc.tsx`: contar trabalhos e avisar antes. _Migration:_ produção → OK. _Teste:_ apagar cliente com job → projeto sobrevive com `client_id NULL`.
- **A6 · Testes desta fase.** Jest p/ mappers DB↔app e `deriveStage`.
- _Pronto quando:_ dados consistentes; novo orçamento = Draft; Recebido honesto; apagar cliente não destrói projetos; nome persiste. `tsc` limpo.

### FASE B — Persistir estágio e status
- **B1 · Avançar estágio grava no banco.** `setStage('Approved')`→`estimates.status='Approved'` (nova `updateEstimateStatus` em `api.ts`); CTA "approve" persiste e invalida queries. _Teste:_ aprovar → reload → continua aprovado.
- **B2 · Status da fatura.** "Enviar fatura"→`invoices.status='Sent'`; "Mark paid"→`'Paid'` (`updateInvoiceStatus`). _Teste:_ marcar pago → reload → pago; Home reflete.
- **B3 · Número de fatura atômico.** Migration: sequence/contador por `user_id`(+ano) no banco; `createInvoice` usa o contador atômico (fim do `count+1`). _Migration:_ produção → OK. _Teste:_ criar 2 faturas concorrentes → números distintos.
- _Pronto quando:_ estágio/status sobrevivem ao reload; números nunca colidem.

### FASE C — Fechar o Contrato (com qualidade)
- **C1 · Template US genérico.** Inserir 1 `contract_templates` `is_default=true`, neutro de estado (válido nos 50 estados), com placeholders e `terms_blocks`. _Migration/seed:_ produção → OK. _(Mantém FL como variação.)_
- **C2 · Depósito configurável.** Coluna `deposit_percent` (em `users` como default editável **e** snapshot por fatura); UI no perfil + por trabalho; usar o **mesmo** valor em fatura e contrato; **parametrizar `{{deposit_percent}}`** no template (sem "50%" chumbado). _Migration:_ add coluna → OK. _Teste:_ definir 15% → fatura e contrato mostram 15%.
- **C3 · Token CSPRNG.** `expo-crypto` no lugar de `Math.random()` (`api.ts:313`).
- **C4 · Termos completos.** Ler `contract_templates.terms_blocks` e injetar (`api.ts:310`).
- **C5 · Metadados de envio.** Gravar `sent_at`/`sent_method` no agreement.
- **C6 · Commit + changelog.**
- _Pronto quando:_ contrato gera em qualquer estado, termos completos, token seguro, depósito = fatura; portal assina (round-trip ok).

### FASE D — Acompanhamento da obra (backend JÁ existe e populado)
> Requisitos exatos do portal (`get_project_by_share_token`, `add_client_comment`): só construir UI + gravação.
- **D1 · Ler fases.** `fetchPhases(projectId)` + `ProgressTab` real (`Job.tsx:442-497`): `project_phases` (nome, `phase_order`, `status ∈ {not_started,in_progress,completed}`, `notes`, datas, `is_visible_to_client`).
- **D2 · CRUD de fases** gravando em `project_phases` (respeitar `is_visible_to_client`).
- **D3 · Fotos por fase.** Upload p/ bucket público + `phase_photos` (`file_url`,`caption`,`display_order`). Reusar pipeline resize/JPEG.
- **D4 · Comentários.** Ler `phase_comments`; mostrar os do cliente (`author_type='client'`); contractor comenta (`'contractor'`).
- **D5 · Link público.** Gerar/ativar `project_share_tokens` (32 chars, `is_active`) + compartilhar `/p/<token>`; **preencher `projects.activated_at`** (portal usa como início).
- _Pronto quando:_ criar fase, subir foto, gerar link, abrir no portal e ver tudo real.

### FASE E — Perfil, Config e paridade
- **E1 · Logo da empresa.** Upload (bucket público) → `users.logo_url`; exibir no PDF e (portal já usa) no progresso.
- **E2 · Defaults configuráveis** em `users` (`default_tax_percent`, `default_margin_percent`, `deposit_percent`, payment terms) — ligar as linhas mortas e alimentar orçamento/fatura/contrato (acaba 8.25% e `'FL'` chumbados).
- **E3 · Histórico real do cliente** (`fetchJobs` filtrado) (`Misc.tsx:19`).
- **E4 · Reset de senha completo** — `redirectTo` + deep-link + tela `updateUser`; ligar "Change password".
- **E5 · Limpeza.** Busca de cliente por nome/phone/email; `fetchClients` contar jobs reais; "Edit" passar params; onboarding no fluxo; remover imports mock.
- _Pronto quando:_ perfil grava tudo; defaults alimentam documentos; logo no PDF/portal; reset fecha o ciclo.

### FASE F — Robustez da IA
- **F1 · Fallback determinístico offline** (catálogo de itens-base por serviço) — IA falha = orçamento-base editável, não tela vazia.
- **F2 · Logs `ai_jobs`** (opcional, mantém síncrono): tabela request/response/erro/duração/tokens p/ diagnosticar quando a IA "quebra".
- _Pronto quando:_ IA cai e o usuário ainda orça; chamadas deixam rastro.

### FASE G — i18n (EN/ES/PT) — telas já estáveis
- **G1 · Infra de i18n** (lib leve + detecção de locale + seletor no perfil). EN como locale ativo.
- **G2 · Extrair strings** das telas v2 para chaves (sem mudar texto exibido — fica EN).
- **G3 · Dicionários ES e PT** (tradução) — entregáveis em seguida; EN é o default e o fallback.
- **G4 · Locale de dados** (datas/moeda) por idioma quando ES/PT ativarem (hoje `en-US`/USD).
- _Pronto quando:_ trocar de idioma troca a UI; EN 100%, ES/PT carregados.

### FASE H — Segurança & reprodutibilidade (antes de publicar)
- **H1 · Rotacionar a chave OpenAI** (quando o dono entregar a nova) e mover p/ **Supabase secret** (Edge Function lê `Deno.env`). _Depende do dono._
- **H2 · Versionar schema** (17 migrations base) + `app_config` no repo (dump).
- **H3 · SecureStore** p/ a sessão (adapter com chunking).
- **H4 · Leaked password protection** (1 clique no painel).
- **H5 · Perf (opcional):** `auth.uid()`→`(select auth.uid())` nas RLS + índices nas FKs + limpar policies duplicadas.
- _Pronto quando:_ chave nova ativa, schema reproduzível, sessão criptografada, advisors de segurança zerados.

### FASE I — Testes
- **I1 ·** Jest + testes de `calcTotals`, mappers, `deriveStage`, numeração de fatura, `escapeHtml`, % de depósito.
- **I2 ·** Smoke dos fluxos críticos.
- _Pronto quando:_ `jest` configurado, testes passam, `tsc` limpo.

### FASE J — Publicar (despriorizado)
- **J1 ·** Build EAS herdando bundle id / EAS projectId / `ascAppId 6761633213` / version+buildNumber.
- **J2 ·** Submit Apple (contas do dono) + staged rollout.
- **J3 ·** Remover legado: `App.legacy.tsx`, `src/` antigo, `src/services/openaiService.ts`, `test-openai.ts`.

---

## 4. Dependências do usuário
1. **Chave OpenAI nova** — só para a Fase H (rotacionar). Usa a atual até lá. ✅ decidido.
2. **Cobertura:** todos os 50 estados → template US genérico. ✅ decidido.
3. **Depósito:** definido pelo usuário, sem padrão. ✅ decidido.
4. **Idioma:** EN agora; ES/PT depois. ✅ decidido.
5. No fim: **acessos Apple** para build/submit (Fase J).

## 5. Ordem recomendada
**A → B → C → D → E → F → G → H → I → J.** Começar por **A + B** (rápidas, deixam o app confiável). C e D entregam o valor que falta. G (i18n) vem depois das telas estáveis. H/I antes de publicar (J).

*Plano vivo — marco o progresso conforme entrego.*
