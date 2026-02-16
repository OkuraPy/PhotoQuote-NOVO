# PhotoQuote AI - Database Schema

---

## DATABASE DESIGN PRINCIPLES

1. **Platform:** PostgreSQL 15+ (Supabase) or Firestore (Firebase)
2. **Schema shown below:** PostgreSQL (relational model)
3. **Naming convention:** snake_case for tables/columns
4. **Primary keys:** UUID v4 (better for distributed systems than auto-increment)
5. **Timestamps:** `created_at` and `updated_at` on all tables (auto-managed)
6. **Soft deletes:** Add `deleted_at` for tables where history matters (optional MVP feature)
7. **Row-level security (RLS):** All tables filtered by `user_id` (Supabase)

---

## ENTITY RELATIONSHIP DIAGRAM (ERD)

```
users (1) ──< (many) clients
users (1) ──< (many) projects
users (1) ──< (many) price_tables
clients (1) ──< (many) projects
projects (1) ──< (many) media
projects (1) ──< (many) estimates
estimates (1) ──< (many) line_items
```

---

## TABLE SCHEMAS

### 1. `users`
Stores user account and company profile information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | User ID (from Supabase Auth or Firebase Auth) |
| `email` | VARCHAR(255) | UNIQUE, NOT NULL | User email (from auth provider) |
| `company_name` | VARCHAR(255) | NOT NULL | Company/business name |
| `company_phone` | VARCHAR(20) | NOT NULL | Company phone number (US format) |
| `company_email` | VARCHAR(255) | | Company email (can differ from user email) |
| `logo_url` | TEXT | | URL to uploaded company logo (S3/Storage) |
| `default_city` | VARCHAR(100) | NOT NULL | Default city in Florida |
| `default_state` | VARCHAR(2) | DEFAULT 'FL' | Default state (US postal code) |
| `default_zip` | VARCHAR(10) | NOT NULL | Default ZIP code (5-digit) |
| `default_county` | VARCHAR(100) | | Default county (e.g., "Miami-Dade") |
| `default_labor_rate` | DECIMAL(10,2) | NOT NULL | Default labor rate ($/hour), e.g., 45.00 |
| `default_margin_percent` | DECIMAL(5,2) | NOT NULL | Default profit margin (%), e.g., 20.00 |
| `default_tax_percent` | DECIMAL(5,2) | DEFAULT 0 | Default sales tax (%), e.g., 7.00 (optional) |
| `pdf_terms_template` | TEXT | | Default PDF terms & conditions (rich text or HTML) |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Account creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_users_email` on `email` (for login lookup)

**RLS Policy:**
- Users can only read/update their own row (`id = auth.uid()`)

---

### 2. `clients`
Stores client/customer contact information.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Client ID |
| `user_id` | UUID | NOT NULL, FOREIGN KEY → users(id) | Owner of this client |
| `full_name` | VARCHAR(255) | NOT NULL | Client full name |
| `phone` | VARCHAR(20) | NOT NULL | Client phone number (US format) |
| `email` | VARCHAR(255) | | Client email address |
| `address_street` | VARCHAR(255) | | Street address |
| `address_city` | VARCHAR(100) | | City |
| `address_state` | VARCHAR(2) | | State (US postal code) |
| `address_zip` | VARCHAR(10) | | ZIP code |
| `notes` | TEXT | | Internal notes about client |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | When client was added |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_clients_user_id` on `user_id` (for listing clients per user)
- `idx_clients_full_name` on `full_name` (for search)

**RLS Policy:**
- Users can only access clients where `user_id = auth.uid()`

---

