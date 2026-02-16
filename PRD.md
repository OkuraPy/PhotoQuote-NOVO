# PhotoQuote AI - Product Requirements Document (PRD)
## MVP Version 1.0

---

## 1. PRODUCT OVERVIEW

**Product Name:** PhotoQuote AI
**Platform:** iOS & Android (React Native)
**Target Market:** Florida, United States
**Primary Users:** Contractors, handymen, home improvement companies
**Currency:** USD ($)
**Language:** English only

### Vision
PhotoQuote AI empowers contractors and service professionals in Florida to generate accurate, professional estimates in minutes by combining AI-powered photo analysis with local market pricing data. The app eliminates guesswork, reduces estimation time from hours to minutes, and ensures pricing consistency aligned to Florida's regional market rates.

### Problem Statement
Contractors waste 2-5 hours per estimate manually measuring, calculating quantities, researching prices, and formatting professional quotes. Pricing inconsistency leads to lost bids (too high) or unprofitable jobs (too low). No existing solution combines photo analysis with local Florida market pricing in a mobile-first workflow.

### Solution
A mobile app that:
1. Captures jobsite photos and project context
2. Uses AI to identify scope and estimate quantities
3. Applies local Florida pricing data (never invented prices)
4. Generates professional, itemized estimates in minutes
5. Exports polished PDFs ready to send to clients

---

## 2. SUCCESS METRICS (MVP)

- **Primary:** 100 active Florida contractors in first 3 months
- **Usage:** Average 5 estimates generated per user per week
- **Quality:** 80% of AI-generated estimates require ≤3 manual edits
- **Conversion:** 60% of generated estimates exported as PDF
- **Pricing Accuracy:** 90% of users rate pricing "accurate for my region"

---

## 3. CORE FUNCTIONALITY (MVP)

### 3.1 Authentication & Setup
- Email/password + Google/Apple sign-in
- Company profile setup: name, logo, contact info, default Florida location
- Default settings: labor rate ($/hr), margin %, tax %, PDF terms template

### 3.2 Client Management (CRM-lite)
- Create/edit clients: name, phone, email, address, notes
- View client history (past projects and estimates)

### 3.3 Project Creation
**Required fields:**
- Project name, client selection
- Property address (street, city, state=FL, ZIP, county)
- Property type: Residential / Commercial / Condo
- Access level: Easy / Medium / Hard
- Floor level: Ground / Floor 1–50
- Elevator: Yes / No
- Parking: Easy / Paid / Hard

**Optional fields:**
- Job notes, desired start date, deadline

### 3.4 Media Upload & Tagging
- Upload 5–30 photos + 1 optional short video
- Tag photos: kitchen, bathroom, flooring, walls, stairs, exterior, etc.
- Optional manual measurements (sqft, linear feet, units)

### 3.5 AI Estimate Generation (CORE)
**Input:**
- Project details (location, access, floor, elevator, parking)
- Service type: flooring, painting, drywall, baseboards, demo, cleanup, etc.
- Photos + optional measurements + notes

**AI Process:**
- Analyzes photos to identify scope of work
- Proposes line-item breakdown (prep, removal, installation, finishing, cleanup)
- Estimates quantities (if measurements missing, shows confidence level)
- **MUST** pull pricing from Local Price Table for project ZIP/county
- Applies adjustment multipliers:
  - Medium access: +5–10%, Hard access: +10–20%
  - High floor without elevator: +10–30%
  - Parking paid/hard: +$100–300 or +5%

**Output:**
- Itemized line items: category, description, unit, quantity, unit price, subtotal
- Material suggestions
- Labor hours estimate
- Totals: subtotal → tax → margin → grand total (USD)
- Notes: exclusions, assumptions, validity (30 days), estimated timeline

**Safety Rule:** If measurements missing or confidence <70%, app prompts user for clarification before finalizing totals.

### 3.6 Estimate Editor
- Fully editable: line items, quantities, prices, descriptions
- Version control (v1, v2, v3)
- Recalculate button (applies margin/tax rules)
- Optional: separate "Client Version" and "Contractor Version" (different margins)

### 3.7 PDF Export & Sharing
**PDF includes:**
- Company logo + contact info
- Client name + project address
- Itemized estimate table (all line items + totals)
- Terms: validity period, payment schedule, exclusions, assumptions

**Share options:**
- Email, WhatsApp, save to device

### 3.8 Local Price Table (CRITICAL)
- Built-in editable pricing database per Florida region (ZIP or County)
- Structure: service category, unit (sqft/lf/each/hour), low/avg/high rates
- If user's region has no pricing:
  - Guide user to create custom table
  - Offer nearby template (e.g., "Broward County pricing")
- **AI cannot generate final pricing without this table**

---

## 4. USER FLOW (HAPPY PATH)

