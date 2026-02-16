# PhotoQuote AI - Product Roadmap

---

## ROADMAP OVERVIEW

**Vision:** Become the #1 AI-powered estimation tool for contractors across the United States, starting with Florida.

**Timeline:**
- **MVP (v1.0):** 3 months - Launch in Florida with core features
- **v1.1:** 3-6 months post-MVP - Enhancements & optimization
- **v2.0:** 9-12 months post-MVP - National expansion & advanced features

---

## MVP (v1.0) - FOUNDATION
**Timeline:** Months 1-3
**Goal:** Launch functional app in Florida with core AI estimation capabilities

### Core Features
✅ **Authentication & Onboarding**
- Email/password + Google/Apple sign-in
- Company profile setup (name, logo, defaults)
- Guided onboarding flow (<5 minutes)

✅ **Client Management (CRM-lite)**
- Create/edit clients (name, contact, address)
- View client history (past projects/estimates)
- Search & filter clients

✅ **Project Creation**
- Required fields: name, client, address, property type, access, floor, elevator, parking
- Optional fields: notes, start date, deadline
- Project status tracking (draft, active, completed)

✅ **Media Upload & Tagging**
- Upload 5-30 photos + 1 optional video
- Tag photos by room/area (bathroom, kitchen, flooring, etc.)
- Optional manual measurements (sqft, lf, units)
- Photo gallery with full-screen viewer

✅ **AI Estimate Generator**
- Analyze photos to identify scope
- Estimate quantities (with confidence scores)
- Pull pricing from Local Price Table (NEVER invent prices)
- Generate itemized line items (prep, removal, install, finishing, cleanup)
- Apply adjustment multipliers (access, floor, parking)
- Show missing info prompts (if measurements/pricing unavailable)

✅ **Estimate Editor**
- Fully editable line items (description, qty, price)
- Add/delete/reorder line items
- Edit notes, exclusions, assumptions, payment terms
- Recalculate totals (subtotal → tax → margin → grand total)
- Version control (v1, v2, v3)

✅ **PDF Export & Sharing**
- Generate professional PDF (company logo, itemized table, terms)
- Share via email, WhatsApp, save to device
- PDF preview in-app

✅ **Local Price Table**
- Create/edit price tables by region (ZIP or county)
- Service categories (flooring, painting, drywall, etc.)
- Unit pricing (low/avg/high rates per sqft, lf, each, hour)
- Import/export CSV
- Pre-loaded templates for Broward, Miami-Dade, Palm Beach counties

✅ **Settings**
- Edit company profile
- Update default rates (labor, margin, tax)
- Edit PDF terms template
- Account management (change password, delete account)

### Technical Stack (MVP)
- **Frontend:** React Native + Expo (TypeScript)
- **Backend:** Supabase (Postgres, Auth, Storage)
- **AI:** GPT-4 Vision or Claude 3 Opus (vision)
- **PDF:** react-native-html-to-pdf or server-side generation
- **Platforms:** iOS 14+ and Android 10+

### Success Metrics (MVP - First 3 Months)
- 100 active Florida contractors
- 500 estimates generated
- 80% of estimates require ≤3 manual edits
- 4.5+ star average rating on App Store/Google Play
- 60% estimate-to-PDF conversion rate

### Launch Strategy
1. **Beta (Month 3):** 20 contractors in Miami-Dade, Broward, Palm Beach
2. **Soft Launch (End of Month 3):** Submit to App Store & Google Play
3. **Public Launch (Month 4):** Social media campaign, contractor associations

---

## v1.1 - ENHANCEMENT & OPTIMIZATION
**Timeline:** Months 4-6 (3 months post-MVP)
**Goal:** Improve user experience, add productivity features, expand Florida coverage

### New Features

🔹 **Estimate Templates**
- Save common estimates as reusable templates
- Pre-built templates for common jobs (bathroom remodel, kitchen remodel, etc.)
- Quick estimate generation from template + photos

🔹 **Offline Mode (Enhanced)**
- Full offline editing (not just read-only)
- Queue photo uploads for later sync
- Offline PDF generation (cached data)

🔹 **Team Collaboration (Basic)**
- Add 1-2 team members per account (shared clients/projects)
- Role-based permissions (Admin, Estimator, Viewer)
- Activity log (who created/edited what)