### 3. `projects`
Stores project details including property information and site conditions.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Project ID |
| `user_id` | UUID | NOT NULL, FOREIGN KEY → users(id) | Owner of this project |
| `client_id` | UUID | NOT NULL, FOREIGN KEY → clients(id) | Associated client |
| `project_name` | VARCHAR(255) | NOT NULL | Name/title of project |
| `property_address_street` | VARCHAR(255) | NOT NULL | Property street address |
| `property_city` | VARCHAR(100) | NOT NULL | Property city |
| `property_state` | VARCHAR(2) | NOT NULL DEFAULT 'FL' | Property state |
| `property_zip` | VARCHAR(10) | NOT NULL | Property ZIP code |
| `property_county` | VARCHAR(100) | | Property county (e.g., "Broward") |
| `property_type` | VARCHAR(50) | NOT NULL | Residential, Commercial, Condo |
| `access_level` | VARCHAR(20) | NOT NULL | Easy, Medium, Hard |
| `floor_level` | INTEGER | NOT NULL DEFAULT 0 | 0=Ground, 1-50=Floor number |
| `has_elevator` | BOOLEAN | NOT NULL DEFAULT FALSE | Elevator available? |
| `parking_type` | VARCHAR(20) | NOT NULL | Easy, Paid, Hard |
| `job_notes` | TEXT | | User notes about the job |
| `desired_start_date` | DATE | | Client's desired start date |
| `deadline_date` | DATE | | Project deadline |
| `status` | VARCHAR(20) | DEFAULT 'draft' | draft, active, completed, archived |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Project creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_projects_user_id` on `user_id`
- `idx_projects_client_id` on `client_id`
- `idx_projects_status` on `status`
- `idx_projects_created_at` on `created_at DESC` (for sorting recent projects)

**RLS Policy:**
- Users can only access projects where `user_id = auth.uid()`

**Constraints:**
- `property_type` ENUM: 'Residential', 'Commercial', 'Condo'
- `access_level` ENUM: 'Easy', 'Medium', 'Hard'
- `parking_type` ENUM: 'Easy', 'Paid', 'Hard'
- `status` ENUM: 'draft', 'active', 'completed', 'archived'

---

### 4. `media`
Stores photos and videos associated with projects.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Media ID |
| `project_id` | UUID | NOT NULL, FOREIGN KEY → projects(id) ON DELETE CASCADE | Associated project |
| `media_type` | VARCHAR(20) | NOT NULL | photo, video |
| `file_url` | TEXT | NOT NULL | URL to stored file (S3/Supabase Storage) |
| `file_size_bytes` | INTEGER | | File size in bytes |
| `mime_type` | VARCHAR(100) | | e.g., image/jpeg, video/mp4 |
| `tags` | TEXT[] | DEFAULT '{}' | Array of tags (kitchen, flooring, etc.) |
| `manual_sqft` | DECIMAL(10,2) | | Optional manual measurement (sqft) |
| `manual_linear_ft` | DECIMAL(10,2) | | Optional manual measurement (linear feet) |
| `manual_unit_count` | INTEGER | | Optional manual count (e.g., 3 doors) |
| `measurement_notes` | TEXT | | Notes about measurements |
| `display_order` | INTEGER | DEFAULT 0 | Sort order for photos |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Upload timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_media_project_id` on `project_id`
- `idx_media_display_order` on `display_order`

**RLS Policy:**
- Users can only access media for projects they own (join with projects table)

**Constraints:**
- `media_type` ENUM: 'photo', 'video'
- Max 30 photos + 1 video per project (enforced in app logic)

---

