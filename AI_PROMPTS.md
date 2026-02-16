# PhotoQuote AI - AI Prompt Templates & Examples

---

## AI SYSTEM OVERVIEW

**Purpose:** Analyze jobsite photos + project context to generate professional, itemized estimates with accurate quantities and pricing aligned to local Florida market rates.

**Critical Safety Rule:** AI must NEVER invent prices. It must ONLY use prices from the Local Price Table. If no pricing data exists, AI must return an error and prompt user to set up pricing first.

**AI Model:** GPT-4 Vision, Claude 3 Opus (with vision), or similar multimodal LLM

**Input:**
- Project details (address, ZIP, property type, access level, floor, elevator, parking)
- Service type (flooring, painting, drywall, etc.)
- 5–30 photos (jobsite conditions, areas to be worked on)
- Optional: user-provided measurements (sqft, linear ft, units)
- Local Price Table for the project's region (ZIP/county)

**Output:**
- Structured JSON with line items, quantities, pricing, totals, notes, assumptions

---

## SYSTEM PROMPT (CORE INSTRUCTIONS)

```
You are an AI assistant for PhotoQuote AI, a professional estimation tool for contractors in Florida, USA.

Your role is to analyze jobsite photos and project details to generate accurate, itemized estimates for home improvement and construction projects.

CRITICAL RULES:
1. NEVER invent or guess prices. You MUST use the Local Price Table provided. If no pricing data exists for a line item, mark it as "PRICE_MISSING" and explain what pricing data is needed.

2. If measurements are provided by the user, use those. If not, estimate quantities from photos and ALWAYS include a confidence score (0-100%). If confidence is <70%, flag the line item and recommend the user confirm measurements.

3. Generate professional, detailed line items organized by category:
   - Preparation & Protection
   - Demolition & Removal
   - Repair & Installation
   - Finishing & Cleanup
   - Haul-Away & Disposal

4. Apply adjustment multipliers based on project conditions:
   - Access level (Medium: +5-10%, Hard: +10-20%)
   - Floor level without elevator (add +10-30% based on floor number)
   - Parking difficulty (Paid: +$100-200 or +5%, Hard: +$200-300 or +10%)

5. Include exclusions and assumptions to set clear expectations.

6. Be conservative: it's better to overestimate slightly than to underestimate and lose money.

7. Always respond in valid JSON format matching the schema provided.

8. Use USD currency formatting: $1,000.00 (comma thousands, dot decimal).

9. All measurements in US imperial units: square feet (sqft), linear feet (lf), units (each), hours.

CONTEXT:
- Location: Florida, USA
- Currency: USD ($)
- Language: English
- Target users: contractors, handymen, home improvement companies
```

---

## USER PROMPT TEMPLATE

```
Generate a professional estimate for the following project:

PROJECT DETAILS:
- Project Name: {{project_name}}
- Client: {{client_name}}
- Property Address: {{property_address}}, {{city}}, {{state}} {{zip}}
- County: {{county}}
- Property Type: {{property_type}} (Residential/Commercial/Condo)
- Access Level: {{access_level}} (Easy/Medium/Hard)
- Floor Level: {{floor_level}} (0=Ground, 1-50=Floor number)
- Elevator Available: {{has_elevator}} (Yes/No)
- Parking: {{parking_type}} (Easy/Paid/Hard)
- Job Notes: {{job_notes}}

SERVICE TYPE: {{service_type}}
Scope Preference: {{scope_preference}} (minimal/standard/comprehensive)

PHOTOS:
{{#each photos}}
- Photo {{@index}}: {{this.tags}} {{#if this.manual_sqft}}(User provided: {{this.manual_sqft}} sqft){{/if}}
{{/each}}

{{#if user_measurements}}
USER-PROVIDED MEASUREMENTS:
- Square footage: {{user_measurements.sqft}}
- Linear feet: {{user_measurements.linear_ft}}
- Unit count: {{user_measurements.unit_count}}
- Notes: {{user_measurements.notes}}
{{/if}}

LOCAL PRICE TABLE (YOU MUST USE THESE PRICES):
{{#each price_table}}
- {{this.service_category}} - {{this.item_description}}: ${{this.price_low}}-${{this.price_high}}/{{this.unit}} (avg: ${{this.price_avg}})
{{/each}}

INSTRUCTIONS:
1. Analyze the photos to identify the scope of work for {{service_type}}.
2. Estimate quantities (sqft, linear ft, units) based on photos OR use user-provided measurements if available.
3. Break down the work into professional line items (prep, removal, install, finishing, cleanup).
4. For each line item, pull the unit price from the Local Price Table above. Use the "avg" price unless there's a reason to use low or high (explain in notes).
5. If a line item has no matching price in the table, mark unit_price as null and set a flag: "price_missing": true.
6. Apply adjustment multipliers for access, floor level, and parking.
7. Include confidence scores for estimated quantities (0-100%). If <70%, flag for user confirmation.
8. Add exclusions (what's NOT included) and assumptions (e.g., "assumes subfloor in good condition").
9. Suggest a realistic timeline (days or weeks).
10. Return the result as valid JSON matching the schema below.

IMPORTANT: Do NOT invent prices. If you cannot find a price in the Local Price Table, mark it as missing and explain what's needed.
```

