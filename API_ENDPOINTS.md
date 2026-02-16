# PhotoQuote AI - API Endpoints Documentation

---

## API OVERVIEW

**Base URL:** `https://api.photoquote-ai.com/v1` (or Supabase auto-generated URL)
**Authentication:** Bearer token (JWT) in `Authorization` header
**Content-Type:** `application/json`
**Response Format:** JSON

---

## AUTHENTICATION ENDPOINTS

### POST `/auth/signup`
Create a new user account.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!",
  "company_name": "ABC Contractors LLC",
  "company_phone": "(305) 555-1234",
  "default_city": "Miami",
  "default_zip": "33101",
  "default_labor_rate": 50.00,
  "default_margin_percent": 20.00
}
```

**Response (201 Created):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "company_name": "ABC Contractors LLC"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 604800
}
```

---

### POST `/auth/login`
Sign in with email and password.

**Request Body:**
```json
{
  "email": "john@example.com",
  "password": "SecurePass123!"
}
```

**Response (200 OK):**
```json
{
  "user": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "email": "john@example.com",
    "company_name": "ABC Contractors LLC"
  },
  "access_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
  "expires_in": 604800
}
```

---

### POST `/auth/login/google`
Sign in with Google OAuth.

**Request Body:**
```json
{
  "id_token": "google_oauth_id_token_here"
}
```

**Response:** Same as `/auth/login`

---

### POST `/auth/login/apple`
Sign in with Apple OAuth.

**Request Body:**
```json
{
  "id_token": "apple_oauth_id_token_here"
}
```

**Response:** Same as `/auth/login`

---

### POST `/auth/refresh`
Refresh access token.

**Request Body:**
```json
{
  "refresh_token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

**Response (200 OK):**
```json
{
  "access_token": "new_access_token_here",
  "expires_in": 604800
}
```

---

### POST `/auth/reset-password`
Request password reset email.

**Request Body:**
```json
{
  "email": "john@example.com"
}
```

**Response (200 OK):**
```json
{
  "message": "Password reset email sent"
}
```

---

### POST `/auth/logout`
Logout (invalidate refresh token).

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Logged out successfully"
}
```

---

## USER / COMPANY PROFILE ENDPOINTS

### GET `/users/me`
Get current user profile.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "email": "john@example.com",
  "company_name": "ABC Contractors LLC",
  "company_phone": "(305) 555-1234",
  "company_email": "info@abccontractors.com",
  "logo_url": "https://storage.photoquote.com/logos/abc-logo.png",
  "default_city": "Miami",
  "default_state": "FL",
  "default_zip": "33101",
  "default_county": "Miami-Dade",
  "default_labor_rate": 50.00,
  "default_margin_percent": 20.00,
  "default_tax_percent": 7.00,
  "pdf_terms_template": "Payment due within 30 days...",
  "created_at": "2024-01-15T10:30:00Z",
  "updated_at": "2024-02-01T14:20:00Z"
}
```

---

### PATCH `/users/me`
Update user profile.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body (partial update):**
```json
{
  "company_name": "ABC Contractors & Sons LLC",
  "company_phone": "(305) 555-9999",
  "default_labor_rate": 55.00,
  "pdf_terms_template": "Updated payment terms..."
}
```

**Response (200 OK):** Updated user object (same as GET `/users/me`)

---

### POST `/users/me/logo`
Upload company logo.

**Headers:**
- `Authorization: Bearer {access_token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
file: [binary image data, max 2MB, PNG/JPG]
```

**Response (200 OK):**
```json
{
  "logo_url": "https://storage.photoquote.com/logos/abc-logo-2024.png"
}
```

---

### DELETE `/users/me`
Delete user account (soft delete or hard delete).

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Account deleted successfully"
}
```

---

## CLIENT ENDPOINTS

### GET `/clients`
List all clients for the current user.

**Headers:** `Authorization: Bearer {access_token}`

**Query Parameters:**
- `page` (integer, default 1)
- `limit` (integer, default 50, max 100)
- `search` (string, searches name/phone/email)
- `sort` (string: `name_asc`, `name_desc`, `created_asc`, `created_desc`)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "660e8400-e29b-41d4-a716-446655440001",
      "full_name": "Jane Smith",
      "phone": "(305) 555-6789",
      "email": "jane.smith@example.com",
      "address_street": "123 Ocean Dr",
      "address_city": "Miami Beach",
      "address_state": "FL",
      "address_zip": "33139",
      "notes": "Prefers morning appointments",
      "created_at": "2024-01-20T09:15:00Z",
      "updated_at": "2024-01-20T09:15:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### GET `/clients/:id`
Get a single client by ID.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):** Single client object (same structure as list item)

