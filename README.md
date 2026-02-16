# PhotoQuote AI - Complete Project Documentation

> **AI-Powered Estimation App for Florida Contractors**
> Generate professional estimates in minutes using site photos + local market pricing

---

## 📋 PROJECT OVERVIEW

**PhotoQuote AI** is a mobile application (iOS/Android) that enables contractors, handymen, and home improvement companies in Florida to create accurate, professional estimates by uploading jobsite photos. The app uses AI to analyze photos, estimate quantities, and generate itemized quotes using local Florida market pricing data.

**Key Differentiator:** Unlike competitors, PhotoQuote AI NEVER invents prices. It uses a mandatory Local Price Table system to ensure estimates are aligned with regional market rates.

---

## 🎯 TARGET USERS

- **Primary:** Florida-based contractors (flooring, painting, drywall, remodeling, handyman services)
- **Secondary:** Home improvement companies, property managers, insurance estimators
- **Geography:** Florida, USA (initial launch)
- **Language:** English only (MVP)
- **Currency:** USD ($)

---

## 📚 DOCUMENTATION INDEX

This repository contains complete project documentation for PhotoQuote AI MVP (v1.0):

| Document | Description | Key Contents |
|----------|-------------|--------------|
| **[PRD.md](./PRD.md)** | Product Requirements Document | Vision, features, success metrics, constraints, release criteria |
| **[FEATURES.md](./FEATURES.md)** | Complete Feature List | All functional & non-functional requirements, edge cases, technical specs |
| **[DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md)** | Database Schema | Full table definitions, relationships, indexes, RLS policies, sample data |
| **[API_ENDPOINTS.md](./API_ENDPOINTS.md)** | API Documentation | REST endpoints, request/response formats, authentication, error handling |
| **[AI_PROMPTS.md](./AI_PROMPTS.md)** | AI Prompt Templates | System prompts, user prompt templates, JSON schemas, example interactions |
| **[ROADMAP.md](./ROADMAP.md)** | Product Roadmap | MVP → v1.1 → v2.0 timeline, feature progression, pricing evolution |

---

## 🚀 QUICK START

### For Product Managers
1. Read **PRD.md** for overall product vision and scope
2. Review **ROADMAP.md** for timeline and feature prioritization
3. Use **FEATURES.md** as acceptance criteria checklist

### For Designers
1. Review **FEATURES.md** (Section F1-F10) for screen-by-screen requirements
2. Reference **PRD.md** (Section 4: User Flow) for UX flow
3. Check **DATABASE_SCHEMA.md** for data model understanding

### For Backend Engineers
1. Start with **DATABASE_SCHEMA.md** to set up Postgres tables
2. Implement endpoints from **API_ENDPOINTS.md**
3. Review **AI_PROMPTS.md** for AI integration requirements

### For Frontend Engineers
1. Review **FEATURES.md** for UI requirements
2. Use **API_ENDPOINTS.md** for API integration
3. Reference **PRD.md** for screen flows and navigation

### For AI/ML Engineers
1. Study **AI_PROMPTS.md** thoroughly
2. Understand the pricing rules engine (no invented prices!)
3. Implement confidence scoring and error handling

---

## 🏗️ TECHNICAL STACK

### Frontend
- **Framework:** React Native 0.73+ with Expo SDK 50+
- **Language:** TypeScript 5.3+
- **State Management:** Zustand or React Context
- **Navigation:** React Navigation 6+
- **UI Library:** React Native Paper (optional)
- **Form Handling:** React Hook Form + Zod validation

### Backend (Option A: Supabase - Recommended)
- **Database:** PostgreSQL 15+ (Supabase managed)
- **Authentication:** Supabase Auth (email, Google, Apple)
- **Storage:** Supabase Storage (S3-compatible)
- **API:** Supabase auto-generated REST + Realtime
- **Row-Level Security (RLS):** Built-in data isolation

### Backend (Option B: Firebase)
- **Database:** Firestore (NoSQL)
- **Authentication:** Firebase Auth
- **Storage:** Firebase Cloud Storage
- **API:** Cloud Functions (Node.js)

### AI/ML
- **Vision API:** OpenAI GPT-4 Vision or Anthropic Claude 3 (with vision)
- **Pricing Rules:** Custom logic (NOT AI-generated)

