# PhotoQuote AI - Complete Feature List & Requirements

---

## FUNCTIONAL FEATURES

### F1. AUTHENTICATION & USER MANAGEMENT

#### F1.1 Sign Up / Sign In
- **F1.1.1** Email + password authentication
- **F1.1.2** Google Sign-In (OAuth)
- **F1.1.3** Apple Sign-In (OAuth)
- **F1.1.4** Password reset via email
- **F1.1.5** Email verification on signup
- **F1.1.6** Remember me / auto-login
- **F1.1.7** Logout

#### F1.2 Company Profile Setup (Onboarding)
- **F1.2.1** Company name (required)
- **F1.2.2** Company phone (required)
- **F1.2.3** Company email (required)
- **F1.2.4** Company logo upload (optional, max 2MB, PNG/JPG)
- **F1.2.5** Default city/ZIP in Florida (required)
- **F1.2.6** Default county selection (required)
- **F1.2.7** Default labor rate ($/hour, required, e.g., $45.00)
- **F1.2.8** Default profit margin (%, required, e.g., 20%)
- **F1.2.9** Default tax rate (%, optional, e.g., 7% Florida sales tax)
- **F1.2.10** Default PDF terms template (optional, rich text)

#### F1.3 Profile Management
- **F1.3.1** Edit company profile
- **F1.3.2** Change password
- **F1.3.3** Update default settings
- **F1.3.4** Delete account (with confirmation)

---

### F2. CLIENT MANAGEMENT (CRM-LITE)

#### F2.1 Client List
- **F2.1.1** View all clients (list view with search)
- **F2.1.2** Sort by: name, date added, last project
- **F2.1.3** Search by: name, phone, email
- **F2.1.4** Quick add client (+ button)

#### F2.2 Client Detail
- **F2.2.1** Full name (required)
- **F2.2.2** Phone number (required, US format validation)
- **F2.2.3** Email (optional, email format validation)
- **F2.2.4** Address (street, city, state, ZIP - optional)
- **F2.2.5** Notes (optional, rich text, max 1000 chars)
- **F2.2.6** Created date (auto)
- **F2.2.7** Last updated date (auto)

#### F2.3 Client History
- **F2.3.1** List of all projects for this client
- **F2.3.2** List of all estimates for this client
- **F2.3.3** Total value of estimates sent
- **F2.3.4** Quick action: create new project for client

#### F2.4 Client Actions
- **F2.4.1** Create new client
- **F2.4.2** Edit client
- **F2.4.3** Delete client (with confirmation, orphans projects)
- **F2.4.4** Call client (opens phone dialer)
- **F2.4.5** Email client (opens email app)
- **F2.4.6** Text/SMS client (opens messaging app)

---

### F3. PROJECT MANAGEMENT

#### F3.1 Project Creation
**Required Fields:**
- **F3.1.1** Project name (text, max 100 chars)
- **F3.1.2** Client selection (dropdown + "Create New Client" option)
- **F3.1.3** Property address:
  - Street address (required)
  - City (required, default from company profile)
  - State (required, default FL, editable)
  - ZIP code (required, 5-digit validation)
  - County (auto-populated from ZIP, editable)
- **F3.1.4** Property type (required):
  - Residential (Single-family, Multi-family, Townhouse)
  - Commercial (Office, Retail, Warehouse)
  - Condo
- **F3.1.5** Access level (required):
  - Easy (street-level, normal access)
  - Medium (some obstacles, narrow hallways, stairs)
  - Hard (limited access, high-security, remote location)
- **F3.1.6** Floor level (required):
  - Ground
  - Floor 1–50 (numeric selector)
- **F3.1.7** Elevator (required): Yes / No
- **F3.1.8** Parking (required):
  - Easy (free street/lot parking nearby)
  - Paid (paid lot/garage required)
  - Hard (limited parking, far from site)

**Optional Fields:**
- **F3.1.9** Job notes (rich text, max 2000 chars)
- **F3.1.10** Desired start date (date picker)
- **F3.1.11** Deadline date (date picker)