**Error (404 Not Found):**
```json
{
  "error": "Client not found"
}
```

---

### POST `/clients`
Create a new client.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "full_name": "John Doe",
  "phone": "(305) 555-1111",
  "email": "john.doe@example.com",
  "address_street": "456 Beach Ave",
  "address_city": "Miami",
  "address_state": "FL",
  "address_zip": "33101",
  "notes": "Referred by Jane Smith"
}
```

**Response (201 Created):** Created client object

---

### PATCH `/clients/:id`
Update a client.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body (partial update):**
```json
{
  "phone": "(305) 555-2222",
  "notes": "Updated contact info"
}
```

**Response (200 OK):** Updated client object

---

### DELETE `/clients/:id`
Delete a client.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Client deleted successfully"
}
```

---

### GET `/clients/:id/projects`
Get all projects for a specific client.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "project_name": "Bathroom Remodel",
      "property_address_street": "123 Ocean Dr",
      "status": "active",
      "created_at": "2024-02-01T10:00:00Z"
    }
  ]
}
```

---

## PROJECT ENDPOINTS

### GET `/projects`
List all projects for the current user.

**Headers:** `Authorization: Bearer {access_token}`

**Query Parameters:**
- `page`, `limit` (pagination)
- `client_id` (filter by client)
- `status` (filter: `draft`, `active`, `completed`, `archived`)
- `search` (search project name/address)
- `sort` (string: `created_asc`, `created_desc`, `name_asc`)

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "770e8400-e29b-41d4-a716-446655440002",
      "client_id": "660e8400-e29b-41d4-a716-446655440001",
      "client_name": "Jane Smith",
      "project_name": "Bathroom Remodel - Smith Residence",
      "property_address_street": "123 Ocean Dr",
      "property_city": "Miami Beach",
      "property_state": "FL",
      "property_zip": "33139",
      "property_county": "Miami-Dade",
      "property_type": "Residential",
      "access_level": "Easy",
      "floor_level": 0,
      "has_elevator": false,
      "parking_type": "Easy",
      "job_notes": "Master bathroom remodel",
      "desired_start_date": "2024-03-01",
      "deadline_date": null,
      "status": "draft",
      "created_at": "2024-02-01T10:00:00Z",
      "updated_at": "2024-02-01T10:00:00Z"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 50,
    "total": 1,
    "total_pages": 1
  }
}
```

---

### GET `/projects/:id`
Get a single project by ID.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):** Single project object + related data

```json
{
  "id": "770e8400-e29b-41d4-a716-446655440002",
  "client": {
    "id": "660e8400-e29b-41d4-a716-446655440001",
    "full_name": "Jane Smith",
    "phone": "(305) 555-6789",
    "email": "jane.smith@example.com"
  },
  "project_name": "Bathroom Remodel - Smith Residence",
  "property_address_street": "123 Ocean Dr",
  "property_city": "Miami Beach",
  "property_state": "FL",
  "property_zip": "33139",
  "property_county": "Miami-Dade",
  "property_type": "Residential",
  "access_level": "Easy",
  "floor_level": 0,
  "has_elevator": false,
  "parking_type": "Easy",
  "job_notes": "Master bathroom - full remodel",
  "desired_start_date": "2024-03-01",
  "deadline_date": null,
  "status": "draft",
  "media_count": 12,
  "estimates_count": 1,
  "created_at": "2024-02-01T10:00:00Z",
  "updated_at": "2024-02-01T10:00:00Z"
}
```

---

