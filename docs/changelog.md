# Changelog — PhotoQuote-NOVO

Registro por commit (Regra #0). Mais recente no topo.

---

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