1. **Onboarding:** Sign up → set company info → select default Florida region → set default labor rate/margin
2. **Create Client:** Add client contact info
3. **New Project:** Enter project name, address, property details (access, floor, parking)
4. **Upload Media:** Take/upload 10 photos of bathroom, tag as "bathroom/flooring/walls"
5. **Select Service:** Choose "Bathroom Remodel - Flooring"
6. **AI Generate:** App analyzes photos → proposes 8 line items (prep, removal, subfloor repair, tile install, grout, sealant, cleanup, haul-away) → asks "We estimate 75 sqft, confirm?" → user confirms
7. **Review Estimate:** $3,250 total shown with itemized breakdown
8. **Edit (optional):** User adjusts 2 line items, adds custom note
9. **Export PDF:** Generate professional PDF → send via email to client
10. **Done:** Estimate saved in project history

---

## 5. NON-FUNCTIONAL REQUIREMENTS

### Performance
- Photo upload: max 30 seconds for 10 photos (5MB each)
- AI estimate generation: <60 seconds
- PDF generation: <10 seconds
- App launch: <3 seconds

### Reliability
- 99.5% uptime for backend services
- Offline mode: browse past estimates, edit drafts (sync when online)

### Security
- All user data encrypted at rest and in transit (TLS 1.3)
- Photo storage: secure cloud (Supabase Storage or Firebase)
- Authentication: OAuth 2.0 + JWT tokens

### Usability
- Onboarding completion: <5 minutes
- New estimate creation: <10 minutes (including photo upload)
- Mobile-first design, optimized for one-handed use

### Localization (MVP scope)
- English only (UI, PDFs, all text)
- USD currency formatting: $1,000.00 (comma thousands, dot decimal)

---

## 6. OUT OF SCOPE (MVP)

- Multi-language support (future: Spanish)
- Multi-currency (future: other US regions)
- Team collaboration / multi-user accounts
- Payment processing / invoicing
- Scheduling / calendar integration
- CRM features beyond basic client list
- Integration with QuickBooks, Stripe, etc.
- Advanced analytics / reporting dashboard

---

## 7. TECHNICAL CONSTRAINTS

- **Frontend:** React Native + Expo (TypeScript), supports iOS 14+ and Android 10+
- **Backend:** Supabase (Postgres, Auth, Storage) or Firebase
- **AI:** LLM API (GPT-4 Vision or similar) + pricing rules engine
- **PDF:** React Native PDF library or server-side generation
- **Photo storage:** Max 30 photos × 5MB = 150MB per project

---

## 8. ASSUMPTIONS & DEPENDENCIES

### Assumptions
- Users have smartphones with camera (iOS/Android)
- Users willing to manually confirm measurements when AI confidence <70%
- Florida contractors recognize value of fast, accurate estimates
- Users will maintain their Local Price Tables (update quarterly)

### Dependencies
- Access to LLM vision API (OpenAI, Anthropic, or open-source)
- Reliable cloud backend (Supabase or Firebase)
- Florida regional pricing data (user-supplied or via partnerships)

---

## 9. RISKS & MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| AI hallucinates prices | High | Hard requirement: AI must ONLY use Local Price Table. No fallback to guessed prices. |
| Low photo quality → bad quantity estimates | Medium | Show confidence level; prompt user to confirm or provide manual measurements. |
| Users don't maintain Price Tables → bad estimates | High | Onboarding checklist requires Price Table setup. Quarterly reminders to update. |
| Slow AI response (>2 minutes) | Medium | Optimize prompts, use streaming responses, show progress bar. |
| Privacy concerns (client photos) | Medium | Clear privacy policy, allow users to delete photos after estimate generated. |

---

## 10. RELEASE CRITERIA (MVP Launch)

- [ ] All 8 core features implemented and tested
- [ ] Onboarding flow tested with 10 beta users (avg <5 min completion)
- [ ] AI generates estimates in <60 seconds for 80% of test projects
- [ ] PDF exports correctly on iOS and Android
- [ ] Local Price Table system functional for 3 Florida counties
- [ ] App passes iOS App Store and Google Play Store review guidelines
- [ ] Privacy policy and terms of service published
- [ ] Support email/chat functional

---

## 11. GO-TO-MARKET STRATEGY (MVP)

**Target Launch Date:** 90 days from kickoff

**Beta Phase (30 days):**
- Recruit 20 Florida contractors (Miami-Dade, Broward, Palm Beach)
- Collect feedback on AI accuracy and UI/UX
- Iterate on Price Table templates

**Launch Phase:**
- Submit to App Store and Google Play
- Launch website with demo video
- Social media campaign targeting Florida contractor groups
- Partnerships with 2–3 Florida contractor associations

**Pricing (MVP):**
- Free tier: 5 estimates/month
- Pro tier: $29/month unlimited estimates
- 14-day free trial, no credit card required

---

## APPROVAL & SIGN-OFF

**Product Owner:** _______________
**Engineering Lead:** _______________
**Design Lead:** _______________
**Date:** _______________

---

*End of PRD - PhotoQuote AI MVP v1.0*