### POST `/projects`
Create a new project.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "client_id": "660e8400-e29b-41d4-a716-446655440001",
  "project_name": "Kitchen Remodel",
  "property_address_street": "789 Sunset Blvd",
  "property_city": "Miami",
  "property_state": "FL",
  "property_zip": "33101",
  "property_county": "Miami-Dade",
  "property_type": "Residential",
  "access_level": "Medium",
  "floor_level": 2,
  "has_elevator": false,
  "parking_type": "Paid",
  "job_notes": "Full kitchen renovation - cabinets, countertops, flooring",
  "desired_start_date": "2024-04-01"
}
```

**Response (201 Created):** Created project object

---

### PATCH `/projects/:id`
Update a project.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body (partial update):**
```json
{
  "status": "active",
  "job_notes": "Updated scope to include backsplash"
}
```

**Response (200 OK):** Updated project object

---

### DELETE `/projects/:id`
Delete a project (also deletes all media and estimates).

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Project deleted successfully"
}
```

---

## MEDIA ENDPOINTS

### GET `/projects/:project_id/media`
Get all media for a project.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440010",
      "project_id": "770e8400-e29b-41d4-a716-446655440002",
      "media_type": "photo",
      "file_url": "https://storage.photoquote.com/projects/770e.../photo1.jpg",
      "file_size_bytes": 2457600,
      "mime_type": "image/jpeg",
      "tags": ["bathroom", "flooring", "tile"],
      "manual_sqft": 75.0,
      "manual_linear_ft": null,
      "manual_unit_count": null,
      "measurement_notes": "Main bathroom area",
      "display_order": 1,
      "created_at": "2024-02-01T11:00:00Z"
    }
  ]
}
```

---

### POST `/projects/:project_id/media`
Upload photos/videos to a project.

**Headers:**
- `Authorization: Bearer {access_token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
files: [array of image/video files, max 30 photos + 1 video]
tags: ["bathroom", "flooring"] (optional JSON array)
manual_sqft: 75.0 (optional)
```

**Response (201 Created):**
```json
{
  "uploaded": [
    {
      "id": "880e8400-e29b-41d4-a716-446655440010",
      "file_url": "https://storage.photoquote.com/projects/.../photo1.jpg",
      "media_type": "photo"
    }
  ]
}
```

---

### PATCH `/media/:id`
Update media metadata (tags, measurements, order).

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "tags": ["bathroom", "flooring", "before"],
  "manual_sqft": 80.0,
  "measurement_notes": "Corrected measurement",
  "display_order": 5
}
```

**Response (200 OK):** Updated media object

---

### DELETE `/media/:id`
Delete a photo or video.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Media deleted successfully"
}
```

---

## PRICE TABLE ENDPOINTS

### GET `/price-tables`
Get all price tables for the current user.

**Headers:** `Authorization: Bearer {access_token}`

**Query Parameters:**
- `region_key` (filter by region, e.g., "Miami-Dade" or "33101")
- `service_category` (filter by category, e.g., "Flooring")

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "990e8400-e29b-41d4-a716-446655440020",
      "region_key": "Miami-Dade",
      "region_type": "county",
      "service_category": "Flooring",
      "item_description": "LVP installation",
      "unit": "sqft",
      "price_low": 4.50,
      "price_avg": 6.00,
      "price_high": 8.00,
      "notes": "Includes adhesive, no underlayment",
      "updated_at": "2024-01-15T10:00:00Z"
    }
  ]
}
```

---

### POST `/price-tables`
Add a new price entry.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "region_key": "Broward",
  "region_type": "county",
  "service_category": "Painting",
  "item_description": "Interior wall painting (2 coats)",
  "unit": "sqft",
  "price_low": 2.00,
  "price_avg": 3.50,
  "price_high": 5.00,
  "notes": "Includes primer, paint, labor"
}
```

**Response (201 Created):** Created price entry

---

### PATCH `/price-tables/:id`
Update a price entry.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "price_avg": 4.00,
  "price_high": 5.50,
  "notes": "Updated for 2024 pricing"
}
```

**Response (200 OK):** Updated price entry

---