### Infrastructure
- **Hosting:** Supabase Cloud or AWS
- **File Storage:** S3 or Supabase Storage
- **CI/CD:** GitHub Actions or GitLab CI
- **Monitoring:** Sentry (errors), Mixpanel (analytics)

---

## 📊 DATA MODELS (SUMMARY)

```
users (1) ──< (many) clients
users (1) ──< (many) projects
users (1) ──< (many) price_tables
clients (1) ──< (many) projects
projects (1) ──< (many) media
projects (1) ──< (many) estimates
estimates (1) ──< (many) line_items
```

**Core Tables:**
- `users` - Company profiles, default settings
- `clients` - Client contact info (CRM-lite)
- `projects` - Project details, property info, site conditions
- `media` - Photos/videos with tags and measurements
- `price_tables` - Regional pricing data (CRITICAL for AI)
- `estimates` - Estimate metadata and totals
- `line_items` - Itemized estimate line items

See [DATABASE_SCHEMA.md](./DATABASE_SCHEMA.md) for full schema.

---

## 🧠 AI WORKFLOW

1. **Input:**
   - Project details (address, ZIP, access, floor, parking)
   - Service type (flooring, painting, etc.)
   - 5-30 photos + optional measurements
   - Local Price Table for project region

2. **AI Processing:**
   - Analyze photos to identify scope
   - Estimate quantities (with confidence scores)
   - Pull unit prices from Local Price Table (NEVER invent!)
   - Generate line items (prep, removal, install, finishing, cleanup)
   - Apply adjustment multipliers (access, floor, parking)

3. **Output:**
   - Structured JSON with line items, totals, notes
   - Confidence scores per line item
   - Missing info prompts (if needed)

4. **User Review:**
   - User edits estimate (add/remove/adjust line items)
   - Recalculate totals
   - Save version, generate PDF, send to client

**Safety Rule:** If measurements are missing or confidence <70%, AI prompts user for confirmation. If pricing data is missing, AI blocks estimate generation and prompts user to create Price Table.

See [AI_PROMPTS.md](./AI_PROMPTS.md) for detailed prompts and examples.

---

## 🎨 KEY USER FLOWS

### Flow 1: New User Onboarding (< 5 minutes)
1. Sign up with email/password or Google/Apple
2. Enter company info (name, phone, logo)
3. Set default Florida location (city, ZIP, county)
4. Set default rates (labor $/hr, margin %, tax %)
5. Create or import Local Price Table
6. Done → Dashboard

### Flow 2: Create Estimate (< 10 minutes)
1. Create or select client
2. Create new project (name, address, property details)
3. Upload 10-20 photos, tag as needed
4. Select service type (e.g., "Flooring")
5. AI generates estimate in <60 seconds
6. Review estimate, edit if needed
7. Generate PDF, send to client via email/WhatsApp
8. Done

### Flow 3: Edit Estimate
1. Open existing estimate
2. Edit line items (qty, price, description)
3. Add/delete line items
4. Update notes, exclusions, payment terms
5. Recalculate totals
6. Save as new version (v2, v3, etc.)
7. Generate updated PDF

---

## 📈 SUCCESS METRICS (MVP - First 3 Months)

| Metric | Target |
|--------|--------|
| Active Users | 100 Florida contractors |
| Estimates Generated | 500 total (5 per user) |
| AI Accuracy | 80% require ≤3 manual edits |
| Conversion Rate | 60% estimate-to-PDF |
| App Rating | 4.5+ stars (iOS + Android) |
| User Retention | 70% month-over-month |
| Estimate Generation Time | <60 seconds (AI) + <10 min (user review) |

---

## 💰 PRICING (MVP)

- **Free Tier:** 5 estimates/month (all features, limited quantity)
- **Pro Tier:** $29/month - unlimited estimates, all features
- **14-day free trial** (no credit card required)

---

## 🛣️ ROADMAP SUMMARY

### **MVP (v1.0) - Months 1-3**
✅ Core features: auth, clients, projects, media, AI estimates, PDF export, price tables

### **v1.1 - Months 4-6**
🔹 Templates, offline mode, team collaboration, analytics, expanded service types

### **v1.2 - Months 7-9**
🔹 Invoicing, scheduling, materials list, expense tracking, Spanish language