---

## JSON OUTPUT SCHEMA

```json
{
  "estimate": {
    "service_type": "string (e.g., Flooring, Painting)",
    "ai_confidence_score": "number (0-100, overall confidence)",
    "line_items": [
      {
        "category": "string (Preparation, Removal, Installation, Finishing, Cleanup, Haul-Away)",
        "description": "string (detailed description of work)",
        "unit": "string (sqft, lf, each, hour, lot)",
        "quantity": "number (decimal, e.g., 125.50)",
        "unit_price": "number (USD, 2 decimals) or null if price missing",
        "subtotal": "number (quantity × unit_price, USD)",
        "is_labor": "boolean (true for labor, false for materials)",
        "ai_generated": "boolean (true if AI-generated, false if user-added)",
        "ai_confidence_score": "number (0-100, confidence in this line item)",
        "price_missing": "boolean (true if no price found in table)",
        "price_source": "string (e.g., 'Local Price Table: Flooring - LVP installation - avg')",
        "notes": "string (optional, e.g., 'Assumes standard 12x24 tile')"
      }
    ],
    "adjustments": [
      {
        "type": "string (access_multiplier, floor_multiplier, parking_fee)",
        "description": "string (e.g., 'Medium access adds 8% labor cost')",
        "amount": "number (USD or percentage)"
      }
    ],
    "subtotal": "number (sum of all line items, USD)",
    "total_with_adjustments": "number (subtotal + adjustments, USD)",
    "exclusions": [
      "string (e.g., 'Does not include electrical or plumbing work')",
      "string (e.g., 'Does not include furniture removal')"
    ],
    "assumptions": [
      "string (e.g., 'Assumes subfloor is in good condition')",
      "string (e.g., 'Assumes access to water and electricity on site')"
    ],
    "estimated_timeline": {
      "unit": "string (days or weeks)",
      "duration": "number (e.g., 3 for 3 days)"
    },
    "recommended_payment_terms": "string (e.g., '50% deposit, 50% upon completion')",
    "missing_info": [
      {
        "type": "string (measurement, pricing, clarification)",
        "description": "string (what's missing and why it's needed)",
        "question": "string (question to ask the user)"
      }
    ],
    "materials_list": [
      {
        "item": "string (e.g., 'LVP flooring planks')",
        "quantity": "number (estimated quantity needed)",
        "unit": "string (sqft, boxes, gallons, etc.)",
        "notes": "string (optional, e.g., 'Recommend purchasing 10% extra for waste')"
      }
    ]
  },
  "metadata": {
    "generated_at": "ISO 8601 timestamp",
    "model": "string (e.g., GPT-4 Vision)",
    "version": "string (e.g., 1.0)"
  }
}
```

---

## EXAMPLE AI INTERACTION

### Input (User Prompt)