### DELETE `/price-tables/:id`
Delete a price entry.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Price entry deleted successfully"
}
```

---

### POST `/price-tables/import`
Bulk import prices from CSV.

**Headers:**
- `Authorization: Bearer {access_token}`
- `Content-Type: multipart/form-data`

**Request Body:**
```
file: [CSV file with columns: region_key, service_category, item_description, unit, price_low, price_avg, price_high]
```

**Response (201 Created):**
```json
{
  "imported": 25,
  "errors": []
}
```

---

## ESTIMATE ENDPOINTS

### GET `/projects/:project_id/estimates`
Get all estimates for a project.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "data": [
    {
      "id": "aa0e8400-e29b-41d4-a716-446655440030",
      "project_id": "770e8400-e29b-41d4-a716-446655440002",
      "estimate_number": "EST-2024-001",
      "version": 1,
      "status": "draft",
      "service_type": "Flooring",
      "scope_preference": "standard",
      "subtotal": 2500.00,
      "tax_percent": 7.00,
      "tax_amount": 175.00,
      "margin_percent": 20.00,
      "margin_amount": 535.00,
      "grand_total": 3210.00,
      "validity_days": 30,
      "estimated_timeline_days": 3,
      "ai_confidence_score": 85.50,
      "created_at": "2024-02-01T12:00:00Z",
      "updated_at": "2024-02-01T14:30:00Z"
    }
  ]
}
```

---

### GET `/estimates/:id`
Get a single estimate by ID (includes line items).

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440030",
  "project": {
    "id": "770e8400-e29b-41d4-a716-446655440002",
    "project_name": "Bathroom Remodel - Smith Residence",
    "client_name": "Jane Smith",
    "property_address_street": "123 Ocean Dr",
    "property_city": "Miami Beach",
    "property_zip": "33139"
  },
  "estimate_number": "EST-2024-001",
  "version": 1,
  "status": "draft",
  "service_type": "Flooring",
  "scope_preference": "standard",
  "subtotal": 2500.00,
  "tax_percent": 7.00,
  "tax_amount": 175.00,
  "margin_percent": 20.00,
  "margin_amount": 535.00,
  "grand_total": 3210.00,
  "estimate_notes": "Bathroom floor replacement with LVP",
  "exclusions": "Does not include plumbing or electrical work",
  "assumptions": "Assumes subfloor is in good condition",
  "validity_days": 30,
  "estimated_timeline_days": 3,
  "payment_terms": "50% deposit, 50% upon completion",
  "ai_confidence_score": 85.50,
  "line_items": [
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440040",
      "category": "Preparation",
      "description": "Floor protection and prep",
      "unit": "sqft",
      "quantity": 75.00,
      "unit_price": 1.50,
      "subtotal": 112.50,
      "is_labor": true,
      "ai_generated": true,
      "ai_confidence_score": 90.00,
      "display_order": 1
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440041",
      "category": "Removal",
      "description": "Remove existing tile flooring",
      "unit": "sqft",
      "quantity": 75.00,
      "unit_price": 3.00,
      "subtotal": 225.00,
      "is_labor": true,
      "ai_generated": true,
      "ai_confidence_score": 95.00,
      "display_order": 2
    },
    {
      "id": "bb0e8400-e29b-41d4-a716-446655440042",
      "category": "Installation",
      "description": "Install LVP flooring",
      "unit": "sqft",
      "quantity": 75.00,
      "unit_price": 6.00,
      "subtotal": 450.00,
      "is_labor": false,
      "ai_generated": true,
      "ai_confidence_score": 88.00,
      "display_order": 3
    }
  ],
  "created_at": "2024-02-01T12:00:00Z",
  "updated_at": "2024-02-01T14:30:00Z"
}
```

---

### POST `/estimates/generate`
Generate a new AI estimate.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "project_id": "770e8400-e29b-41d4-a716-446655440002",
  "service_type": "Flooring",
  "scope_preference": "standard"
}
```

**Response (201 Created):**
```json
{
  "id": "aa0e8400-e29b-41d4-a716-446655440030",
  "status": "processing",
  "message": "Estimate generation started. Poll /estimates/:id for status."
}
```

**Alternative (Synchronous):**
If processing completes quickly (<10s), return full estimate object immediately (201 Created).

---

### PATCH `/estimates/:id`
Update an estimate (metadata and totals settings).

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "status": "sent",
  "tax_percent": 6.50,
  "margin_percent": 25.00,
  "estimate_notes": "Updated notes",
  "payment_terms": "Net 15 days"
}
```

**Response (200 OK):** Updated estimate object (recalculated totals)

---

### POST `/estimates/:id/recalculate`
Recalculate totals based on current line items and settings.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):** Updated estimate object with recalculated totals

---

### DELETE `/estimates/:id`
Delete an estimate.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Estimate deleted successfully"
}
```

---

### POST `/estimates/:id/duplicate`
Create a new version (duplicate) of an estimate.