### **v2.0 - Months 10-15**
🚀 National expansion (all 50 states), advanced AI, payment processing, integrations (QuickBooks, Stripe), white-label

See [ROADMAP.md](./ROADMAP.md) for full details.

---

## 🔐 SECURITY & COMPLIANCE

- **Authentication:** OAuth 2.0 (Google, Apple) + JWT tokens
- **Encryption:** TLS 1.3 (in transit), AES-256 (at rest)
- **Data Privacy:** GDPR-ready, CCPA-ready
- **Access Control:** Row-level security (RLS) in Postgres
- **Photo Storage:** Private buckets, signed URLs (1-hour expiry)
- **Compliance:** iOS App Store, Google Play policies

---

## 🧪 TESTING STRATEGY

### Unit Tests
- **Target:** 70% code coverage
- **Focus:** Pricing calculations, line item logic, PDF generation

### Integration Tests
- **Target:** All API endpoints
- **Focus:** Auth flows, CRUD operations, AI integration

### E2E Tests
- **Target:** Key user flows
- **Focus:** Onboarding, estimate creation, PDF export

### Manual Testing
- **Beta Phase:** 20 Florida contractors (Miami-Dade, Broward, Palm Beach)
- **Focus:** AI accuracy, UX feedback, pricing validation

---

## 📦 DEPLOYMENT

### Phase 1: Development (Months 1-2)
- Set up Supabase project
- Implement core features
- Internal testing (QA team)

### Phase 2: Beta (Month 3)
- Deploy to TestFlight (iOS) and Google Play Beta
- Recruit 20 beta users
- Collect feedback, iterate

### Phase 3: Launch (End of Month 3)
- Submit to App Store and Google Play
- Public launch (website, social media)
- Monitor metrics, fix bugs

### Phase 4: Iterate (Months 4-6)
- Roll out v1.1 features
- Expand Florida coverage (all 67 counties)
- Optimize AI prompts, improve accuracy

---

## 🤝 STAKEHOLDERS & ROLES

| Role | Responsibilities | Deliverables |
|------|------------------|--------------|
| **Product Manager** | Define features, prioritize roadmap, track metrics | PRD, Roadmap, Sprint planning |
| **UI/UX Designer** | Design screens, user flows, prototypes | Figma designs, style guide |
| **Frontend Devs (2)** | Build React Native app, integrate APIs | Mobile app (iOS + Android) |
| **Backend Dev (1)** | Set up Supabase, implement APIs, database | Backend API, database schema |
| **AI/ML Engineer (1)** | Implement AI prompts, tune model, pricing rules | AI integration, prompt templates |
| **QA Tester (1)** | Write tests, manual testing, bug reports | Test plans, bug reports |

---

## 🔗 EXTERNAL RESOURCES

- **Expo Docs:** https://docs.expo.dev/
- **Supabase Docs:** https://supabase.com/docs
- **React Native Docs:** https://reactnative.dev/docs
- **OpenAI API Docs:** https://platform.openai.com/docs
- **Anthropic API Docs:** https://docs.anthropic.com/

---

## 📝 LICENSE & LEGAL

- **Privacy Policy:** Required before launch (publish on website)
- **Terms of Service:** Required before launch (publish on website)
- **Photo Usage Rights:** Users own their photos; app does not claim rights
- **Pricing Data:** User-supplied or via partnerships; app is not liable for pricing accuracy

---

## 🎯 NEXT STEPS

1. **Week 1-2:** Finalize PRD, get stakeholder approval
2. **Week 3-4:** Design UI/UX (Figma prototypes)
3. **Week 5-8:** Backend setup (Supabase, database, APIs)
4. **Week 9-12:** Frontend development (React Native app)
5. **Week 13:** AI integration and testing
6. **Week 14:** Beta testing with 20 contractors
7. **Week 15:** Bug fixes, polish, submit to app stores
8. **Week 16+:** Public launch, marketing, iterate

---

## 📞 CONTACT & SUPPORT

- **Project Lead:** [Your Name]
- **Email:** [your-email@example.com]
- **GitHub Repo:** [repo-link]
- **Slack Channel:** #photoquote-ai

---

## 🏆 VISION STATEMENT