```
Generate a professional estimate for the following project:

PROJECT DETAILS:
- Project Name: Bathroom Remodel - Smith Residence
- Client: Jane Smith
- Property Address: 123 Ocean Dr, Miami Beach, FL 33139
- County: Miami-Dade
- Property Type: Residential
- Access Level: Easy
- Floor Level: 0 (Ground)
- Elevator Available: No
- Parking: Easy
- Job Notes: Master bathroom - replace tile flooring with LVP

SERVICE TYPE: Flooring
Scope Preference: standard

PHOTOS:
- Photo 1: bathroom, flooring, tile (damaged tile, grout lines visible)
- Photo 2: bathroom, flooring (corner view, shower threshold visible)
- Photo 3: bathroom, walls (vanity and toilet visible, approx 8x10 ft room)

USER-PROVIDED MEASUREMENTS:
- Square footage: 75 sqft
- Notes: Measured by client, excluding shower area

LOCAL PRICE TABLE (YOU MUST USE THESE PRICES):
- Flooring - Floor protection and prep: $1.00-$2.00/sqft (avg: $1.50)
- Flooring - Tile removal: $2.00-$4.50/sqft (avg: $3.00)
- Flooring - Subfloor prep/repair: $1.50-$4.00/sqft (avg: $2.50)
- Flooring - LVP installation: $4.50-$8.00/sqft (avg: $6.00)
- Flooring - Trim/transition strips: $8.00-$15.00/lf (avg: $12.00)
- Flooring - Cleanup and haul-away: $0.50-$1.50/sqft (avg: $1.00)

INSTRUCTIONS:
[same as template above]
```

---

### Output (AI JSON Response)

```json
{
  "estimate": {
    "service_type": "Flooring",
    "ai_confidence_score": 92,
    "line_items": [
      {
        "category": "Preparation",
        "description": "Floor protection and prep work",
        "unit": "sqft",
        "quantity": 75.0,
        "unit_price": 1.50,
        "subtotal": 112.50,
        "is_labor": true,
        "ai_generated": true,
        "ai_confidence_score": 95,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Floor protection and prep - avg",
        "notes": "Protect vanity, toilet, and doorways during work"
      },
      {
        "category": "Removal",
        "description": "Remove existing ceramic tile flooring and old grout",
        "unit": "sqft",
        "quantity": 75.0,
        "unit_price": 3.00,
        "subtotal": 225.00,
        "is_labor": true,
        "ai_generated": true,
        "ai_confidence_score": 98,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Tile removal - avg",
        "notes": "Tile appears to be standard 12x12 ceramic"
      },
      {
        "category": "Preparation",
        "description": "Subfloor inspection and minor repair/leveling",
        "unit": "sqft",
        "quantity": 75.0,
        "unit_price": 2.50,
        "subtotal": 187.50,
        "is_labor": true,
        "ai_generated": true,
        "ai_confidence_score": 85,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Subfloor prep/repair - avg",
        "notes": "Assumes minor leveling only; major subfloor damage not visible in photos"
      },
      {
        "category": "Installation",
        "description": "Install luxury vinyl plank (LVP) flooring",
        "unit": "sqft",
        "quantity": 75.0,
        "unit_price": 6.00,
        "subtotal": 450.00,
        "is_labor": false,
        "ai_generated": true,
        "ai_confidence_score": 90,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - LVP installation - avg",
        "notes": "Includes adhesive and installation labor"
      },
      {
        "category": "Finishing",
        "description": "Install trim and transition strips (doorway and shower threshold)",
        "unit": "lf",
        "quantity": 12.0,
        "unit_price": 12.00,
        "subtotal": 144.00,
        "is_labor": false,
        "ai_generated": true,
        "ai_confidence_score": 80,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Trim/transition strips - avg",
        "notes": "Estimated 12 lf based on room perimeter at doorway and shower"
      },
      {
        "category": "Cleanup",
        "description": "Final cleanup and debris haul-away",
        "unit": "sqft",
        "quantity": 75.0,
        "unit_price": 1.00,
        "subtotal": 75.00,
        "is_labor": true,
        "ai_generated": true,
        "ai_confidence_score": 95,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Cleanup and haul-away - avg",
        "notes": "Includes disposal of old tile and debris"
      }
    ],
    "adjustments": [],
    "subtotal": 1194.00,
    "total_with_adjustments": 1194.00,
    "exclusions": [
      "Does not include plumbing work (toilet removal/reinstallation)",
      "Does not include electrical work or fixture replacement",
      "Does not include painting or wall repair",
      "Does not include subfloor replacement if major damage is found"
    ],
    "assumptions": [
      "Assumes subfloor is in good condition with only minor leveling needed",
      "Assumes standard LVP material (mid-range quality)",
      "Assumes toilet will be left in place (work around it) or client will arrange removal",
      "Assumes access to water and electricity on site",
      "Measurement of 75 sqft provided by client is accurate"
    ],
    "estimated_timeline": {
      "unit": "days",
      "duration": 2
    },
    "recommended_payment_terms": "50% deposit to start work, 50% upon completion and client approval",
    "missing_info": [
      {
        "type": "clarification",
        "description": "Need to confirm if toilet removal and reinstallation is required",
        "question": "Should we include toilet removal and reinstallation in this estimate? (Add $150-$250 if yes)"
      }
    ],
    "materials_list": [
      {
        "item": "Luxury vinyl plank (LVP) flooring",
        "quantity": 85,
        "unit": "sqft",
        "notes": "75 sqft + 10 sqft for waste/cuts (recommended 10-15% overage)"
      },
      {
        "item": "LVP adhesive",
        "quantity": 2,
        "unit": "gallons",
        "notes": "Approx 1 gallon per 40 sqft"
      },
      {
        "item": "Transition strips and trim",
        "quantity": 12,
        "unit": "linear feet",
        "notes": "Color-matched to LVP selection"
      },
      {
        "item": "Floor leveling compound (if needed)",
        "quantity": 1,
        "unit": "bag",
        "notes": "Optional, based on subfloor inspection"
      }
    ]
  },
  "metadata": {
    "generated_at": "2024-02-01T12:30:00Z",
    "model": "GPT-4 Vision",
    "version": "1.0"
  }
}
```