### 5. `price_tables`
Stores regional pricing data (labor + material unit prices).

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Price entry ID |
| `user_id` | UUID | NOT NULL, FOREIGN KEY → users(id) | Owner of this price table |
| `region_key` | VARCHAR(100) | NOT NULL | Region identifier (e.g., "Miami-Dade" or "33101") |
| `region_type` | VARCHAR(20) | NOT NULL | county, zip, city |
| `service_category` | VARCHAR(100) | NOT NULL | flooring, painting, drywall, etc. |
| `item_description` | VARCHAR(255) | NOT NULL | e.g., "LVP installation" |
| `unit` | VARCHAR(20) | NOT NULL | sqft, lf (linear ft), each, hour, lot |
| `price_low` | DECIMAL(10,2) | NOT NULL | Low-end price (USD) |
| `price_avg` | DECIMAL(10,2) | NOT NULL | Average market price (USD) |
| `price_high` | DECIMAL(10,2) | NOT NULL | High-end price (USD) |
| `notes` | TEXT | | Optional notes about this pricing |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Entry creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_price_tables_user_id` on `user_id`
- `idx_price_tables_region_key` on `region_key`
- `idx_price_tables_service_category` on `service_category`
- Composite index: `idx_price_tables_lookup` on `(user_id, region_key, service_category, item_description)`

**RLS Policy:**
- Users can only access price tables where `user_id = auth.uid()`

**Constraints:**
- `region_type` ENUM: 'county', 'zip', 'city'
- `unit` ENUM: 'sqft', 'lf', 'each', 'hour', 'lot', 'custom'
- `price_low <= price_avg <= price_high` (CHECK constraint)

---

### 6. `estimates`
Stores estimate/quote metadata and totals.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Estimate ID |
| `project_id` | UUID | NOT NULL, FOREIGN KEY → projects(id) | Associated project |
| `estimate_number` | VARCHAR(50) | UNIQUE | Auto-generated (e.g., EST-2024-001) |
| `version` | INTEGER | NOT NULL DEFAULT 1 | Version number (v1, v2, v3...) |
| `status` | VARCHAR(20) | DEFAULT 'draft' | draft, sent, approved, rejected, superseded |
| `service_type` | VARCHAR(100) | NOT NULL | flooring, painting, drywall, etc. |
| `scope_preference` | VARCHAR(20) | DEFAULT 'standard' | minimal, standard, comprehensive |
| `subtotal` | DECIMAL(12,2) | NOT NULL DEFAULT 0 | Sum of all line items (USD) |
| `tax_percent` | DECIMAL(5,2) | DEFAULT 0 | Tax rate applied (%) |
| `tax_amount` | DECIMAL(12,2) | DEFAULT 0 | Calculated tax (USD) |
| `margin_percent` | DECIMAL(5,2) | NOT NULL | Profit margin applied (%) |
| `margin_amount` | DECIMAL(12,2) | NOT NULL DEFAULT 0 | Calculated margin (USD) |
| `grand_total` | DECIMAL(12,2) | NOT NULL DEFAULT 0 | Final total (USD) |
| `estimate_notes` | TEXT | | User notes for this estimate |
| `exclusions` | TEXT | | What's NOT included |
| `assumptions` | TEXT | | Assumptions made (AI-generated + user edits) |
| `validity_days` | INTEGER | DEFAULT 30 | Valid for X days |
| `estimated_timeline_days` | INTEGER | | Estimated project duration (days) |
| `payment_terms` | TEXT | | Payment terms (e.g., "50% deposit") |
| `ai_confidence_score` | DECIMAL(5,2) | | AI confidence in quantities (0-100%) |
| `pdf_url` | TEXT | | URL to generated PDF (if saved) |
| `sent_at` | TIMESTAMPTZ | | When estimate was sent to client |
| `sent_method` | VARCHAR(50) | | email, whatsapp, sms, etc. |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Estimate creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_estimates_project_id` on `project_id`
- `idx_estimates_estimate_number` on `estimate_number` (UNIQUE)
- `idx_estimates_status` on `status`
- `idx_estimates_created_at` on `created_at DESC`

**RLS Policy:**
- Users can only access estimates for projects they own (join with projects table)

**Constraints:**
- `status` ENUM: 'draft', 'sent', 'approved', 'rejected', 'superseded'
- `scope_preference` ENUM: 'minimal', 'standard', 'comprehensive'

**Triggers:**
- Auto-generate `estimate_number` on INSERT (e.g., EST-2024-001)
- Auto-update `updated_at` on UPDATE

---

### 7. `line_items`
Stores individual line items within an estimate.