> "PhotoQuote AI empowers contractors to win more jobs by delivering accurate, professional estimates in minutes—not hours. By combining AI-powered photo analysis with local market pricing, we eliminate guesswork and give contractors the confidence to price competitively while protecting their margins."

---

**Built with ❤️ for Florida contractors**

*Last Updated: February 2024*
*Version: MVP v1.0 Documentation*

---

## 📊 APPENDIX: FEATURE CHECKLIST (MVP)

Use this checklist to track MVP development progress:

- [ ] **F1: Authentication**
  - [ ] F1.1: Email/password sign up/in
  - [ ] F1.2: Google Sign-In
  - [ ] F1.3: Apple Sign-In
  - [ ] F1.4: Password reset
  - [ ] F1.5: Company profile setup (onboarding)

- [ ] **F2: Client Management**
  - [ ] F2.1: Client list (search, filter, sort)
  - [ ] F2.2: Create/edit client
  - [ ] F2.3: Client detail view + history
  - [ ] F2.4: Delete client

- [ ] **F3: Project Management**
  - [ ] F3.1: Create project (all required fields)
  - [ ] F3.2: Project list (filter, search, sort)
  - [ ] F3.3: Project detail view
  - [ ] F3.4: Edit/delete project

- [ ] **F4: Media Upload**
  - [ ] F4.1: Upload photos (5-30, from camera/gallery)
  - [ ] F4.2: Upload video (optional, max 1)
  - [ ] F4.3: Tag photos by category
  - [ ] F4.4: Manual measurements (sqft, lf, units)
  - [ ] F4.5: Photo gallery + full-screen viewer

- [ ] **F5: AI Estimate Generator**
  - [ ] F5.1: Service type selection
  - [ ] F5.2: AI photo analysis
  - [ ] F5.3: Quantity estimation + confidence scores
  - [ ] F5.4: Pricing from Local Price Table (no invented prices!)
  - [ ] F5.5: Line item generation (prep, removal, install, finish, cleanup)
  - [ ] F5.6: Adjustment multipliers (access, floor, parking)
  - [ ] F5.7: Clarification prompts (if low confidence or missing data)

- [ ] **F6: Estimate Editor**
  - [ ] F6.1: View estimate (line items + totals)
  - [ ] F6.2: Edit line items (add, edit, delete, reorder)
  - [ ] F6.3: Edit totals settings (tax %, margin %)
  - [ ] F6.4: Edit notes, exclusions, assumptions, payment terms
  - [ ] F6.5: Recalculate totals
  - [ ] F6.6: Version control (save as v2, v3, etc.)

- [ ] **F7: PDF Export & Sharing**
  - [ ] F7.1: Generate PDF (professional layout)
  - [ ] F7.2: PDF preview in-app
  - [ ] F7.3: Share via email
  - [ ] F7.4: Share via WhatsApp
  - [ ] F7.5: Save to device

- [ ] **F8: Local Price Table**
  - [ ] F8.1: Create price table (by region)
  - [ ] F8.2: Edit price entries (low/avg/high rates)
  - [ ] F8.3: Search/filter price table
  - [ ] F8.4: Import/export CSV
  - [ ] F8.5: Pre-loaded templates (Broward, Miami-Dade, Palm Beach)
  - [ ] F8.6: Pricing safety: block estimate if no price table

- [ ] **F9: Settings**
  - [ ] F9.1: Edit company profile
  - [ ] F9.2: Update default rates (labor, margin, tax)
  - [ ] F9.3: Edit PDF terms template
  - [ ] F9.4: Change password
  - [ ] F9.5: Delete account

- [ ] **F10: Dashboard**
  - [ ] F10.1: Quick stats (projects, estimates, revenue)
  - [ ] F10.2: Recent projects/estimates
  - [ ] F10.3: Quick actions (+ New Project, + New Client)

- [ ] **Non-Functional**
  - [ ] NFR1: Performance (app launch <3s, AI <60s, PDF <10s)
  - [ ] NFR2: Offline mode (browse past data)
  - [ ] NFR3: Security (TLS 1.3, RLS, OAuth)
  - [ ] NFR4: Accessibility (WCAG 2.1 AA)
  - [ ] NFR5: Compatibility (iOS 14+, Android 10+)

---

*End of README - PhotoQuote AI Project Documentation*