🔹 **Client Communication**
- In-app messaging (send estimate, get client questions)
- SMS notifications when estimate is sent/viewed
- Client feedback: "Approve" or "Request Changes" buttons in PDF

🔹 **Estimate Comparison**
- Compare multiple estimate versions side-by-side
- Compare estimates across similar projects (benchmarking)
- Price variance alerts ("This is 20% higher than your avg bathroom remodel")

🔹 **Improved AI Accuracy**
- Fine-tune prompts based on user feedback
- Support for before/after photo pairs (better damage assessment)
- Auto-detect room dimensions from photos (using depth estimation)

🔹 **Dashboard Analytics**
- Monthly stats: total estimates, avg estimate value, approval rate
- Charts: estimates over time, revenue trends
- Top clients (by project count or revenue)

🔹 **Expanded Price Tables**
- Cover all 67 Florida counties (crowd-sourced + partnerships)
- Quarterly pricing updates (alert users to update tables)
- Community pricing: opt-in to share anonymized pricing data

🔹 **Additional Service Types**
- Roofing (shingles, metal, flat roof)
- HVAC (duct cleaning, AC replacement)
- Plumbing (pipe repair, fixture replacement)
- Electrical (panel upgrade, rewiring)

🔹 **Landscape Mode Support**
- Tablet-optimized layouts (iPad, Android tablets)
- Landscape orientation for estimate editing

### Technical Improvements
- Push notifications (estimate approved, client replied, etc.)
- Performance optimization (faster photo uploads, AI response <45s)
- Accessibility improvements (WCAG 2.1 AA compliance)
- Unit tests + E2E tests (80% coverage)

### Success Metrics (v1.1 - Months 4-6)
- 500 active users
- 2,500 estimates generated/month
- 30% of users use estimate templates
- 70% user retention (month-over-month)
- AI accuracy: 85% of estimates require ≤2 edits

---

## v1.2 - BUSINESS FEATURES
**Timeline:** Months 7-9
**Goal:** Help contractors manage their business beyond estimation

### New Features

🔹 **Invoicing (Basic)**
- Convert estimate to invoice (post-approval)
- Track invoice status (sent, paid, overdue)
- Payment reminders (automated email/SMS)
- Export to QuickBooks, Xero (CSV or API)

🔹 **Scheduling & Calendar**
- Link projects to calendar dates
- Crew assignment (assign team members to projects)
- Gantt chart view (simple timeline of projects)
- Google Calendar / Outlook sync

🔹 **Materials Shopping List**
- Auto-generate shopping list from estimate materials
- Export to Home Depot, Lowe's (if API available)
- Track material purchases vs. budget

🔹 **Expense Tracking**
- Log project expenses (receipts, materials, labor)
- Compare actual vs. estimated costs
- Profit margin analysis per project

🔹 **Client Portal (Web)**
- Clients can view estimates online (no app download needed)
- Digital signature for estimate approval
- Upload additional photos or notes

🔹 **Multi-Language Support**
- Spanish language option (UI + PDFs)
- Bilingual estimates (English/Spanish side-by-side)

### Success Metrics (v1.2 - Months 7-9)
- 1,000 active users
- 10% of users convert estimates to invoices
- 20% of users use scheduling features
- 4.7+ star rating

---

## v2.0 - NATIONAL EXPANSION & ADVANCED AI
**Timeline:** Months 10-15 (1 year post-MVP)
**Goal:** Expand beyond Florida, add advanced AI features, integrate with business tools

### Major Features

🚀 **National Expansion**
- Support for all 50 US states
- Regional pricing tables (auto-populated for major cities)
- State-specific tax rates, regulations, terms

🚀 **Advanced AI Features**
- **Material Recognition:** AI identifies specific materials (e.g., "12x24 porcelain tile")
- **Damage Assessment:** AI estimates repair complexity (cosmetic vs. structural)
- **3D Room Scanning:** Use iPhone LiDAR or Android ARCore for precise measurements
- **Historical Learning:** AI learns from user's past estimates to improve accuracy
- **Predictive Pricing:** AI suggests optimal pricing based on market trends

🚀 **Payment Processing**
- Accept payments directly in-app (Stripe, Square integration)
- Payment plans (installments)
- Track paid vs. unpaid invoices