**Headers:** `Authorization: Bearer {access_token}`

**Response (201 Created):** New estimate object (version incremented)

---

## LINE ITEM ENDPOINTS

### POST `/estimates/:estimate_id/line-items`
Add a new line item to an estimate.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "category": "Finishing",
  "description": "Apply sealant to LVP",
  "unit": "sqft",
  "quantity": 75.00,
  "unit_price": 1.00,
  "is_labor": true,
  "display_order": 10
}
```

**Response (201 Created):** Created line item + updated estimate totals

---

### PATCH `/line-items/:id`
Update a line item.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "quantity": 80.00,
  "unit_price": 1.25
}
```

**Response (200 OK):** Updated line item + updated estimate totals

---

### DELETE `/line-items/:id`
Delete a line item.

**Headers:** `Authorization: Bearer {access_token}`

**Response (200 OK):**
```json
{
  "message": "Line item deleted successfully"
}
```
(Also recalculates estimate totals)

---

## PDF GENERATION & SHARING ENDPOINTS

### POST `/estimates/:id/generate-pdf`
Generate a PDF for an estimate.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body (optional customization):**
```json
{
  "template": "modern",
  "show_unit_prices": true,
  "show_categories": true,
  "custom_footer": "Thank you for your business!"
}
```

**Response (200 OK):**
```json
{
  "pdf_url": "https://storage.photoquote.com/pdfs/EST-2024-001-v1.pdf",
  "expires_at": "2024-02-08T12:00:00Z"
}
```

---

### POST `/estimates/:id/send`
Send estimate PDF to client.

**Headers:** `Authorization: Bearer {access_token}`

**Request Body:**
```json
{
  "method": "email",
  "recipient_email": "jane.smith@example.com",
  "subject": "Estimate for Bathroom Remodel",
  "message": "Please review the attached estimate. Let me know if you have any questions."
}
```

**Response (200 OK):**
```json
{
  "message": "Estimate sent successfully via email",
  "sent_at": "2024-02-01T15:00:00Z"
}
```

---

## ANALYTICS / STATS ENDPOINTS (OPTIONAL MVP)

### GET `/stats/dashboard`
Get dashboard statistics.

**Headers:** `Authorization: Bearer {access_token}`

**Query Parameters:**
- `period` (string: `week`, `month`, `year`, default: `month`)

**Response (200 OK):**
```json
{
  "total_projects": 12,
  "total_estimates": 18,
  "estimates_this_month": 5,
  "total_estimate_value_this_month": 45600.00,
  "avg_estimate_value": 9120.00,
  "estimates_by_status": {
    "draft": 2,
    "sent": 3,
    "approved": 0,
    "rejected": 0
  }
}
```

---

## ERROR RESPONSES

All endpoints may return the following error responses:

### 400 Bad Request
```json
{
  "error": "Validation error",
  "details": {
    "email": ["Invalid email format"],
    "company_name": ["Required field"]
  }
}
```

### 401 Unauthorized
```json
{
  "error": "Unauthorized",
  "message": "Invalid or missing access token"
}
```

### 403 Forbidden
```json
{
  "error": "Forbidden",
  "message": "You do not have permission to access this resource"
}
```

### 404 Not Found
```json
{
  "error": "Not found",
  "message": "Resource not found"
}
```

### 429 Too Many Requests
```json
{
  "error": "Rate limit exceeded",
  "message": "Too many requests. Try again in 60 seconds.",
  "retry_after": 60
}
```

### 500 Internal Server Error
```json
{
  "error": "Internal server error",
  "message": "An unexpected error occurred. Please contact support."
}
```

---

## RATE LIMITING

**Limits (per user, per endpoint group):**
- Authentication: 10 requests/minute
- Read endpoints (GET): 100 requests/minute
- Write endpoints (POST/PATCH/DELETE): 50 requests/minute
- AI estimate generation: 10 requests/hour
- PDF generation: 20 requests/hour

**Headers returned:**
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1612345678
```

---

## WEBHOOKS (FUTURE)

### POST `/webhooks` (Future v1.1)
Register a webhook URL to receive events.

**Events:**
- `estimate.created`
- `estimate.sent`
- `estimate.approved`
- `project.created`

---

*End of API Endpoints Documentation - PhotoQuote AI MVP v1.0*