| Column | Type | Constraints | Description |
|--------|------|-------------|-------------|
| `id` | UUID | PRIMARY KEY | Line item ID |
| `estimate_id` | UUID | NOT NULL, FOREIGN KEY → estimates(id) ON DELETE CASCADE | Associated estimate |
| `category` | VARCHAR(100) | NOT NULL | Preparation, Removal, Installation, etc. |
| `description` | TEXT | NOT NULL | Detailed description of work |
| `unit` | VARCHAR(20) | NOT NULL | sqft, lf, each, hour, lot |
| `quantity` | DECIMAL(10,2) | NOT NULL | Quantity (can be decimal, e.g., 125.50 sqft) |
| `unit_price` | DECIMAL(10,2) | NOT NULL | Price per unit (USD) |
| `subtotal` | DECIMAL(12,2) | NOT NULL | quantity × unit_price (USD) |
| `is_labor` | BOOLEAN | DEFAULT TRUE | Labor vs. material (for breakdown) |
| `ai_generated` | BOOLEAN | DEFAULT FALSE | Was this AI-generated or user-added? |
| `ai_confidence_score` | DECIMAL(5,2) | | AI confidence for this line (0-100%) |
| `display_order` | INTEGER | NOT NULL DEFAULT 0 | Sort order |
| `created_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Line item creation timestamp |
| `updated_at` | TIMESTAMPTZ | NOT NULL DEFAULT NOW() | Last update timestamp |

**Indexes:**
- `idx_line_items_estimate_id` on `estimate_id`
- `idx_line_items_display_order` on `display_order`

**RLS Policy:**
- Users can only access line items for estimates they own (join with estimates + projects)

**Constraints:**
- `unit` ENUM: 'sqft', 'lf', 'each', 'hour', 'lot', 'custom'
- `subtotal` = `quantity * unit_price` (can be enforced with triggers or app logic)

**Triggers:**
- Auto-calculate `subtotal` on INSERT/UPDATE
- Update parent `estimates.subtotal` when line items change

---

## ADDITIONAL TABLES (FUTURE / OPTIONAL)

### 8. `templates` (Future v1.1)
Pre-built estimate templates for common job types.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Template ID |
| `user_id` | UUID | NULL for system templates, user_id for custom |
| `template_name` | VARCHAR(255) | e.g., "Standard Bathroom Remodel" |
| `service_type` | VARCHAR(100) | flooring, painting, etc. |
| `line_items_json` | JSONB | Pre-configured line items |
| `created_at` | TIMESTAMPTZ | |

---

### 9. `activity_log` (Future v1.1)
Audit trail for critical actions.

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Log entry ID |
| `user_id` | UUID | User who performed action |
| `action_type` | VARCHAR(50) | created, updated, deleted, sent, etc. |
| `entity_type` | VARCHAR(50) | project, estimate, client, etc. |
| `entity_id` | UUID | ID of affected entity |
| `details` | JSONB | Additional action details |
| `created_at` | TIMESTAMPTZ | |

---

## VIEWS (OPTIONAL CONVENIENCE QUERIES)

### View: `estimates_with_project_info`
Joins estimates with project and client data for easier querying.

```sql
CREATE VIEW estimates_with_project_info AS
SELECT
  e.id AS estimate_id,
  e.estimate_number,
  e.version,
  e.status,
  e.grand_total,
  e.created_at,
  p.id AS project_id,
  p.project_name,
  p.property_address_street,
  p.property_city,
  p.property_zip,
  c.id AS client_id,
  c.full_name AS client_name,
  c.phone AS client_phone,
  c.email AS client_email,
  u.id AS user_id
FROM estimates e
JOIN projects p ON e.project_id = p.id
JOIN clients c ON p.client_id = c.id
JOIN users u ON p.user_id = u.id;
```

---

## DATABASE FUNCTIONS

### Function: `generate_estimate_number()`
Auto-generates sequential estimate numbers.

```sql
CREATE OR REPLACE FUNCTION generate_estimate_number(user_uuid UUID)
RETURNS VARCHAR(50) AS $$
DECLARE
  next_num INTEGER;
  year_str VARCHAR(4);