🚀 **CRM (Full-Featured)**
- Lead tracking (prospects → clients)
- Sales pipeline (leads → quotes → won/lost)
- Email campaigns (send newsletters, promotions)
- Client ratings & reviews

🚀 **Reporting & Analytics (Advanced)**
- Financial reports (P&L, cash flow)
- Project profitability analysis
- Forecasting (revenue projections based on pipeline)
- Tax reports (1099 forms, sales tax)

🚀 **Integrations**
- QuickBooks Online (full sync: estimates, invoices, expenses)
- Stripe / Square (payment processing)
- Zapier (connect to 5,000+ apps)
- Google Drive / Dropbox (photo backup)
- Home Depot / Lowe's Pro (material ordering)

🚀 **White-Label Option (Enterprise)**
- Larger contractors can rebrand the app (their logo, colors)
- Custom domain for client portal (e.g., estimates.abccontractors.com)
- API access for custom integrations

🚀 **Marketplace**
- Templates marketplace (buy/sell estimate templates)
- Price table marketplace (download regional pricing)
- Contractor directory (clients can find contractors using PhotoQuote AI)

### Technical Improvements
- Microservices architecture (scale to 100,000+ users)
- Multi-region deployment (AWS US-East, US-West, etc.)
- Real-time collaboration (multiple users editing same estimate)
- AI model fine-tuning (custom model trained on PhotoQuote data)

### Success Metrics (v2.0 - Month 15)
- 10,000 active users (across US)
- 100,000 estimates generated/month
- 5,000 paid invoices processed/month ($500K+ GMV)
- 50% of users in states outside Florida
- 90% user retention (annual)

---

## PRICING EVOLUTION

### MVP (v1.0)
- **Free Tier:** 5 estimates/month (limited features)
- **Pro Tier:** $29/month - unlimited estimates, all features
- **14-day free trial** (no credit card required)

### v1.1
- **Free Tier:** 5 estimates/month
- **Pro Tier:** $29/month - unlimited estimates
- **Pro+ Tier:** $49/month - Pro + team collaboration (up to 5 users)

### v1.2
- **Free Tier:** 5 estimates/month
- **Pro Tier:** $39/month - unlimited estimates + invoicing
- **Pro+ Tier:** $59/month - Pro + team + scheduling
- **Business Tier:** $99/month - Pro+ + advanced analytics + integrations

### v2.0
- **Free Tier:** 5 estimates/month
- **Pro Tier:** $49/month - unlimited estimates + invoicing
- **Pro+ Tier:** $79/month - Pro + team + scheduling
- **Business Tier:** $149/month - Pro+ + advanced analytics + integrations
- **Enterprise Tier:** Custom pricing - white-label + API access + dedicated support

---

## FUTURE IDEAS (v3.0+)

### Beyond Year 2
🔮 **AI-Powered Project Management**
- Auto-schedule tasks based on estimate timeline
- Real-time progress tracking (photo updates from jobsite)
- Auto-alert for delays or cost overruns

🔮 **Client App (Separate App for Clients)**
- Clients can request quotes (submit photos)
- Track project progress in real-time
- Rate & review contractors

🔮 **Video Estimates**
- Upload walkthrough video instead of photos
- AI analyzes video frames + audio narration

🔮 **AR Visualization**
- Show client what finished project will look like (AR overlay on photos)

🔮 **Franchise/Multi-Location Support**
- Corporate account with multiple locations
- Centralized pricing, distributed teams

🔮 **Insurance Integration**
- Auto-submit estimates to insurance companies (for claims)
- Expedite insurance approvals

---

## COMPETITIVE POSITIONING

| Feature | PhotoQuote AI (MVP) | Competitor A (Estimate Rocket) | Competitor B (Joist) |
|---------|---------------------|-------------------------------|---------------------|
| AI Photo Analysis | ✅ Yes | ❌ No | ❌ No |
| Local Pricing Tables | ✅ Yes | ❌ Manual | ⚠️ Generic |
| Mobile-First | ✅ Yes | ⚠️ Mobile + Web | ✅ Yes |
| PDF Export | ✅ Yes | ✅ Yes | ✅ Yes |
| Invoicing | ❌ v1.2 | ✅ Yes | ✅ Yes |
| Scheduling | ❌ v1.2 | ✅ Yes | ✅ Yes |
| Price | $29/mo | $49/mo | $39/mo |
| Target Market | Florida (then US) | US-wide | US-wide |
| **Differentiator** | **AI + Local Pricing** | Templates | Invoicing Focus |