---

## EXAMPLE: MISSING PRICING DATA

### Input (No Price Table Provided)

```
[same project details as above]

LOCAL PRICE TABLE (YOU MUST USE THESE PRICES):
[EMPTY - no pricing data for Miami-Dade / Flooring]

INSTRUCTIONS:
[same as template]
```

---

### Output (AI Response - Error State)

```json
{
  "estimate": {
    "service_type": "Flooring",
    "ai_confidence_score": 0,
    "line_items": [],
    "adjustments": [],
    "subtotal": 0,
    "total_with_adjustments": 0,
    "exclusions": [],
    "assumptions": [],
    "estimated_timeline": null,
    "recommended_payment_terms": null,
    "missing_info": [
      {
        "type": "pricing",
        "description": "No pricing data found for Miami-Dade County / Flooring services",
        "question": "Please set up a Local Price Table for this region before generating an estimate."
      }
    ],
    "materials_list": []
  },
  "metadata": {
    "generated_at": "2024-02-01T12:30:00Z",
    "model": "GPT-4 Vision",
    "version": "1.0"
  },
  "error": {
    "code": "PRICE_TABLE_MISSING",
    "message": "Cannot generate estimate: No pricing data found for region 'Miami-Dade' and service type 'Flooring'. Please create a Local Price Table first.",
    "action_required": "create_price_table",
    "suggested_regions": ["Broward County", "Palm Beach County", "Generic Florida Template"]
  }
}
```

---

## EXAMPLE: LOW CONFIDENCE (NEEDS USER CONFIRMATION)

### Input (Photos are blurry, no measurements provided)

```
[same project details, but NO user-provided measurements]

PHOTOS:
- Photo 1: bathroom, flooring (blurry, poor lighting)
- Photo 2: bathroom, flooring (corner visible, scale unclear)

LOCAL PRICE TABLE:
[same as above]
```

---

### Output (AI Response - Low Confidence)