BEGIN
  year_str := TO_CHAR(NOW(), 'YYYY');

  SELECT COALESCE(MAX(CAST(SUBSTRING(estimate_number FROM 'EST-\d{4}-(\d+)') AS INTEGER)), 0) + 1
  INTO next_num
  FROM estimates e
  JOIN projects p ON e.project_id = p.id
  WHERE p.user_id = user_uuid
    AND e.estimate_number LIKE 'EST-' || year_str || '-%';

  RETURN 'EST-' || year_str || '-' || LPAD(next_num::TEXT, 3, '0');
END;
$$ LANGUAGE plpgsql;
```

**Usage:** Called automatically in trigger before INSERT on `estimates`.

---

### Function: `update_estimate_totals()`
Recalculates estimate totals when line items change.

```sql
CREATE OR REPLACE FUNCTION update_estimate_totals()
RETURNS TRIGGER AS $$
DECLARE
  new_subtotal DECIMAL(12,2);
  est_tax_percent DECIMAL(5,2);
  est_margin_percent DECIMAL(5,2);
  new_tax DECIMAL(12,2);
  new_margin DECIMAL(12,2);
  new_grand_total DECIMAL(12,2);
BEGIN
  -- Calculate subtotal from all line items
  SELECT COALESCE(SUM(subtotal), 0)
  INTO new_subtotal
  FROM line_items
  WHERE estimate_id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Get tax and margin percentages from estimate
  SELECT tax_percent, margin_percent
  INTO est_tax_percent, est_margin_percent
  FROM estimates
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  -- Calculate tax and margin
  new_tax := new_subtotal * (est_tax_percent / 100);
  new_margin := (new_subtotal + new_tax) * (est_margin_percent / 100);
  new_grand_total := new_subtotal + new_tax + new_margin;

  -- Update estimate totals
  UPDATE estimates
  SET
    subtotal = new_subtotal,
    tax_amount = new_tax,
    margin_amount = new_margin,
    grand_total = new_grand_total,
    updated_at = NOW()
  WHERE id = COALESCE(NEW.estimate_id, OLD.estimate_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
```

**Trigger:**
```sql
CREATE TRIGGER trigger_update_estimate_totals
AFTER INSERT OR UPDATE OR DELETE ON line_items
FOR EACH ROW
EXECUTE FUNCTION update_estimate_totals();
```

---

## ROW-LEVEL SECURITY (RLS) POLICIES

### Supabase RLS Example

```sql
-- Enable RLS on all tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE media ENABLE ROW LEVEL SECURITY;
ALTER TABLE price_tables ENABLE ROW LEVEL SECURITY;
ALTER TABLE estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE line_items ENABLE ROW LEVEL SECURITY;

-- Users can only access their own user record
CREATE POLICY users_policy ON users
  FOR ALL USING (id = auth.uid());

-- Users can only access their own clients
CREATE POLICY clients_policy ON clients
  FOR ALL USING (user_id = auth.uid());

-- Users can only access their own projects
CREATE POLICY projects_policy ON projects
  FOR ALL USING (user_id = auth.uid());

-- Users can only access media for their own projects
CREATE POLICY media_policy ON media
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can only access their own price tables
CREATE POLICY price_tables_policy ON price_tables
  FOR ALL USING (user_id = auth.uid());

-- Users can only access estimates for their own projects
CREATE POLICY estimates_policy ON estimates
  FOR ALL USING (
    project_id IN (
      SELECT id FROM projects WHERE user_id = auth.uid()
    )
  );

-- Users can only access line items for their own estimates
CREATE POLICY line_items_policy ON line_items
  FOR ALL USING (
    estimate_id IN (
      SELECT e.id FROM estimates e
      JOIN projects p ON e.project_id = p.id
      WHERE p.user_id = auth.uid()
    )
  );
```

---

## INDEXES SUMMARY

**Critical indexes for performance:**

```sql
-- Users
CREATE INDEX idx_users_email ON users(email);

-- Clients
CREATE INDEX idx_clients_user_id ON clients(user_id);
CREATE INDEX idx_clients_full_name ON clients(full_name);

-- Projects
CREATE INDEX idx_projects_user_id ON projects(user_id);
CREATE INDEX idx_projects_client_id ON projects(client_id);
CREATE INDEX idx_projects_status ON projects(status);
CREATE INDEX idx_projects_created_at ON projects(created_at DESC);

-- Media
CREATE INDEX idx_media_project_id ON media(project_id);
CREATE INDEX idx_media_display_order ON media(display_order);

-- Price Tables
CREATE INDEX idx_price_tables_user_id ON price_tables(user_id);
CREATE INDEX idx_price_tables_region_key ON price_tables(region_key);
CREATE INDEX idx_price_tables_service_category ON price_tables(service_category);
CREATE INDEX idx_price_tables_lookup ON price_tables(user_id, region_key, service_category, item_description);

-- Estimates
CREATE INDEX idx_estimates_project_id ON estimates(project_id);
CREATE UNIQUE INDEX idx_estimates_estimate_number ON estimates(estimate_number);
CREATE INDEX idx_estimates_status ON estimates(status);
CREATE INDEX idx_estimates_created_at ON estimates(created_at DESC);

-- Line Items
CREATE INDEX idx_line_items_estimate_id ON line_items(estimate_id);
CREATE INDEX idx_line_items_display_order ON line_items(display_order);
```

---

## SAMPLE DATA (FOR TESTING)

### Sample User
```sql
INSERT INTO users (id, email, company_name, company_phone, company_email, default_city, default_zip, default_county, default_labor_rate, default_margin_percent, default_tax_percent)
VALUES
('550e8400-e29b-41d4-a716-446655440000', 'john@abccontractors.com', 'ABC Contractors LLC', '(305) 555-1234', 'info@abccontractors.com', 'Miami', '33101', 'Miami-Dade', 50.00, 20.00, 7.00);
```

### Sample Client
```sql
INSERT INTO clients (id, user_id, full_name, phone, email, address_street, address_city, address_state, address_zip)
VALUES
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440000', 'Jane Smith', '(305) 555-6789', 'jane.smith@example.com', '123 Ocean Dr', 'Miami Beach', 'FL', '33139');
```

### Sample Project
```sql
INSERT INTO projects (id, user_id, client_id, project_name, property_address_street, property_city, property_state, property_zip, property_county, property_type, access_level, floor_level, has_elevator, parking_type, job_notes)
VALUES
('770e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440000', '660e8400-e29b-41d4-a716-446655440001', 'Bathroom Remodel - Smith Residence', '123 Ocean Dr', 'Miami Beach', 'FL', '33139', 'Miami-Dade', 'Residential', 'Easy', 0, FALSE, 'Easy', 'Master bathroom - replace tile flooring, update fixtures');
```

### Sample Price Table Entries
```sql
INSERT INTO price_tables (id, user_id, region_key, region_type, service_category, item_description, unit, price_low, price_avg, price_high)
VALUES
('880e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440000', 'Miami-Dade', 'county', 'Flooring', 'LVP installation', 'sqft', 4.50, 6.00, 8.00),
('880e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440000', 'Miami-Dade', 'county', 'Flooring', 'Tile removal', 'sqft', 2.00, 3.00, 4.50),
('880e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440000', 'Miami-Dade', 'county', 'Flooring', 'Subfloor prep/repair', 'sqft', 1.50, 2.50, 4.00);
```

---

## MIGRATION STRATEGY

### Phase 1: Core Tables (Week 1)
- `users`, `clients`, `projects`, `media`

### Phase 2: Pricing & Estimates (Week 2)
- `price_tables`, `estimates`, `line_items`

### Phase 3: Triggers & Functions (Week 3)
- Auto-generate estimate numbers
- Auto-update totals
- RLS policies

### Phase 4: Optimization (Week 4)
- Add indexes
- Create views
- Performance testing

---

*End of Database Schema - PhotoQuote AI MVP v1.0*