**Key Advantage:** PhotoQuote AI is the ONLY tool that combines AI photo analysis with local market pricing, ensuring accuracy and speed.

---

## RISKS & MITIGATION STRATEGIES

### Risk 1: AI Accuracy Issues
**Impact:** High - Users lose trust if estimates are wildly inaccurate
**Mitigation:**
- Always show confidence scores
- Require user confirmation for low-confidence items
- Learn from user corrections (v2.0 historical learning)
- Offer "manual mode" as fallback

### Risk 2: Pricing Data Staleness
**Impact:** Medium - Outdated prices lead to unprofitable jobs
**Mitigation:**
- Quarterly update reminders
- Community pricing (users share anonymized data)
- Partnerships with industry associations for current rates

### Risk 3: Slow Adoption (Contractors Resistant to AI)
**Impact:** High - Low user growth
**Mitigation:**
- Emphasize time savings (5 hours → 10 minutes)
- Offer free tier to lower barrier to entry
- Target younger contractors (more tech-savvy)
- Showcase success stories (case studies, testimonials)

### Risk 4: Competition from Established Players
**Impact:** Medium - Hard to compete with Joist, Estimate Rocket
**Mitigation:**
- Focus on AI differentiation (they don't have this)
- Superior UX (mobile-first, faster)
- Florida-first strategy (local expertise)
- Aggressive pricing ($29 vs. $49)

### Risk 5: API Costs (AI/LLM)
**Impact:** Medium - High AI usage could exceed budget
**Mitigation:**
- Cache common estimates (templates)
- Use cheaper models for simple tasks (Haiku for summaries, Opus for complex)
- Optimize prompts to reduce token usage
- Set rate limits (10 AI estimates/hour in free tier)

---

## SUCCESS CRITERIA

### MVP Success (End of Month 6)
- ✅ 100+ paying subscribers
- ✅ 1,000+ estimates generated
- ✅ 4.5+ star rating on app stores
- ✅ 60%+ estimate-to-PDF conversion
- ✅ <5% churn rate

### v1.1 Success (End of Month 9)
- ✅ 500+ paying subscribers
- ✅ $15K+ MRR (monthly recurring revenue)
- ✅ 70%+ user retention
- ✅ 10+ 5-star reviews/month

### v2.0 Success (End of Month 15)
- ✅ 2,000+ paying subscribers
- ✅ $100K+ MRR
- ✅ Presence in 10+ US states
- ✅ 80%+ annual retention
- ✅ Break-even or profitable

---

## TEAM EVOLUTION

### MVP (Months 1-3)
- 1 Product Manager
- 2 Frontend Developers (React Native)
- 1 Backend Developer (Supabase)
- 1 UI/UX Designer
- 1 QA Tester (part-time)

### v1.1 (Months 4-6)
- Same team + 1 additional frontend dev
- Add: 1 Marketing Manager (part-time)

### v1.2 (Months 7-9)
- Add: 1 Customer Success Manager
- Add: 1 Data Analyst (optimize AI prompts, analyze usage)

### v2.0 (Months 10-15)
- Add: 1 Backend Developer (scaling, integrations)
- Add: 1 AI/ML Engineer (fine-tune models)
- Add: 1 Full-time Marketing Manager
- Add: 2 Sales Reps (for Enterprise tier)

---

## CONCLUSION

PhotoQuote AI will revolutionize how contractors create estimates by combining AI-powered photo analysis with local market pricing. The MVP (v1.0) focuses on delivering core value: fast, accurate estimates for Florida contractors. Subsequent versions expand features (templates, invoicing, scheduling) and geography (national expansion), while maintaining our core differentiator: AI + local pricing.

**Next Steps:**
1. Finalize MVP scope and start development (Month 1)
2. Recruit 20 beta users in Florida (Month 2)
3. Launch MVP to App Store & Google Play (Month 3)
4. Iterate based on user feedback (Months 4-6)
5. Scale nationally (Months 10-15)

---

*End of Roadmap - PhotoQuote AI*