#### F3.2 Project List
- **F3.2.1** View all projects (list view)
- **F3.2.2** Filter by: client, status (draft/active/completed), date range
- **F3.2.3** Sort by: date created, project name, client name
- **F3.2.4** Search by: project name, address, client name

#### F3.3 Project Detail View
- **F3.3.1** All project fields displayed
- **F3.3.2** Photo gallery (thumbnails + full-screen viewer)
- **F3.3.3** List of estimates for this project
- **F3.3.4** Project timeline (created date, last updated, estimate dates)

#### F3.4 Project Actions
- **F3.4.1** Create new project
- **F3.4.2** Edit project
- **F3.4.3** Delete project (with confirmation, deletes all media/estimates)
- **F3.4.4** Duplicate project (copy all fields except media)

---

### F4. MEDIA UPLOAD & MANAGEMENT

#### F4.1 Photo Upload
- **F4.1.1** Take photo with camera (native camera integration)
- **F4.1.2** Select from gallery (multi-select, 5–30 photos)
- **F4.1.3** Photo preview before upload
- **F4.1.4** Upload progress indicator
- **F4.1.5** Photo compression (auto, max 5MB per photo)
- **F4.1.6** Max 30 photos per project (hard limit)

#### F4.2 Video Upload
- **F4.2.1** Record video (native camera, max 60 seconds)
- **F4.2.2** Select from gallery (max 1 video per project)
- **F4.2.3** Video preview before upload
- **F4.2.4** Upload progress indicator
- **F4.2.5** Video compression (auto, max 50MB)

#### F4.3 Photo Tagging
- **F4.3.1** Tag photos with categories:
  - Kitchen, Bathroom, Living Room, Bedroom, Hallway
  - Flooring, Walls, Ceiling, Baseboards, Trim
  - Stairs, Railings, Doors, Windows
  - Exterior, Roof, Deck, Patio
  - Damage, Water Damage, Mold, Cracks
  - Other (custom tag)
- **F4.3.2** Multi-tag support (1 photo can have multiple tags)
- **F4.3.3** Edit tags after upload
- **F4.3.4** Filter photos by tag

#### F4.4 Manual Measurements (Optional)
- **F4.4.1** Add square footage (sqft) per photo or project
- **F4.4.2** Add linear feet (lf)
- **F4.4.3** Add unit count (e.g., "3 doors")
- **F4.4.4** Notes per measurement

#### F4.5 Media Actions
- **F4.5.1** View photo in full-screen mode
- **F4.5.2** Delete photo
- **F4.5.3** Rotate photo
- **F4.5.4** Reorder photos (drag & drop)
- **F4.5.5** Download photo to device

---

### F5. AI ESTIMATE GENERATOR (CORE FEATURE)

#### F5.1 Pre-Generation Setup
- **F5.1.1** Service type selection (required):
  - Flooring (LVP, tile, hardwood, carpet)
  - Painting (interior, exterior, cabinets)
  - Drywall (repair, installation, finishing)
  - Baseboards & Trim
  - Demolition & Removal
  - Cleanup & Hauling
  - Bathroom Remodel
  - Kitchen Remodel
  - General Handyman
- **F5.1.2** Scope preference (optional):
  - Minimal (essentials only)
  - Standard (recommended)
  - Comprehensive (full detailed breakdown)

#### F5.2 AI Processing
- **F5.2.1** Analyze all uploaded photos + video
- **F5.2.2** Identify scope of work based on service type + photos
- **F5.2.3** Detect quantities (sqft, linear feet, units):
  - If measurements provided manually: use those
  - If not: estimate from photos + show confidence level (%)
- **F5.2.4** Generate line-item breakdown:
  - Preparation & Protection
  - Demolition & Removal
  - Repair & Installation
  - Finishing & Cleanup
  - Haul-Away & Disposal
- **F5.2.5** Retrieve pricing from Local Price Table:
  - Match project ZIP/county to price table region
  - Use service category + unit type
  - Default to "avg" price unless user selects low/high
- **F5.2.6** Apply adjustment multipliers:
  - Access: Medium +5–10%, Hard +10–20%
  - Floor without elevator: +10–30% based on floor number
  - Parking paid: +$100–200 flat fee or +5%
  - Parking hard: +$200–300 flat fee or +10%