```json
{
  "estimate": {
    "service_type": "Flooring",
    "ai_confidence_score": 55,
    "line_items": [
      {
        "category": "Preparation",
        "description": "Floor protection and prep work",
        "unit": "sqft",
        "quantity": 60.0,
        "unit_price": 1.50,
        "subtotal": 90.00,
        "is_labor": true,
        "ai_generated": true,
        "ai_confidence_score": 50,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Floor protection and prep - avg",
        "notes": "⚠️ LOW CONFIDENCE: Photo quality is poor. Estimated 60 sqft based on visible vanity and toilet, but recommend user confirm actual square footage."
      },
      {
        "category": "Removal",
        "description": "Remove existing tile flooring",
        "unit": "sqft",
        "quantity": 60.0,
        "unit_price": 3.00,
        "subtotal": 180.00,
        "is_labor": true,
        "ai_generated": true,
        "ai_confidence_score": 50,
        "price_missing": false,
        "price_source": "Local Price Table: Flooring - Tile removal - avg",
        "notes": "⚠️ LOW CONFIDENCE: Cannot accurately estimate area from photos."
      }
    ],
    "adjustments": [],
    "subtotal": 270.00,
    "total_with_adjustments": 270.00,
    "exclusions": [
      "Does not include plumbing, electrical, or wall work"
    ],
    "assumptions": [
      "Assumes bathroom is approximately 60 sqft (rough estimate)",
      "Assumes subfloor in good condition"
    ],
    "estimated_timeline": {
      "unit": "days",
      "duration": 2
    },
    "recommended_payment_terms": "50% deposit, 50% upon completion",
    "missing_info": [
      {
        "type": "measurement",
        "description": "Cannot accurately estimate square footage from photos (blurry, poor lighting)",
        "question": "Please provide the actual square footage of the bathroom floor area to ensure an accurate estimate."
      },
      {
        "type": "clarification",
        "description": "Cannot see full bathroom layout (shower, tub not visible)",
        "question": "Does the estimate include flooring inside a shower/tub area, or only the main floor?"
      }
    ],
    "materials_list": []
  },
  "metadata": {
    "generated_at": "2024-02-01T12:30:00Z",
    "model": "GPT-4 Vision",
    "version": "1.0"
  },
  "warnings": [
    {
      "code": "LOW_CONFIDENCE",
      "message": "Overall confidence is 55% (below 70% threshold). Recommend user confirms measurements before finalizing estimate.",
      "severity": "high"
    }
  ]
}
```

---

## PRICING RULES ENGINE (POST-PROCESSING)

After AI generates line items, apply these adjustment rules:

### 1. Access Level Multiplier
```python
if access_level == "Medium":
    labor_multiplier = 1.08  # +8%
elif access_level == "Hard":
    labor_multiplier = 1.15  # +15%
else:
    labor_multiplier = 1.0   # Easy, no adjustment

for line_item in line_items:
    if line_item.is_labor:
        line_item.unit_price *= labor_multiplier
        line_item.subtotal = line_item.quantity * line_item.unit_price
```

### 2. Floor Level Multiplier (if no elevator)
```python
if floor_level > 0 and not has_elevator:
    if floor_level <= 2:
        floor_multiplier = 1.10  # +10%
    elif floor_level <= 5:
        floor_multiplier = 1.20  # +20%
    else:
        floor_multiplier = 1.30  # +30%

    for line_item in line_items:
        if line_item.is_labor:
            line_item.unit_price *= floor_multiplier
            line_item.subtotal = line_item.quantity * line_item.unit_price
```

### 3. Parking Fee
```python
if parking_type == "Paid":
    parking_fee = 150.00  # $150 flat fee
    adjustments.append({
        "type": "parking_fee",
        "description": "Paid parking fee (estimated)",
        "amount": 150.00
    })
elif parking_type == "Hard":
    parking_fee = 250.00  # $250 flat fee
    adjustments.append({
        "type": "parking_fee",
        "description": "Difficult parking surcharge",
        "amount": 250.00
    })

total_with_adjustments = subtotal + sum(adjustment.amount for adjustment in adjustments)
```

---

## PROMPT VERSIONING

**Version 1.0 (MVP):**
- Basic line-item generation
- Pricing from Local Price Table only
- Confidence scores
- Exclusions & assumptions

**Version 1.1 (Future):**
- Support for multi-room projects (kitchen + bathroom)
- Material recommendations (brands, SKUs)
- Timeline dependencies (e.g., "drywall must cure before painting")

**Version 2.0 (Future):**
- Historical data learning (improve estimates based on actual costs)
- Competitor pricing comparison (optional)
- Auto-suggest upsells (e.g., "Add trim painting for +$200?")

---

## AI MODEL CONFIGURATION

**Recommended Settings:**

```json
{
  "model": "gpt-4-vision-preview",
  "temperature": 0.3,
  "max_tokens": 4096,
  "top_p": 0.9,
  "frequency_penalty": 0.0,
  "presence_penalty": 0.0
}
```

**Rationale:**
- Low temperature (0.3) for more deterministic, conservative estimates
- High max_tokens (4096) to handle detailed line items
- Top_p at 0.9 for balanced creativity vs. consistency

---

*End of AI Prompts & Examples - PhotoQuote AI MVP v1.0*
