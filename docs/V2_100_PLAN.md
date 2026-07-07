# V2_100_PLAN — Plano pro app ficar 100% (diagnóstico completo de 04/07/2026)

> Pedido do dono (áudio 04/07): "o projeto tá com muitos erros — bugs de teclado (o conteúdo sobe por cima),
> telas lentas, sessões que não morrem (sai, volta e uma coisa empilha na outra). Analisar CADA coisinha,
> montar um plano completo, nada pode escapar: fazer, revisar, fazer de novo e ir."
>
> Diagnóstico feito com 3 varreduras paralelas do código (`src/v2/` inteiro + infra + caça-bugs de UX),
> teste AO VIVO do backend (login + Edge Function + OpenAI) e inspeção do banco de produção.
> Complementa o `V2_FINISH_PLAN.md` (16/06): fases A–G entregues, H adiada, I parcial, J travada no build.

## Estado em 04/07/2026

- **Código:** `tsc` limpo, `jest` 15/15. 39 commits na `v2-redesign` **sem push** (sem backup no GitHub). 3 arquivos
  com polimento de UI **não commitado** (câmera fullbleed + teclado iOS na CameraScreen, TabBar com inset real,
  waveform animada) — trabalho completo e coeso, pronto pra commitar.
- **Backend vivo:** cadeia da IA SAUDÁVEL (testei com login real: JWT ✓, função ✓, chave OpenAI ✓ — a nova, pós-revogação).
  Banco: 61 projetos, 53 orçamentos, 8 faturas, 2 contratos (0 assinados), 34 fases, 2 usuários; último uso 24/06.
- **Distribuição:** TestFlight parado no build 23 (18/06, minify off, dono não confirmou o resultado).
  App usável hoje só pelo túnel da VPS (cloudflared 8082, tmux `pquote`, vivo desde 02/07).

---

## 🔴 Críticos — o que o dono SENTE (com causa-raiz)

| # | Bug | Causa | Onde |
|---|-----|-------|------|
| C1 | Teclado cobre input/botão ao digitar | `Sheet` é `Modal` SEM KeyboardAvoidingView | `ui.tsx:463-485`; atinge comentários `Job.tsx:794`, nova fase `Job.tsx:773` (autoFocus!), editor de item `Flow.tsx:690` |
| C2 | Idem em formulários | ScrollView + actionbar fixo sem KAV | ClientEdit `Misc.tsx:250` (Notes multiline), Company `Misc.tsx:337`, ChangePassword `Misc.tsx:383`, Attach `Flow.tsx:854`, Login `Auth.tsx:149` (View puro, nem rola) |
| C3 | Teclado no Android | `edgeToEdgeEnabled:true` sem `android.softwareKeyboardLayoutMode`; KAV novo da Camera é iOS-only (`behavior:undefined` no Android) | `app.json:29`, `Flow.tsx:207` |
| C4 | "Edit" do orçamento mostra itens errados | QuoteTab manda pra EstimateScreen, que lê `store.items` (estado do ÚLTIMO fluxo de captura), não os itens do job; edição não volta pro job | `Job.tsx:398` → `Flow.tsx:457` |
| C5 | "Uma sessão em cima da outra" | Depois de salvar, `go('job')` EMPILHA sobre `[home,camera,estimate,attach]`; o back re-atravessa o fluxo morto; store só reseta no próximo `go('camera')` | `Flow.tsx:771`, `Navigator.tsx:97-105` |
| C6 | IA "não atualiza" com fotos novas | Guard `fresh && items.length===0`: voltar pra câmera, trocar fotos e gerar de novo NÃO re-roda a IA (mostra orçamento velho) | `Flow.tsx:467` |
| C7 | Log de diagnóstico da IA NUNCA gravou | `ai_jobs`: `service_role` sem GRANT **INSERT** → insert da Edge Function falha silencioso (catch engole). Provado ao vivo: chamada com erro não gerou linha; tabela vazia desde 17/06. Mesma classe do bug do GRANT do `app_config` | migration `create_ai_jobs` + `ai-estimate/index.ts:44-51` |

