# Changelog — PhotoQuote-NOVO

Registro por commit (Regra #0). Mais recente no topo.

---

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
