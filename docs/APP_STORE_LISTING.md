# App Store — ficha da loja (DRAFT Onda D · 12/07/2026)

Rascunho para a submissão. Itens marcados 🔶 dependem do dono (assets do designer amigo /
decisões finais). URLs públicas já NO AR (exigidas pela review).

## Identidade
- **Nome**: PhotoQuote AI (30 chars max ✓)
- **Subtítulo** (30 chars): `Photo to quote, in minutes` (26 ✓)
- **Bundle/ASC**: app existente id 6761633213 (TestFlight ativo)
- 🔶 Ícone 1024×1024 (designer)
- 🔶 Screenshots 6.7" + 6.1" (mín 3; sugerido 6: Home, câmera→IA, quote PDF, contrato assinado, progresso/fases, equipe)

## URLs (obrigatórias)
- **Privacy Policy**: https://photoquote-client-portal.vercel.app/privacy ✅ no ar
- **Terms (EULA custom)**: https://photoquote-client-portal.vercel.app/terms ✅ no ar
- Support URL: 🔶 (pode ser mailto/landing simples; sugestão support@photoquoteai.com — confirmar domínio/e-mail com o dono)

## Descrição (draft EN)
> Turn job photos into professional quotes in minutes. PhotoQuote AI looks at your photos,
> drafts the line items, and you fine-tune and send — quote, contract with e-signature,
> invoice and receipts, all from your phone.
>
> • AI estimates from photos — realistic US pricing you control
> • Professional PDFs: quotes, invoices, receipts — always in English for your client
> • Contracts with legally binding e-signature (ESIGN/UETA)
> • Client portal: progress photos, phases and comments via a simple link
> • Team mode: field workers see their jobs, update progress — you control who sees prices
> • Works in English, Spanish and Portuguese for YOU; documents always go out in English
>
> Built for solo contractors and small crews: flooring, painting, remodeling, roofing and more.
> 14-day free trial. Solo $39/mo · Team $99/mo (3 seats included).

## Keywords (100 chars)
`contractor,estimate,quote,invoice,construction,remodel,painting,flooring,bid,proposal,esign`

## Privacy Nutrition Labels (App Privacy no ASC)
| Dado | Coleta? | Vinculado? | Tracking? | Uso |
|---|---|---|---|---|
| Email | Sim | Sim | Não | conta/login |
| Nome/empresa | Sim | Sim | Não | documentos |
| Fotos | Sim | Sim | Não | app functionality (orçamento/progresso) |
| Localização (coarse via GPS→endereço, foreground only) | Sim | Sim | Não | pré-preencher endereço da obra |
| Áudio (ditado) | Sim | Não (descartado pós-transcrição) | Não | app functionality |
| Dados de clientes do usuário | Sim | Sim | Não | documentos/portal |
| Identificadores/analytics | **Não** | — | — | sem ads, sem tracking |

## In-App Purchases (quando a build de billing entrar)
- 🔶 Criar no ASC: `solo_monthly` $39.99? (confirmar $39 vs .99), `solo_yearly` $348, `team_monthly` $99, `team_yearly` $948 (+seat via RevenueCat quando houver)
- RevenueCat: 🔶 conta a criar; entitlements `solo`/`team` espelhados em users.subscription_*
- App SEM billing ativo passa review? SIM enquanto o app não vender nada dentro (trial aberto);
  a tela Plans atual é catálogo informativo com stub — **remover o stub OU ativar IAP real antes
  da submissão à LOJA** (TestFlight ok; review da App Store pode implicar com botão "Choose plan"
  que não compra — decisão na onda da build).

## Review notes (campo "Notes" da submissão)
- Conta demo para o reviewer: 🔶 criar user demo com dados fake + credenciais no campo notes.
- Delete account: Profile → Delete account (exigência 5.1.1(v) ✅ implementada).
- O app usa câmera/galeria/microfone/localização — todos com propósito claro nos purpose strings
  (conferir Info.plist strings na build final).