## 🟠 Lentidão (candidatos concretos)

| # | Problema | Onde |
|---|----------|------|
| L1 | `StoreCtx.Provider value={{store,up}}` recriado a cada render; TextInputs escrevem no store global → a TELA INTEIRA re-renderiza POR TECLA (CEP, descrição, buscas jobQ/clientQ/aQ, editor de item; re-renderiza até o wrapper da CameraView) | `Navigator.tsx:94,112`; inputs `Flow.tsx:255,373,786`, `Tabs.tsx:247,307`, `Flow.tsx:518` |
| L2 | Jobs/Clients: ScrollView+`.map()` sem virtualização + LinearGradient por card | `Tabs.tsx:260-271, 309-330` |
| L3 | Miniaturas com imagem full-res (strip 56×56 usa foto da câmera inteira; 1280px decodificado pra 96/64) e sem `resizeMethod` | `Flow.tsx:212`, `Job.tsx:393,753` |
| L4 | `console.log [BOOT]` residual em produção | `index.ts`, `src/v2/App.tsx`, `Navigator.tsx:126` |
| L5 | Bundle SEM minificação (workaround build 23) → JS maior pra baixar/parsear | `metro.config.js:12-17` |

## 🟡 Funcionais médios

- M1 "Novo orçamento" na ficha do cliente NÃO vincula o cliente (`Misc.tsx:163`; `go('camera')` reseta `aSel`).
- M2 Call/Text/Email na ficha do cliente não fazem nada (`Misc.tsx:133-138`) → `Linking` tel:/sms:/mailto:.
- M3 Dead-UI: sino Home (`Tabs.tsx:169`), filtro Jobs (`Tabs.tsx:244`), share Estimate (`Flow.tsx:527`), more Job (`Job.tsx:301`), linha Team (`Tabs.tsx:368`), toggle Notifications não persiste (`Tabs.tsx:401`).
- M4 JobCard usa gradiente placeholder em vez da miniatura real (`Tabs.tsx:118-121`; `photo_urls` existe).
- M5 Datas em `en-US` fixo; vencimento Net 15 chumbado (`Job.tsx:437`); sem coluna `due_date`/payment terms.
- M6 OnboardScreen órfã e mock (`Auth.tsx:253-288`); waveform da gravação é cosmética (não reflete o mic) — ok se assumido.
- M7 `transcribe-audio` não loga NADA (sem rastro de erro da voz).
- M8 Editar nome/nota de fase da obra ainda não existe (falta menor da Fase D).

## 🔒 Segurança / reprodutibilidade (Fase H, adiada pelo dono — pré-lançamento)

- S1 Chave OpenAI ATIVA em `app_config` é a chave já COMPROMETIDA (dono decidiu usar por ora). Rotacionar →
  **Supabase secret** (`Deno.env`) + functions lerem do env (hoje leem do banco: `ai-estimate:62`, `transcribe:33`) + redeploy.
- S2 Schema BASE do banco não versionado (só 12 migrations incrementais; nenhuma cria clients/projects/estimates/invoices/
  agreements/app_config…). Exportar schema → migration inicial.
- S3 `supabase/config.toml` inexistente → `verify_jwt` não versionado (está ON na plataforma — confirmado via API).
- S4 Sessão em AsyncStorage (`src/services/supabase.ts:14`) → SecureStore. Leaked-password protection OFF (dashboard).
- S5 Grants largados: `anon` com SELECT/TRUNCATE table-level em `ai_jobs`/`app_config` (RLS segura a leitura, mas é sujeira). Revisar grants dessas tabelas junto do C7.
- S6 Higiene: chave OpenAI velha/revogada ainda no `.env` (local+VPS) e env EAS; chave Groq morta no `.env`; `test-openai.ts` na raiz.
- S7 Repo: 39 commits sem push (backup!); `jest-expo`/`@expo/ngrok`/`@ngrok/ngrok`/`dotenv` em `dependencies` (→ devDeps).