#### F5.3 Confirmation & Clarifications
- **F5.3.1** If quantity confidence <70%: prompt user
  - "We estimate 120 sqft based on photos. Please confirm or update."
  - Allow quick edit before finalizing
- **F5.3.2** If measurements critical and missing: block final generation
  - "To ensure accuracy, please provide square footage or linear feet."
- **F5.3.3** If no pricing data for region: block final generation
  - "No pricing data found for ZIP 33101. Please set up a Price Table first."

#### F5.4 AI Output Format
- **F5.4.1** JSON structure with:
  - Line items array (category, description, unit, qty, unit_price, subtotal)
  - Materials list (optional suggestions)
  - Labor hours estimate
  - Confidence scores per line item
  - Assumptions & exclusions
  - Recommended timeline (days/weeks)
  - Payment terms suggestion

#### F5.5 Progress Indicators
- **F5.5.1** Step 1: Analyzing photos... (0–30%)
- **F5.5.2** Step 2: Identifying scope... (30–60%)
- **F5.5.3** Step 3: Calculating quantities... (60–80%)
- **F5.5.4** Step 4: Applying pricing... (80–100%)
- **F5.5.5** Estimated time remaining (seconds)

---

### F6. ESTIMATE EDITOR

#### F6.1 View Estimate
- **F6.1.1** Estimate header:
  - Project name, client name, property address
  - Estimate version number (v1, v2, v3...)
  - Created date, last updated date
  - Status: Draft / Sent / Approved / Rejected
- **F6.1.2** Line items table:
  - Category, Description, Unit, Quantity, Unit Price, Subtotal
  - Collapsible categories
- **F6.1.3** Totals section:
  - Subtotal (sum of all line items)
  - Tax (% applied to subtotal, optional)
  - Margin/Profit (% applied, configurable)
  - Grand Total (USD, formatted $1,000.00)

#### F6.2 Edit Line Items
- **F6.2.1** Add new line item (manual entry)
- **F6.2.2** Edit existing line item:
  - Category (dropdown)
  - Description (text, max 200 chars)
  - Unit (sqft, lf, each, hour, lot, custom)
  - Quantity (numeric, 2 decimal places)
  - Unit price (USD, 2 decimal places)
  - Subtotal (auto-calculated)
- **F6.2.3** Delete line item (with confirmation)
- **F6.2.4** Reorder line items (drag & drop)
- **F6.2.5** Duplicate line item

#### F6.3 Edit Totals & Settings
- **F6.3.1** Edit tax rate (%, optional)
- **F6.3.2** Edit margin/profit rate (%)
- **F6.3.3** Apply margin to: Subtotal or Subtotal+Tax (toggle)
- **F6.3.4** Recalculate button (re-applies all formulas)