## 📦 Build/loja (Fase J, travada)

- Saga: 18 crash (expo-updates) → 19/20 tela branca → 21 branco (updates removido) → 22 exceção JS (New Arch off) →
  **23 minify off (18/06) — dono nunca confirmou se abriu.**
- Se o 23 abrir: achar o offender da minificação (bisect: `compress` on/`mangle` off → `mangle` on/`keep_fnames` → por lib)
  e religar minify. Se não abrir: investigar Old Arch/módulo nativo com crash log novo.
- No build limpo: remover logs `[BOOT]` e loading "Starting/Connecting" (manter ErrorBoundary+timeouts).

---

# O PLANO (ordem de execução)

> Regra de cada fase: fazer → revisão adversarial → testar no túnel (device real) → commit + changelog (Regra #0).
> Migrations/produção: testar e pedir OK antes de aplicar.

**F1 — TECLADO 100% (C1+C2+C3)** — 1 mexida central + varredura
1. `Sheet` (ui.tsx) ganha KAV interno (behavior por plataforma) → conserta comentários, nova fase e editor de item DE UMA VEZ.
2. Wrapper KAV nos forms: ClientEdit, Company, ChangePassword, Attach, Login/Forgot (Login também vira ScrollView).
3. Android: `android.softwareKeyboardLayoutMode:'resize'` no app.json + behavior no KAV da Camera.
4. Testar TODAS as telas com input, iPhone (túnel). Critério: nenhum campo/botão coberto pelo teclado.

**F2 — NAVEGAÇÃO/ESTADO 100% (C4+C5+C6)**
1. Pós-save: `setStack([home, job])` (reset) + limpar store do fluxo (novo helper `resetFlow`).
2. QuoteTab "Edit": hidratar `store.items` do job (e salvar de volta no job) OU editor dedicado por params.
3. Re-rodar IA quando o conjunto de fotos mudar (hash/len das fotos no guard) mantendo o "não re-roda ao voltar de attach".
4. Extra: `go('camera')` também resetar `editing`/`sheet`. Critério: entrar-sair-voltar em qualquer ponto sem estado fantasma.

**F3 — VELOCIDADE (L1..L4)**
1. `useCallback(up)` + `useMemo(value)`; inputs de busca/descrição com estado LOCAL + commit no blur/submit (padrão que o Misc já usa).
2. FlatList em Jobs/Clients.
3. Miniatura: strip usa a própria uri com `resizeMethod:'resize'`; JobCard usa `photo_urls[0]` (M4 junto).
4. Remover `[BOOT]` logs. Critério: digitação fluida no device; listas com 50+ itens sem engasgo.

**F4 — IA OBSERVÁVEL (C7+M7)** *(toca produção — pedir OK)*
1. Migration: `GRANT INSERT ON ai_jobs TO service_role;` (+ revisar S5 na mesma migration).
2. Teste ao vivo: forçar 1 erro e 1 sucesso → 2 linhas na tabela.
3. `transcribe-audio` v2: logar em `ai_jobs` (kind='transcribe').
4. App: mensagem de erro da IA acionável (mostrar `error` real, não genérico).

**F5 — ACABAMENTO FUNCIONAL (M1..M8)**
- Vincular cliente no fluxo vindo da ficha (M1); Linking em Call/Text/Email (M2); implementar-ou-REMOVER cada dead-UI (M3);
  editar fase (M8); datas com locale do idioma (parte da pendência G); Onboard: remover ou ligar de verdade (M6).

**F6 — BUILD DE RELEASE (J)** — pré-requisito: resposta do dono sobre o build 23
- 23 abriu? → bisect da minificação → religar minify → build 24 limpo (sem [BOOT]) → roteiro TestFlight completo
  (login/foto/IA/voz/fatura/contrato/portal/fases/i18n). 23 não abriu? → crash log novo e investigar nativo.

**F7 — SEGURANÇA PRÉ-LANÇAMENTO (S1..S7 = Fase H)** *(produção — pedir OK)*
- Rotacionar chave → secret/Deno.env + redeploy functions; schema base versionado; config.toml; SecureStore;
  leaked-password ON; grants limpos; .env/EAS sem chave velha; push da branch como backup (decisão do dono).

**F8 — TESTES (I)**
- api.ts: numeração de fatura, deriveStage do banco, depósito único fatura/contrato; calcTotals vs trigger; deps → devDeps.

**F9 — FAXINA (J3)**
- Remover v1 dormente (App.legacy, src/screens|context|navigation antigos, openaiService, database.ts), mocks do data.ts,
  test-openai.ts, .md antigos da raiz, dist/. Critério: repo só com o que roda.

## Perguntas abertas pro dono
1. **Build 23** (minify off): você chegou a instalar/testar no TestFlight? Abriu ou continuou branco?
2. Posso **commitar** o polimento pendente + este plano, e **pushar** a branch (backup dos 39 commits)?
3. **GO** pra executar na ordem F1→F2→F3 (o que você sente no dia a dia) e depois F4→F6?

---
---

# ADENDO 07/07/2026 — diagnóstico de lançamento (3 agentes: Android/lançamento · fluxo/leigo · faturas)

> Status das fases originais: F1–F5(núcleo) ENTREGUES em 04/07 (commits 8e966c5, 2c33223, b9b0695).
> Este adendo adiciona o que os 3 novos diagnósticos encontraram. Portal tem plano próprio:
> `photoquote-client-portal/docs/PORTAL_100_PLAN.md`.

## F10 — ANDROID-READY (o app NUNCA rodou em Android; 2 blockers CERTOS)
- **B1 BLOCKER**: botão/gesto VOLTAR do Android SAI DO APP em qualquer tela — o stack caseiro não tem `BackHandler`
  (grep: zero ocorrências). Fix: handler no `AppFlow`/`AuthFlow` — `back()` quando `stack.length>1`, default no root.
  (O `Sheet` já fecha certo via `onRequestClose`.)
- **B2 BLOCKER**: `app.json` NÃO tem `android.package` → `eas build -p android` nem gera. Fix: `com.photoquoteai.app`.
- **B3 MÉDIO (atinge ES/PT!)**: `DecimalInput` (ui.tsx:333) remove a VÍRGULA → "6,50" vira "650" no teclado decimal
  de locale es/pt. Idem parseFloat no CompanyScreen. Fix: normalizar `,`→`.`.
- **Provar em device Android** (1º build): câmera (orientação EXIF retrato/paisagem — o pipeline shrink/manipulate
  provavelmente normaliza, confirmar; preview FILL_CENTER corta ≠ estica; resume do background), teclado
  `behavior="padding"` em TODOS os forms e DENTRO dos Sheets (KAV em Modal é instável no Android), gravação de voz
  (m4a/base64) e picker múltiplo.
- Menores: sem cap de duração da gravação (por o ~120s), frontal espelhada sem prop `mirror`, sem flash/torch,
  `statusBarTranslucent` ausente nos Modals, autofill/`returnKeyType`/`textContentType` ausentes no Auth,
  `shadow.btn` verde vira sombra cinza (elevation), botão X da câmera `top:50` fixo.

## F11 — NÚMEROS HONESTOS + FLUXO DO MUNDO REAL (agente "usuário leigo")
- **P0 MARGEM VAZA**: o markup "hidden from client" NÃO fecha a conta nos documentos — `total = subtotal+tax+margin`
  mas os itens/subtotal não incluem a margem → PDF, fatura E CONTRATO ASSINADO mostram "Subtotal + Tax ≠ Total"
  (template US imprime os três: migrations/20260617021500:40-41; send.ts:72-76; Job.tsx:522-528).
  **Fix recomendado: embutir a margem nos preços unitários** quando marginRate>0 (subtotal já a contém; documento
  reconcilia; margem some de verdade) + linha interna "Markup (X%)" só nas telas do empreiteiro.
- **P1**: sem saída pra negócio que NÃO fecha — nenhum lost/cancel/archive/delete; pipeline infla pra sempre
  (Job.tsx NEXT só avança). Fix: menu "…" no Job com Mark as lost / Cancel / Delete + status fora do pipeline.
- **P1**: aprovação por telefone exige fingir envio (Quoted só tem "Send"); dar "Mark approved" secundário.
- **P1**: 3 nomes pra mesma coisa (Quote/Estimate/Job) — unificar em "Quote/Orçamento" na UI.
- **P1**: idioma não detecta o device e Login é só EN — `expo-localization` + seletor no Login.
- **P1**: 1º envio pode sair como "Your company" (perfil vazio) — avisar/bloquear antes do 1º envio.
- **P1**: topo do Job usa `job.value` da lista e fica DESATUALIZADO após Edit (Job.tsx:211) — preferir
  `quoteTotals.total` quando `detail` carregou. (Interage com o Edit da F2!)
- **P2**: "Sent" marcado ao TOCAR na opção (mesmo cancelando o email); "Net 15"/"ACH" jargão → "vence em 15 dias";
  confidence "87%" sem rótulo; contrato exige fatura antes (mundo real assina antes de faturar); Skip→"Save without
  client"; PDF sai sempre em EN mesmo com app em ES/PT (send.ts hardcoded); Onboard morta (ligar pós-signup ou remover).
- **Elogiado (não mexer)**: card NEXT STEP, timeline 6 passos, empty states, deriveStage única testada, starter
  estimate, foto+voz+CEP num passo.

## F12 — PAGAMENTO FLEXÍVEL (pedido do dono: entrada livre/zero, parcelas por fase ou mês, editável)
**Hoje**: fatura copia totais do estimate; `deposit_percent int` congelado do perfil (sem UI pra editar, sem $ absoluto);
vencimento Net-15 CHUMBADO na UI (não existe `due_date`); status binário Unpaid→Paid (sem parcial, sem paid_at/amount_paid);
PDF pobre (sem vencimento/depósito/saldo/instruções/logo — send.ts:28-79); **BUG: InvoiceTab mostra itens AO VIVO do
estimate com totais CONGELADOS da fatura** (Job.tsx:201 vs 208-210) — editar orçamento (F2!) dessincroniza linhas×total.
**Proposta (aditiva)**: `invoices.payment_mode('full'|'deposit'|'installments') + due_date date + deposit_amount` +
tabelas `invoice_schedule` (label, amount, due_date OU phase_id, sort) e `invoice_payments` (ledger: amount, paid_at,
method, schedule_id?) → saldo = total − Σpagamentos. UI leigo-proof: 3 cartões na geração (Tudo no final / Entrada+resto
com toggle %↔$ aceitando 0 / Parcelas com "dividir em N" e indicador "falta alocar $Z"), reeditável, botão "Registrar
pagamento". PDF ganha Payment Schedule + Paid/Balance + instruções; contrato ganha `{{payment_schedule_table}}`;
portal ganha `get_invoice_by_token` + página da fatura. Riscos: travar fatura OU "ressincronizar do orçamento";
parcela = porção do TOTAL (imposto incluso, não re-tributar); `due_date` como date puro (timezone); centavos na última.
Esforço: schema P/M · api M · UI app G · PDF P/M · contrato M · portal M/G.

## Ordem sugerida (07/07)
1. **Rápido e certo**: F10 B1+B2+B3 (Android blockers, code-only) + F11 P0 margem (decisão do dono: embutir nos itens).
2. **F12 MVP** (o poder das faturas que o dono pediu): schema + 3 modos + registrar pagamento + PDF.
3. F11 P1s (lost/cancel, aprovação direta, idioma auto, guard "Your company", topo do job).
4. Portal P0/P1 (plano próprio) em paralelo; F6 TestFlight quando o dono responder do build 23.