#### F6.4 Edit Notes & Terms
- **F6.4.1** Estimate notes (rich text, max 2000 chars)
- **F6.4.2** Exclusions (what's NOT included)
- **F6.4.3** Assumptions (e.g., "assumes subfloor in good condition")
- **F6.4.4** Validity period (default 30 days, editable)
- **F6.4.5** Estimated timeline (e.g., "3–5 business days")
- **F6.4.6** Payment terms (e.g., "50% deposit, 50% on completion")

#### F6.5 Version Control
- **F6.5.1** Save as new version (creates v2, v3, etc.)
- **F6.5.2** View all versions (list with date/time stamps)
- **F6.5.3** Compare versions (side-by-side diff view)
- **F6.5.4** Revert to previous version (with confirmation)

#### F6.6 Optional: Multiple Estimate Types
- **F6.6.1** "Client Version" (higher margin, polished presentation)
- **F6.6.2** "Contractor Version" (lower margin, internal use)
- **F6.6.3** Toggle between versions with one tap

---

### F7. PDF EXPORT & SHARING

#### F7.1 PDF Generation
- **F7.1.1** Professional layout:
  - Company logo + contact info (top header)
  - Estimate title: "Estimate for [Project Name]"
  - Client info: name, address, phone, email
  - Project address
  - Estimate number (auto-generated, e.g., EST-2024-001)
  - Date issued, valid until date
- **F7.1.2** Itemized table:
  - Column headers: Item, Description, Unit, Qty, Unit Price, Total
  - All line items with subtotals
  - Category subtotals (collapsible sections)
- **F7.1.3** Totals section (right-aligned):
  - Subtotal
  - Tax (if applicable)
  - Total (bold, larger font)
- **F7.1.4** Terms & Conditions:
  - Payment terms
  - Validity period
  - Exclusions & assumptions
  - Timeline estimate
  - Contact info for questions
- **F7.1.5** Footer: "Generated with PhotoQuote AI" (optional branding)

#### F7.2 PDF Customization
- **F7.2.1** Select logo (use default or upload new)
- **F7.2.2** Choose template (clean, modern, detailed)
- **F7.2.3** Show/hide line item categories
- **F7.2.4** Show/hide unit prices (show only totals)
- **F7.2.5** Add custom footer text

#### F7.3 PDF Preview
- **F7.3.1** In-app PDF viewer (scroll, zoom)
- **F7.3.2** Page count indicator
- **F7.3.3** Edit button (return to estimate editor)
- **F7.3.4** Regenerate button (if edits made)

#### F7.4 Sharing Options
- **F7.4.1** Email (native share, pre-fills subject + body)
- **F7.4.2** WhatsApp (attach PDF)
- **F7.4.3** SMS/Text (attach PDF, carrier permitting)
- **F7.4.4** Save to device (Downloads folder)
- **F7.4.5** Print (if printer available)
- **F7.4.6** Copy shareable link (cloud-hosted PDF, 30-day expiry)

#### F7.5 Send Tracking (Optional MVP)
- **F7.5.1** Mark estimate as "Sent" with timestamp
- **F7.5.2** Log send method (email, WhatsApp, etc.)
- **F7.5.3** Add follow-up reminder (optional)

---

### F8. LOCAL PRICE TABLE MANAGEMENT

#### F8.1 Price Table Structure
- **F8.1.1** Region identification:
  - Region name (e.g., "Miami-Dade County")
  - ZIP codes covered (comma-separated list)
  - County + State
- **F8.1.2** Service categories:
  - Flooring, Painting, Drywall, Baseboards, Demo, Cleanup, etc.
- **F8.1.3** Price entries:
  - Service category
  - Item description (e.g., "LVP installation")
  - Unit (sqft, lf, each, hour, lot)
  - Low price (USD)
  - Average price (USD)
  - High price (USD)
  - Last updated date

#### F8.2 Price Table Setup (Onboarding)
- **F8.2.1** Check if region exists (by ZIP or county)
- **F8.2.2** If not: offer to create from template
- **F8.2.3** Templates available:
  - Broward County Template
  - Miami-Dade County Template
  - Palm Beach County Template
  - Generic Florida Template
- **F8.2.4** Copy template → allow user to customize

#### F8.3 Price Table CRUD
- **F8.3.1** View all price tables (list by region)
- **F8.3.2** Create new price table (manual or from template)
- **F8.3.3** Edit price table:
  - Add/edit/delete individual price entries
  - Bulk edit (CSV import)
  - Update last modified date
- **F8.3.4** Delete price table (with confirmation)
- **F8.3.5** Duplicate price table (for similar regions)

#### F8.4 Price Table Search & Filter
- **F8.4.1** Search by: service category, item description, unit
- **F8.4.2** Filter by: region, date range (last updated)
- **F8.4.3** Sort by: category, price (low to high), last updated

#### F8.5 Price Table Import/Export
- **F8.5.1** Export to CSV (all entries or filtered)
- **F8.5.2** Import from CSV (with validation)
- **F8.5.3** Template CSV download

#### F8.6 Pricing Safety Rules
- **F8.6.1** AI CANNOT generate estimate without price table for project region
- **F8.6.2** If no match: prompt user to create or select nearby region
- **F8.6.3** Show "last updated" date on estimates (transparency)
- **F8.6.4** Suggest quarterly update reminder

---

### F9. SETTINGS & PREFERENCES

#### F9.1 Company Settings
- **F9.1.1** Edit company profile (same as F1.2)
- **F9.1.2** Update logo
- **F9.1.3** Update default rates (labor, margin, tax)

#### F9.2 PDF Template Settings
- **F9.2.1** Edit default terms & conditions (rich text editor)
- **F9.2.2** Edit default payment terms
- **F9.2.3** Edit default validity period (days)
- **F9.2.4** Choose default PDF template style

#### F9.3 Notification Settings
- **F9.3.1** Enable/disable push notifications
- **F9.3.2** Email notifications for:
  - New estimate generated
  - Price table update reminder

#### F9.4 Data & Privacy
- **F9.4.1** Export all data (JSON backup)
- **F9.4.2** Delete account (with confirmation, irreversible)
- **F9.4.3** Privacy policy link
- **F9.4.4** Terms of service link

#### F9.5 About & Support
- **F9.5.1** App version number
- **F9.5.2** Contact support (email link)
- **F9.5.3** FAQs (in-app or web link)
- **F9.5.4** Tutorial videos (optional)
- **F9.5.5** Rate app (link to App Store / Google Play)

---

### F10. DASHBOARD & NAVIGATION

#### F10.1 Home Dashboard
- **F10.1.1** Quick stats:
  - Total projects (all time)
  - Total estimates sent (this month)
  - Total estimate value (this month, USD)
- **F10.1.2** Quick actions:
  - + New Project
  - + New Client
  - View Price Tables
- **F10.1.3** Recent projects (last 5, with thumbnails)
- **F10.1.4** Recent estimates (last 5, with status badges)

#### F10.2 Navigation
- **F10.2.1** Bottom tab bar (iOS/Android standard):
  - Home (dashboard)
  - Projects (list)
  - Clients (list)
  - Settings
- **F10.2.2** Top navigation: title + back button (where applicable)
- **F10.2.3** Floating action button (FAB) for "+ New Project" on key screens

---

## NON-FUNCTIONAL REQUIREMENTS

### NFR1. PERFORMANCE

- **NFR1.1** App launch time: <3 seconds (cold start)
- **NFR1.2** Photo upload: <30 seconds for 10 photos (5MB each, typical 4G LTE)
- **NFR1.3** AI estimate generation: <60 seconds (95th percentile)
- **NFR1.4** PDF generation: <10 seconds
- **NFR1.5** List view rendering: <1 second for up to 100 items
- **NFR1.6** Search results: <500ms response time
- **NFR1.7** Screen transitions: smooth 60fps animations

### NFR2. RELIABILITY & AVAILABILITY

- **NFR2.1** Backend uptime: 99.5% (AWS/Supabase SLA)
- **NFR2.2** Data backup: daily automated backups, 30-day retention
- **NFR2.3** Offline mode:
  - Browse past projects/estimates (read-only)
  - Edit draft estimates (sync when online)
  - Queue photo uploads for later
- **NFR2.4** Error handling:
  - Graceful degradation (show cached data if API fails)
  - Retry mechanism for failed uploads (3 attempts)
  - User-friendly error messages (no tech jargon)

### NFR3. SECURITY & PRIVACY

- **NFR3.1** Authentication:
  - OAuth 2.0 for Google/Apple sign-in
  - JWT tokens with 7-day expiry + refresh tokens
  - Secure password storage (bcrypt, salt rounds ≥12)
- **NFR3.2** Data encryption:
  - TLS 1.3 for all API calls
  - AES-256 encryption for data at rest (Supabase default)
  - Photo storage: private buckets, signed URLs (1-hour expiry)
- **NFR3.3** Privacy compliance:
  - GDPR-ready (user data export, right to deletion)
  - CCPA-ready (California users can delete data)
  - No selling of user data
  - Clear privacy policy (linked in app)
- **NFR3.4** Access control:
  - Users can only access their own data (row-level security in Postgres)
  - No shared accounts (each user = separate account)

### NFR4. USABILITY & ACCESSIBILITY

- **NFR4.1** Onboarding: <5 minutes to complete setup
- **NFR4.2** New estimate creation: <10 minutes (including photo upload)
- **NFR4.3** Mobile-first design:
  - Optimized for one-handed use
  - Touch targets ≥44pt (iOS) / 48dp (Android)
  - Readable font sizes (min 14pt body text)
- **NFR4.4** Accessibility (WCAG 2.1 Level AA):
  - Screen reader support (VoiceOver, TalkBack)
  - Sufficient color contrast (4.5:1 for text)
  - Keyboard navigation support
  - Alt text for images
- **NFR4.5** Error prevention:
  - Confirm destructive actions (delete, overwrite)
  - Autosave drafts every 30 seconds
  - "Unsaved changes" warning when navigating away

### NFR5. COMPATIBILITY

- **NFR5.1** iOS: 14.0 or later (supports iPhone 6s and newer)
- **NFR5.2** Android: 10.0 (API level 29) or later
- **NFR5.3** Screen sizes:
  - iOS: iPhone SE (4.7") to iPhone 15 Pro Max (6.7")
  - Android: 5.0" to 6.8" (responsive layout)
- **NFR5.4** Orientation: portrait mode only (MVP), landscape support in v1.1
- **NFR5.5** Network: works on 3G/4G/5G/WiFi; graceful degradation on slow networks

### NFR6. LOCALIZATION (MVP SCOPE)

- **NFR6.1** Language: English (US) only
- **NFR6.2** Currency: USD ($) only, formatted as $1,000.00
- **NFR6.3** Date format: MM/DD/YYYY (US standard)
- **NFR6.4** Measurement units: sqft, linear feet (US imperial)
- **NFR6.5** Phone number: US format (XXX) XXX-XXXX
- **NFR6.6** ZIP code: 5-digit US ZIP codes

### NFR7. SCALABILITY

- **NFR7.1** Support 1,000 active users in first 3 months
- **NFR7.2** Handle 10,000 estimates/month
- **NFR7.3** Photo storage: 500GB total (assuming 100MB avg per user × 5,000 users)
- **NFR7.4** Database: Postgres (Supabase), scalable to 100GB+
- **NFR7.5** AI API rate limits: handle 100 concurrent requests

### NFR8. MAINTAINABILITY

- **NFR8.1** Code quality:
  - TypeScript (100% typed, strict mode)
  - ESLint + Prettier (enforced in CI/CD)
  - Unit test coverage ≥70% (critical paths)
  - E2E test coverage for key user flows
- **NFR8.2** Documentation:
  - API documentation (OpenAPI/Swagger)
  - Code comments for complex logic
  - README with setup instructions
- **NFR8.3** Monitoring & logging:
  - Error tracking (Sentry or similar)
  - Analytics (usage, crashes, performance)
  - Server logs (access, errors, slow queries)

### NFR9. COMPLIANCE & LEGAL

- **NFR9.1** App store compliance:
  - iOS App Store Review Guidelines
  - Google Play Store policies
- **NFR9.2** Privacy policy (published on website)
- **NFR9.3** Terms of service (published on website)
- **NFR9.4** Content policy: no illegal, offensive, or copyrighted content
- **NFR9.5** Photo usage rights: users own their photos, app does not claim rights

### NFR10. BUDGET & TIMELINE CONSTRAINTS (MVP)

- **NFR10.1** Development timeline: 90 days (3 months)
- **NFR10.2** Team size: 2 frontend devs, 1 backend dev, 1 designer, 1 PM
- **NFR10.3** Infrastructure costs: <$500/month (Supabase Pro + AI API)
- **NFR10.4** MVP launch budget: $50,000 total (labor + infra + marketing)

---

## TECHNICAL REQUIREMENTS

### TR1. FRONTEND STACK

- **TR1.1** Framework: React Native 0.73+ with Expo SDK 50+
- **TR1.2** Language: TypeScript 5.3+
- **TR1.3** State management: Zustand or React Context + hooks
- **TR1.4** Navigation: React Navigation 6+
- **TR1.5** UI library: React Native Paper or NativeBase (optional)
- **TR1.6** Form handling: React Hook Form + Zod validation
- **TR1.7** Image handling:
  - expo-image-picker (camera + gallery)
  - expo-image-manipulator (compression, rotation)
- **TR1.8** PDF generation:
  - react-native-html-to-pdf or @react-pdf/renderer
- **TR1.9** HTTP client: Axios or Fetch API
- **TR1.10** Code style: ESLint + Prettier (Airbnb config)

### TR2. BACKEND STACK (OPTION A: SUPABASE)

- **TR2.1** Database: PostgreSQL 15+ (Supabase managed)
- **TR2.2** Authentication: Supabase Auth (email, Google, Apple OAuth)
- **TR2.3** Storage: Supabase Storage (S3-compatible, private buckets)
- **TR2.4** API: Supabase auto-generated REST + Realtime APIs
- **TR2.5** Row-level security (RLS) policies for data isolation
- **TR2.6** Database functions for complex queries (PL/pgSQL)
- **TR2.7** Scheduled jobs: Supabase Edge Functions + cron (if needed)

### TR3. BACKEND STACK (OPTION B: FIREBASE)

- **TR3.1** Database: Firestore (NoSQL)
- **TR3.2** Authentication: Firebase Auth (email, Google, Apple OAuth)
- **TR3.3** Storage: Firebase Cloud Storage
- **TR3.4** API: Firebase Cloud Functions (Node.js)
- **TR3.5** Security rules for data isolation
- **TR3.6** Scheduled jobs: Cloud Functions + Cloud Scheduler

### TR4. AI / ML SERVICES

- **TR4.1** Vision API: OpenAI GPT-4 Vision or Anthropic Claude 3 (with vision)
- **TR4.2** Pricing rules engine: Custom logic (not AI-generated)
- **TR4.3** Prompt templates: Version-controlled JSON files
- **TR4.4** Fallback: If AI fails, prompt user to create estimate manually

### TR5. THIRD-PARTY INTEGRATIONS

- **TR5.1** Email service: SendGrid or Resend (for sending PDFs)
- **TR5.2** Analytics: Mixpanel or PostHog (user behavior tracking)
- **TR5.3** Error tracking: Sentry (crash reports)
- **TR5.4** App distribution: Expo EAS (build + updates)

### TR6. DEVOPS & CI/CD

- **TR6.1** Version control: Git (GitHub or GitLab)
- **TR6.2** CI/CD: GitHub Actions or GitLab CI
  - Automated tests on PR
  - Automated builds (iOS + Android)
  - Automated deployment to Expo
- **TR6.3** Environments: dev, staging, production
- **TR6.4** Secrets management: .env files + Expo Secrets (not committed to git)

---

## EDGE CASES & ERROR SCENARIOS

### EC1. AI Edge Cases
- **EC1.1** Poor photo quality → show confidence warning, request better photos
- **EC1.2** AI timeout (>2 min) → allow manual estimate creation
- **EC1.3** AI hallucinates scope → user can always edit/override
- **EC1.4** No pricing data → block estimate, guide to Price Table setup

### EC2. Data Edge Cases
- **EC2.1** Client deleted but has projects → orphan projects (keep for history)
- **EC2.2** Project with no photos → allow text-only estimate creation
- **EC2.3** Duplicate projects (same client + address) → warn user, allow anyway
- **EC2.4** Estimate edited after sending → create new version, mark old as "superseded"

### EC3. Network Edge Cases
- **EC3.1** Photo upload fails → retry 3 times, then save to queue for later
- **EC3.2** Offline mode → show cached data, disable actions requiring network
- **EC3.3** Slow network → show progress indicators, allow cancellation

### EC4. User Error Scenarios
- **EC4.1** Forgot password → password reset email flow
- **EC4.2** Accidentally deleted project → "Undo" option (5-second timeout) or restore from backup (support request)
- **EC4.3** Wrong pricing data applied → user can always edit line items manually
- **EC4.4** Sent estimate to wrong client → no unsend feature (out of scope), user must send correction

---

*End of Feature List & Requirements - PhotoQuote AI MVP v1.0*
