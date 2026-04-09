import React, { useState, useMemo, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  CheckCircle,
  X,
  Plus,
  AlertTriangle,
  ArrowLeft,
  Save,
  Info,
  Check,
} from 'lucide-react-native';
import { colors, typography, spacing, radii, shadows } from '../theme';
import { ScreenHeader, Card, Button, Input, Divider } from '../components/ui';
import { useApp } from '../context/AppContext';
import { generateAIEstimate, PhotoValidationError } from '../services/openaiService';

interface EditableLineItem {
  id: string;
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}

// US state sales tax rates
const STATE_TAX_RATES: Record<string, number> = {
  FL: 7.0, CA: 7.25, TX: 6.25, NY: 8.0, NJ: 6.625, PA: 6.0, IL: 6.25, OH: 5.75,
  GA: 4.0, NC: 4.75, MI: 6.0, VA: 5.3, WA: 6.5, AZ: 5.6, MA: 6.25, TN: 7.0,
  IN: 7.0, MO: 4.225, MD: 6.0, WI: 5.0, CO: 2.9, MN: 6.875, SC: 6.0, AL: 4.0,
  LA: 4.45, KY: 6.0, OR: 0, MT: 0, NH: 0, DE: 0, AK: 0,
};

interface EstimatePreviewScreenProps {
  navigation: any;
  route: any;
}

// ── Base line items per service type ──────────────────────

const SERVICE_ITEMS: Record<string, EditableLineItem[]> = {
  Flooring: [
    { id: '', taxable: true, category: 'Floor Preparation', description: 'Protect surrounding areas, remove furniture, clean and level the subfloor. Includes moisture barrier inspection and repair of minor subfloor imperfections.', unit: 'sqft', quantity: 120, unitPrice: 1.50 },
    { id: '', taxable: true, category: 'Existing Flooring Removal', description: 'Careful removal of current flooring material (tile, vinyl, laminate, or carpet). Includes scraping of adhesive residue and disposal of old material.', unit: 'sqft', quantity: 120, unitPrice: 3.00 },
    { id: '', taxable: true, category: 'New Flooring Installation', description: 'Supply and install new flooring material according to manufacturer specifications. Includes underlayment, precise cuts around obstacles, and proper expansion gaps.', unit: 'sqft', quantity: 120, unitPrice: 6.50 },
    { id: '', taxable: true, category: 'Trim & Transitions', description: 'Install baseboards, quarter-round molding, and transition strips between rooms. Includes painting/staining of new trim to match existing decor.', unit: 'lf', quantity: 45, unitPrice: 12.00 },
    { id: '', taxable: true, category: 'Final Cleanup & Inspection', description: 'Remove all debris and construction waste. Vacuum and mop installed floor. Conduct walkthrough inspection to ensure quality and client satisfaction.', unit: 'job', quantity: 1, unitPrice: 150.00 },
  ],
  Painting: [
    { id: '', taxable: true, category: 'Surface Preparation', description: 'Repair cracks and holes with spackle, sand rough surfaces smooth, apply painter\'s tape to edges, cover floors and furniture with drop cloths.', unit: 'sqft', quantity: 400, unitPrice: 0.50 },
    { id: '', taxable: true, category: 'Primer Application', description: 'Apply one coat of high-quality primer to ensure proper paint adhesion and uniform color coverage. Includes stain-blocking primer for problem areas.', unit: 'sqft', quantity: 400, unitPrice: 0.75 },
    { id: '', taxable: true, category: 'Paint Application (2 Coats)', description: 'Apply two coats of premium interior/exterior paint using brush, roller, and spray as appropriate. Includes drying time between coats and touch-ups.', unit: 'sqft', quantity: 400, unitPrice: 1.50 },
    { id: '', taxable: true, category: 'Trim & Baseboard Painting', description: 'Sand, prime, and paint all trim, baseboards, door frames, and window casings. Includes detailed cut-in work for clean edges.', unit: 'lf', quantity: 80, unitPrice: 2.50 },
    { id: '', taxable: true, category: 'Final Cleanup', description: 'Remove all tape and drop cloths, clean paint drips and overspray, touch up any imperfections, and dispose of materials.', unit: 'job', quantity: 1, unitPrice: 100.00 },
  ],
  Drywall: [
    { id: '', taxable: true, category: 'Damaged Drywall Removal', description: 'Carefully remove damaged or water-stained drywall sections. Inspect framing behind for mold, rot, or structural issues. Dispose of old material.', unit: 'sqft', quantity: 100, unitPrice: 2.00 },
    { id: '', taxable: true, category: 'New Drywall Installation', description: 'Cut and install new drywall sheets (1/2" standard or 5/8" as needed). Secure with screws to studs at proper intervals.', unit: 'sqft', quantity: 100, unitPrice: 3.50 },
    { id: '', taxable: true, category: 'Taping & Mudding Joints', description: 'Apply joint tape and three coats of joint compound to all seams and screw holes. Feather edges for seamless transition.', unit: 'lf', quantity: 60, unitPrice: 3.00 },
    { id: '', taxable: true, category: 'Sanding & Texture Finish', description: 'Sand all joint compound smooth. Apply matching wall texture to blend with surrounding area.', unit: 'sqft', quantity: 100, unitPrice: 1.50 },
    { id: '', taxable: true, category: 'Cleanup & Debris Removal', description: 'Vacuum all drywall dust, remove debris from work area, wipe down surfaces.', unit: 'job', quantity: 1, unitPrice: 120.00 },
  ],
  Bathroom: [
    { id: '', taxable: true, category: 'Demolition & Removal', description: 'Remove existing fixtures (toilet, vanity, shower/tub), tear out old tile, flooring, and damaged drywall. Cap plumbing lines.', unit: 'job', quantity: 1, unitPrice: 650.00 },
    { id: '', taxable: true, category: 'Plumbing Rough-In', description: 'Install or relocate water supply lines and drain connections. Includes new shut-off valves, shower valve installation, and pressure testing.', unit: 'job', quantity: 1, unitPrice: 950.00 },
    { id: '', taxable: true, category: 'Waterproofing & Tile Installation', description: 'Apply waterproof membrane to shower/wet areas. Install cement backer board, lay floor and wall tile with proper spacing, grout, and seal.', unit: 'sqft', quantity: 60, unitPrice: 14.00 },
    { id: '', taxable: true, category: 'Fixture Installation', description: 'Install new vanity with countertop and faucet, toilet, shower head/controls, towel bars, mirror, and medicine cabinet.', unit: 'each', quantity: 3, unitPrice: 280.00 },
    { id: '', taxable: true, category: 'Finishing & Caulking', description: 'Apply silicone caulk around tub, shower, and vanity. Install trim, baseboards, and door hardware. Final inspection.', unit: 'job', quantity: 1, unitPrice: 350.00 },
  ],
  Kitchen: [
    { id: '', taxable: true, category: 'Demolition & Removal', description: 'Remove old cabinets, countertops, backsplash, and appliances. Disconnect plumbing and electrical as needed. Haul away all debris.', unit: 'job', quantity: 1, unitPrice: 750.00 },
    { id: '', taxable: true, category: 'Cabinet Installation', description: 'Install new wall and base cabinets, leveled and secured to studs. Includes shelving, drawer hardware, soft-close hinges.', unit: 'lf', quantity: 20, unitPrice: 160.00 },
    { id: '', taxable: true, category: 'Countertop Fabrication & Install', description: 'Template, fabricate, and install new countertops (granite, quartz, or laminate). Includes sink cutout and edge profiling.', unit: 'sqft', quantity: 30, unitPrice: 50.00 },
    { id: '', taxable: true, category: 'Backsplash Installation', description: 'Install tile backsplash from countertop to upper cabinets. Includes tile layout design, precise cuts, grouting, and sealing.', unit: 'sqft', quantity: 25, unitPrice: 18.00 },
    { id: '', taxable: true, category: 'Final Cleanup & Haul-Away', description: 'Clean all surfaces, cabinets inside and out, wipe down countertops. Remove debris. Final walkthrough with client.', unit: 'job', quantity: 1, unitPrice: 250.00 },
  ],
  Plumbing: [
    { id: '', taxable: true, category: 'Diagnostic & Inspection', description: 'Inspect existing plumbing system, identify issues, check water pressure, and locate leaks or blockages.', unit: 'job', quantity: 1, unitPrice: 150.00 },
    { id: '', taxable: true, category: 'Pipe Repair / Replacement', description: 'Repair or replace damaged, corroded, or leaking pipes. Includes fittings, connectors, and soldering.', unit: 'lf', quantity: 30, unitPrice: 18.00 },
    { id: '', taxable: true, category: 'Fixture Installation', description: 'Install or replace faucets, sinks, toilets, or water heater connections. Includes supply lines and shut-off valves.', unit: 'each', quantity: 2, unitPrice: 250.00 },
    { id: '', taxable: true, category: 'Drain Cleaning & Testing', description: 'Snake and clear drain blockages, test all connections for leaks, verify proper water flow and drainage.', unit: 'job', quantity: 1, unitPrice: 200.00 },
  ],
  Electrical: [
    { id: '', taxable: true, category: 'Electrical Inspection', description: 'Inspect existing wiring, panel capacity, outlets, and switches. Identify code violations and safety hazards.', unit: 'job', quantity: 1, unitPrice: 200.00 },
    { id: '', taxable: true, category: 'Wiring Installation', description: 'Run new electrical wiring through walls/ceiling. Includes conduit, wire, junction boxes, and proper connections.', unit: 'lf', quantity: 50, unitPrice: 8.00 },
    { id: '', taxable: true, category: 'Outlet & Switch Installation', description: 'Install new outlets, switches, dimmers, or GFCI receptacles. Includes cover plates and proper grounding.', unit: 'each', quantity: 6, unitPrice: 85.00 },
    { id: '', taxable: true, category: 'Light Fixture Installation', description: 'Install ceiling lights, recessed cans, pendants, or under-cabinet lighting. Includes mounting hardware and wiring.', unit: 'each', quantity: 4, unitPrice: 120.00 },
    { id: '', taxable: true, category: 'Panel & Testing', description: 'Update breaker panel if needed, label circuits, test all connections, and ensure code compliance.', unit: 'job', quantity: 1, unitPrice: 350.00 },
  ],
  Roofing: [
    { id: '', taxable: true, category: 'Roof Inspection & Prep', description: 'Inspect roof structure, decking, and existing shingles. Set up safety equipment and protect landscaping below.', unit: 'job', quantity: 1, unitPrice: 300.00 },
    { id: '', taxable: true, category: 'Old Roofing Removal', description: 'Strip old shingles, underlayment, and damaged decking. Dispose of materials properly.', unit: 'sqft', quantity: 1500, unitPrice: 1.50 },
    { id: '', taxable: true, category: 'New Roofing Installation', description: 'Install new underlayment, ice barrier, and shingles/tiles. Includes flashing around vents, chimneys, and edges.', unit: 'sqft', quantity: 1500, unitPrice: 4.50 },
    { id: '', taxable: true, category: 'Ridge & Ventilation', description: 'Install ridge cap, soffit vents, and ridge vents for proper attic ventilation.', unit: 'lf', quantity: 60, unitPrice: 12.00 },
    { id: '', taxable: true, category: 'Cleanup & Final Inspection', description: 'Magnetic sweep for nails, debris removal, gutter cleaning, and final quality walkthrough.', unit: 'job', quantity: 1, unitPrice: 250.00 },
  ],
  'Windows & Doors': [
    { id: '', taxable: true, category: 'Old Window/Door Removal', description: 'Carefully remove existing windows or doors, trim, and hardware. Inspect framing for rot or damage.', unit: 'each', quantity: 3, unitPrice: 80.00 },
    { id: '', taxable: true, category: 'Frame Preparation', description: 'Repair or replace damaged framing, apply flashing tape and weatherproofing around opening.', unit: 'each', quantity: 3, unitPrice: 120.00 },
    { id: '', taxable: true, category: 'New Window/Door Installation', description: 'Install new windows or doors, shim and level, apply expanding foam insulation around frame.', unit: 'each', quantity: 3, unitPrice: 350.00 },
    { id: '', taxable: true, category: 'Trim & Caulking', description: 'Install interior and exterior trim, caulk all joints, and paint/stain to match existing finish.', unit: 'each', quantity: 3, unitPrice: 100.00 },
  ],
  HVAC: [
    { id: '', taxable: true, category: 'System Inspection', description: 'Inspect existing HVAC system, ductwork, thermostat, and refrigerant levels. Diagnose issues.', unit: 'job', quantity: 1, unitPrice: 200.00 },
    { id: '', taxable: true, category: 'Equipment Removal', description: 'Disconnect and remove old HVAC unit, including refrigerant recovery and safe disposal.', unit: 'job', quantity: 1, unitPrice: 400.00 },
    { id: '', taxable: true, category: 'New Unit Installation', description: 'Install new AC unit/heat pump, connect refrigerant lines, electrical, and thermostat wiring.', unit: 'job', quantity: 1, unitPrice: 3500.00 },
    { id: '', taxable: true, category: 'Ductwork Repair', description: 'Seal leaky ducts, replace damaged sections, add insulation where needed.', unit: 'lf', quantity: 30, unitPrice: 15.00 },
    { id: '', taxable: true, category: 'Testing & Commissioning', description: 'Charge system with refrigerant, test cooling/heating cycles, calibrate thermostat, verify airflow.', unit: 'job', quantity: 1, unitPrice: 250.00 },
  ],
  Fencing: [
    { id: '', taxable: true, category: 'Old Fence Removal', description: 'Remove existing fence posts, panels, and hardware. Dispose of materials.', unit: 'lf', quantity: 80, unitPrice: 3.00 },
    { id: '', taxable: true, category: 'Post Installation', description: 'Dig holes, set posts in concrete, allow proper cure time. Ensure level and aligned.', unit: 'each', quantity: 12, unitPrice: 45.00 },
    { id: '', taxable: true, category: 'Panel/Board Installation', description: 'Attach fence panels, boards, or chain link to posts. Install rails and hardware.', unit: 'lf', quantity: 80, unitPrice: 12.00 },
    { id: '', taxable: true, category: 'Gate & Hardware', description: 'Install gate(s) with hinges, latch, and lock. Ensure proper swing and alignment.', unit: 'each', quantity: 1, unitPrice: 250.00 },
  ],
  Landscaping: [
    { id: '', taxable: true, category: 'Site Clearing', description: 'Remove overgrowth, dead plants, debris, and old mulch. Grade and level soil as needed.', unit: 'sqft', quantity: 500, unitPrice: 0.75 },
    { id: '', taxable: true, category: 'Planting & Sod', description: 'Install new plants, shrubs, trees, or sod. Includes soil amendment and root preparation.', unit: 'sqft', quantity: 500, unitPrice: 2.50 },
    { id: '', taxable: true, category: 'Hardscape Installation', description: 'Install pavers, stepping stones, edging, or retaining walls.', unit: 'sqft', quantity: 100, unitPrice: 8.00 },
    { id: '', taxable: true, category: 'Irrigation & Mulch', description: 'Install or repair irrigation lines/sprinklers, spread mulch over planting beds.', unit: 'sqft', quantity: 500, unitPrice: 1.00 },
  ],
  Concrete: [
    { id: '', taxable: true, category: 'Demolition & Removal', description: 'Break up and remove existing concrete slab, walkway, or driveway. Haul away debris.', unit: 'sqft', quantity: 200, unitPrice: 3.50 },
    { id: '', taxable: true, category: 'Grading & Forms', description: 'Grade sub-base, compact soil, install rebar/mesh and concrete forms.', unit: 'sqft', quantity: 200, unitPrice: 2.00 },
    { id: '', taxable: true, category: 'Concrete Pouring', description: 'Pour and spread concrete to proper depth and slope. Includes finishing (broom, smooth, or stamped).', unit: 'sqft', quantity: 200, unitPrice: 6.00 },
    { id: '', taxable: true, category: 'Curing & Sealing', description: 'Apply curing compound, saw control joints, and seal surface for protection.', unit: 'sqft', quantity: 200, unitPrice: 1.00 },
  ],
  Siding: [
    { id: '', taxable: true, category: 'Old Siding Removal', description: 'Remove existing siding, inspect sheathing and vapor barrier. Replace damaged sections.', unit: 'sqft', quantity: 500, unitPrice: 1.50 },
    { id: '', taxable: true, category: 'New Siding Installation', description: 'Install new vinyl, wood, fiber cement, or aluminum siding. Includes starter strips and J-channel.', unit: 'sqft', quantity: 500, unitPrice: 5.50 },
    { id: '', taxable: true, category: 'Trim & Corners', description: 'Install corner posts, window/door trim, and soffit. Caulk all joints.', unit: 'lf', quantity: 100, unitPrice: 8.00 },
    { id: '', taxable: true, category: 'Cleanup', description: 'Remove debris, old nails, and construction waste. Final inspection.', unit: 'job', quantity: 1, unitPrice: 200.00 },
  ],
  Tiling: [
    { id: '', taxable: true, category: 'Surface Preparation', description: 'Clean, level, and prime surfaces. Install cement backer board or waterproof membrane where needed.', unit: 'sqft', quantity: 100, unitPrice: 2.50 },
    { id: '', taxable: true, category: 'Tile Layout & Cutting', description: 'Plan tile layout for optimal appearance, cut tiles to fit edges, corners, and around fixtures.', unit: 'sqft', quantity: 100, unitPrice: 3.00 },
    { id: '', taxable: true, category: 'Tile Installation', description: 'Apply thin-set mortar and set tiles with proper spacing. Includes floor, wall, or backsplash areas.', unit: 'sqft', quantity: 100, unitPrice: 8.00 },
    { id: '', taxable: true, category: 'Grouting & Sealing', description: 'Apply grout between tiles, clean excess, and seal grout lines for moisture protection.', unit: 'sqft', quantity: 100, unitPrice: 2.00 },
    { id: '', taxable: true, category: 'Final Cleanup', description: 'Clean all tile surfaces, remove haze, inspect for defects, and touch up as needed.', unit: 'job', quantity: 1, unitPrice: 100.00 },
  ],
  Carpentry: [
    { id: '', taxable: true, category: 'Measurement & Planning', description: 'Take precise measurements, plan cuts and materials needed. Review design specifications.', unit: 'job', quantity: 1, unitPrice: 150.00 },
    { id: '', taxable: true, category: 'Framing / Structural Work', description: 'Build or repair wall framing, headers, or structural supports. Ensure level and plumb.', unit: 'lf', quantity: 40, unitPrice: 12.00 },
    { id: '', taxable: true, category: 'Trim & Finish Carpentry', description: 'Install crown molding, baseboards, chair rail, wainscoting, or custom built-ins.', unit: 'lf', quantity: 60, unitPrice: 8.00 },
    { id: '', taxable: true, category: 'Door & Cabinet Work', description: 'Hang doors, install cabinet hardware, build or install shelving units.', unit: 'each', quantity: 3, unitPrice: 150.00 },
    { id: '', taxable: true, category: 'Sanding & Finishing', description: 'Sand all wood surfaces smooth, apply stain or paint, and install final hardware.', unit: 'job', quantity: 1, unitPrice: 200.00 },
  ],
  Demolition: [
    { id: '', taxable: true, category: 'Preparation & Protection', description: 'Set up dust barriers, protect adjacent areas, disconnect utilities as needed.', unit: 'job', quantity: 1, unitPrice: 200.00 },
    { id: '', taxable: true, category: 'Interior Demolition', description: 'Remove walls, flooring, fixtures, cabinets, or other interior elements as specified.', unit: 'sqft', quantity: 200, unitPrice: 3.00 },
    { id: '', taxable: true, category: 'Debris Hauling & Disposal', description: 'Load debris into dumpster, haul to disposal site. Includes dumpster rental.', unit: 'job', quantity: 1, unitPrice: 500.00 },
    { id: '', taxable: true, category: 'Site Cleanup', description: 'Sweep and clean area, remove dust, inspect for hidden issues (mold, asbestos, rot).', unit: 'job', quantity: 1, unitPrice: 150.00 },
  ],
  'General Repair': [
    { id: '', taxable: true, category: 'Inspection & Diagnosis', description: 'Inspect the problem area, identify root cause, and determine repair approach.', unit: 'job', quantity: 1, unitPrice: 100.00 },
    { id: '', taxable: true, category: 'Repair Work', description: 'Perform necessary repairs including materials and labor. Scope as described by client.', unit: 'job', quantity: 1, unitPrice: 400.00 },
    { id: '', taxable: true, category: 'Testing & Verification', description: 'Test repaired area to ensure proper function. Verify fix addresses the root cause.', unit: 'job', quantity: 1, unitPrice: 75.00 },
    { id: '', taxable: true, category: 'Cleanup', description: 'Clean work area, remove debris, and restore to pre-work condition.', unit: 'job', quantity: 1, unitPrice: 50.00 },
  ],
};

// ── Difficulty multiplier based on project conditions ────

interface ProjectConditions {
  propertyType: string;
  accessLevel: string;
  floorLevel: string;
  hasElevator: boolean;
  parkingType: string;
  city: string;
  zip: string;
}

// Florida city cost-of-living tiers (higher tier = higher prices)
const HIGH_COST_CITIES = ['miami', 'miami beach', 'fort lauderdale', 'boca raton', 'palm beach', 'west palm beach', 'naples', 'key west', 'aventura', 'coral gables', 'sunny isles', 'bal harbour', 'fisher island'];
const MEDIUM_COST_CITIES = ['orlando', 'tampa', 'st. petersburg', 'sarasota', 'jacksonville', 'clearwater', 'brickell', 'doral', 'weston', 'pembroke pines', 'hollywood', 'delray beach', 'boynton beach', 'jupiter', 'stuart', 'bonita springs'];

// ZIP code prefixes for high-cost areas
const HIGH_COST_ZIPS = ['331', '332', '333', '334', '305'];
const MEDIUM_COST_ZIPS = ['328', '336', '337', '339', '346', '347'];

function getLocationMultiplier(city: string, zip: string): number {
  const cityLower = city.toLowerCase().trim();

  if (HIGH_COST_CITIES.some(c => cityLower.includes(c))) return 1.20;
  if (MEDIUM_COST_CITIES.some(c => cityLower.includes(c))) return 1.10;

  // Fallback to ZIP prefix
  const zipPrefix = zip.substring(0, 3);
  if (HIGH_COST_ZIPS.includes(zipPrefix)) return 1.15;
  if (MEDIUM_COST_ZIPS.includes(zipPrefix)) return 1.08;

  return 1.0;
}

function getLocationLabel(multiplier: number): string {
  if (multiplier >= 1.15) return 'High-cost area';
  if (multiplier >= 1.05) return 'Medium-cost area';
  return 'Standard area';
}

function getDifficultyMultiplier(conditions: ProjectConditions): number {
  let multiplier = 1.0;

  // Property type
  if (conditions.propertyType === 'Commercial') multiplier += 0.15;
  if (conditions.propertyType === 'Condo') multiplier += 0.10;

  // Access level
  if (conditions.accessLevel === 'Medium') multiplier += 0.10;
  if (conditions.accessLevel === 'Hard') multiplier += 0.25;

  // Floor level
  const floor = parseInt(conditions.floorLevel) || 0;
  if (floor >= 2 && floor <= 5) multiplier += 0.05;
  if (floor > 5 && floor <= 10) multiplier += 0.10;
  if (floor > 10) multiplier += 0.20;

  // High floor without elevator
  if (floor >= 2 && !conditions.hasElevator) multiplier += 0.15;

  // Parking
  if (conditions.parkingType === 'Paid') multiplier += 0.03;
  if (conditions.parkingType === 'Hard') multiplier += 0.08;

  // Location
  const locationMult = getLocationMultiplier(conditions.city, conditions.zip);
  multiplier *= locationMult;

  return multiplier;
}

function getDifficultyLabel(multiplier: number): string {
  if (multiplier <= 1.0) return 'Standard';
  if (multiplier <= 1.15) return 'Moderate';
  if (multiplier <= 1.30) return 'Difficult';
  return 'Very Difficult';
}

// ── Build items from services + description ─────────────

function buildLineItems(
  services: string[],
  description: string,
  sqft: number,
  lf: number,
  conditions: ProjectConditions,
): EditableLineItem[] {
  let idCounter = 0;
  const items: EditableLineItem[] = [];
  const multiplier = getDifficultyMultiplier(conditions);

  // 1. Add base items for each selected service
  for (const service of services) {
    const baseItems = SERVICE_ITEMS[service];
    if (baseItems) {
      for (const item of baseItems) {
        idCounter++;
        let qty = item.quantity;
        if (sqft > 0 && item.unit === 'sqft') qty = sqft;
        if (lf > 0 && item.unit === 'lf') qty = lf;
        const adjustedPrice = Math.round(item.unitPrice * multiplier * 100) / 100;
        items.push({ ...item, id: String(idCounter), quantity: qty, unitPrice: adjustedPrice, taxable: true });
      }
    } else {
      // Custom service type: create generic items
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: `${service} - Assessment`,
        description: `Inspect and assess scope of ${service.toLowerCase()} work. Identify materials and labor required.`,
        unit: 'job', quantity: 1, unitPrice: Math.round(150.00 * multiplier * 100) / 100,
      });
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: `${service} - Labor & Materials`,
        description: `Perform ${service.toLowerCase()} work including all necessary materials and skilled labor.`,
        unit: 'job', quantity: 1, unitPrice: Math.round(500.00 * multiplier * 100) / 100,
      });
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: `${service} - Cleanup`,
        description: `Clean work area, remove debris, and final inspection of ${service.toLowerCase()} work.`,
        unit: 'job', quantity: 1, unitPrice: Math.round(100.00 * multiplier * 100) / 100,
      });
    }
  }

  // Add parking fee line item if parking is Paid or Hard
  if (conditions.parkingType === 'Paid') {
    idCounter++;
    items.push({
      id: String(idCounter), taxable: true,
      category: 'Parking Fees',
      description: 'Paid parking costs for crew vehicles during project duration.',
      unit: 'day', quantity: 3, unitPrice: 25.00,
    });
  } else if (conditions.parkingType === 'Hard') {
    idCounter++;
    items.push({
      id: String(idCounter), taxable: true,
      category: 'Parking & Access Logistics',
      description: 'Additional logistics for difficult parking: crew coordination, loading zone permits, shuttle costs.',
      unit: 'day', quantity: 3, unitPrice: 50.00,
    });
  }

  // Add elevator/stairs surcharge for high floors
  const floor = parseInt(conditions.floorLevel) || 0;
  if (floor >= 3 && !conditions.hasElevator) {
    idCounter++;
    items.push({
      id: String(idCounter), taxable: true,
      category: 'Manual Material Hauling (No Elevator)',
      description: `Manually carry materials and equipment up ${floor} floors via stairs. Includes additional labor time.`,
      unit: 'job', quantity: 1, unitPrice: floor * 75.00,
    });
  }

  // 2. Parse description for extra items the AI should add
  if (description.trim()) {
    const desc = description.toLowerCase();

    // Waterproofing mentioned
    if (desc.includes('waterproof') || desc.includes('membrane') || desc.includes('impermeabiliz')) {
      if (!items.some(i => i.category.toLowerCase().includes('waterproof'))) {
        idCounter++;
        items.push({
          id: String(idCounter), taxable: true,
          category: 'Waterproofing',
          description: 'Apply waterproof membrane/coating as described. Includes surface preparation and material.',
          unit: 'sqft', quantity: sqft || 60, unitPrice: 5.00,
        });
      }
    }

    // Mold / mold removal
    if (desc.includes('mold') || desc.includes('mofo') || desc.includes('bolor')) {
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: 'Mold Remediation',
        description: 'Treat and remove mold-affected areas. Apply anti-fungal treatment and sealant to prevent recurrence.',
        unit: 'sqft', quantity: sqft || 50, unitPrice: 8.00,
      });
    }

    // Permit mentioned
    if (desc.includes('permit') || desc.includes('licen')) {
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: 'Permits & Inspections',
        description: 'Obtain required building permits and schedule inspections with local building department.',
        unit: 'job', quantity: 1, unitPrice: 350.00,
      });
    }

    // Insulation mentioned
    if (desc.includes('insulat') || desc.includes('isola')) {
      if (!items.some(i => i.category.toLowerCase().includes('insulat'))) {
        idCounter++;
        items.push({
          id: String(idCounter), taxable: true,
          category: 'Insulation',
          description: 'Install or replace insulation in walls, ceiling, or attic space. Includes vapor barrier.',
          unit: 'sqft', quantity: sqft || 100, unitPrice: 2.50,
        });
      }
    }

    // Dumpster / hauling
    if (desc.includes('dumpster') || desc.includes('hauling') || desc.includes('debris removal') || desc.includes('cacamba')) {
      if (!items.some(i => i.category.toLowerCase().includes('hauling') || i.category.toLowerCase().includes('dumpster'))) {
        idCounter++;
        items.push({
          id: String(idCounter), taxable: true,
          category: 'Dumpster & Hauling',
          description: 'Rent dumpster for construction debris. Includes delivery, pickup, and disposal fees.',
          unit: 'job', quantity: 1, unitPrice: 450.00,
        });
      }
    }

    // Pressure washing
    if (desc.includes('pressure wash') || desc.includes('power wash')) {
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: 'Pressure Washing',
        description: 'Pressure wash surfaces before work begins. Removes dirt, mildew, and loose paint.',
        unit: 'sqft', quantity: sqft || 200, unitPrice: 0.50,
      });
    }

    // Crown molding
    if (desc.includes('crown') || desc.includes('molding') || desc.includes('moldura')) {
      if (!items.some(i => i.category.toLowerCase().includes('crown') || i.category.toLowerCase().includes('molding'))) {
        idCounter++;
        items.push({
          id: String(idCounter), taxable: true,
          category: 'Crown Molding Installation',
          description: 'Install decorative crown molding at ceiling-wall junction. Includes mitered corners and caulking.',
          unit: 'lf', quantity: lf || 60, unitPrice: 10.00,
        });
      }
    }

    // Shower door / glass
    if (desc.includes('shower door') || desc.includes('glass door') || desc.includes('porta de vidro')) {
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: 'Shower Door / Glass Installation',
        description: 'Supply and install frameless or framed glass shower door. Includes hardware, seals, and alignment.',
        unit: 'each', quantity: 1, unitPrice: 650.00,
      });
    }

    // Appliance installation
    if (desc.includes('appliance') || desc.includes('dishwasher') || desc.includes('stove') || desc.includes('refrigerator') || desc.includes('eletrodom')) {
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: 'Appliance Installation',
        description: 'Install kitchen/household appliances. Includes connecting water, gas, or electrical as needed.',
        unit: 'each', quantity: 1, unitPrice: 200.00,
      });
    }

    // Accent wall / feature wall
    if (desc.includes('accent wall') || desc.includes('feature wall') || desc.includes('parede destaque')) {
      idCounter++;
      items.push({
        id: String(idCounter), taxable: true,
        category: 'Accent / Feature Wall',
        description: 'Create decorative accent wall with special material (shiplap, stone veneer, wood paneling, or wallpaper).',
        unit: 'sqft', quantity: sqft || 80, unitPrice: 12.00,
      });
    }

  }

  return items;
}

// ── Component ─────────────────────────────────────────────

export default function EstimatePreviewScreen({ navigation, route }: EstimatePreviewScreenProps) {
  const { getProject, getClient, addEstimate, companyProfile } = useApp();
  const insets = useSafeAreaInsets();
  const projectId = route.params?.projectId as string | undefined;
  const project = projectId ? getProject(projectId) : undefined;
  const client = project ? getClient(project.clientId) : undefined;

  const services = project?.serviceType ? project.serviceType.split(', ').filter(Boolean) : [];
  const sqft = project?.squareFeet ? parseInt(project.squareFeet) : 0;
  const lf = project?.linearFeet ? parseInt(project.linearFeet) : 0;
  const description = project?.serviceDescription ?? '';

  const conditions: ProjectConditions = {
    propertyType: project?.propertyType ?? 'Residential',
    accessLevel: project?.accessLevel ?? 'Easy',
    floorLevel: project?.floorLevel ?? '0',
    hasElevator: project?.hasElevator ?? false,
    parkingType: project?.parkingType ?? 'Easy',
    city: project?.city ?? '',
    zip: project?.zip ?? '',
  };
  const difficultyMultiplier = getDifficultyMultiplier(conditions);
  const difficultyLabel = getDifficultyLabel(difficultyMultiplier);
  const locationMult = getLocationMultiplier(conditions.city, conditions.zip);
  const locationLabel = getLocationLabel(locationMult);

  const projectState = companyProfile.state?.toUpperCase() || 'FL';
  const defaultTaxRate = STATE_TAX_RATES[projectState] ?? 7.0;

  const [lineItems, setLineItems] = useState<EditableLineItem[]>(
    () => buildLineItems(services, description, sqft, lf, conditions)
  );
  const [taxRate, setTaxRate] = useState(String(defaultTaxRate));
  const [marginRate, setMarginRate] = useState('0');
  const [notes, setNotes] = useState(
    'Assumes existing structure is in good condition.\nDoes not include work outside specified scope unless noted.\nAll materials included unless noted otherwise.\nValid for 30 days from date of issue.\nEstimated timeline depends on project scope.'
  );

  // AI integration
  const [isLoadingAI, setIsLoadingAI] = useState(true);
  const [aiConfidence, setAiConfidence] = useState(0);
  const [aiSource, setAiSource] = useState<'ai' | 'fallback'>('fallback');
  const [photoAnalysis, setPhotoAnalysis] = useState('');
  const [photoRejected, setPhotoRejected] = useState(false);
  const [rejectionReason, setRejectionReason] = useState('');
  const aiCalled = useRef(false);

  useEffect(() => {
    if (aiCalled.current || !project) return;
    aiCalled.current = true;

    (async () => {
      try {
        const result = await generateAIEstimate({
          photoUris: project.photos,
          services,
          description,
          sqft,
          linearFeet: lf,
          propertyType: conditions.propertyType,
          accessLevel: conditions.accessLevel,
          floorLevel: conditions.floorLevel,
          hasElevator: conditions.hasElevator,
          parkingType: conditions.parkingType,
          city: conditions.city,
          state: projectState,
        });

        let idCounter = 0;
        const aiItems: EditableLineItem[] = result.lineItems.map(item => ({
          id: String(++idCounter),
          category: item.category,
          description: item.description,
          unit: item.unit,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          taxable: item.taxable,
        }));

        setLineItems(aiItems);
        setAiConfidence(result.confidence);
        setAiSource('ai');
        setPhotoAnalysis(result.photoAnalysis || '');
        if (result.notes) {
          setNotes(result.notes);
        }
      } catch (err) {
        if (err instanceof PhotoValidationError) {
          setPhotoRejected(true);
          setRejectionReason(err.message);
          setPhotoAnalysis(err.photoAnalysis);
        } else {
          const errorMsg = err instanceof Error ? err.message : 'Unknown error';
          console.error('AI estimate failed:', errorMsg);
          Alert.alert('AI Estimate Failed', errorMsg);
        }
      } finally {
        setIsLoadingAI(false);
      }
    })();
  }, []);

  const totals = useMemo(() => {
    const subtotal = lineItems.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxableSubtotal = lineItems.filter(i => i.taxable).reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);
    const taxPct = parseFloat(taxRate) || 0;
    const marginPct = parseFloat(marginRate) || 0;
    const tax = taxableSubtotal * (taxPct / 100);
    const margin = (subtotal + tax) * (marginPct / 100);
    const total = subtotal + tax + margin;
    return { subtotal, taxableSubtotal, tax, margin, total, taxPct, marginPct };
  }, [lineItems, taxRate, marginRate]);

  const updateLineItem = (id: string, field: keyof EditableLineItem, value: string | number | boolean) => {
    setLineItems(prev => prev.map(item => item.id !== id ? item : { ...item, [field]: value }));
  };

  const removeLineItem = (id: string) => {
    if (lineItems.length <= 1) {
      Alert.alert('Required', 'You must have at least one line item.');
      return;
    }
    Alert.alert('Remove Item', 'Are you sure you want to remove this item?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => setLineItems(prev => prev.filter(i => i.id !== id)) },
    ]);
  };

  const addLineItem = () => {
    setLineItems(prev => [
      ...prev,
      { id: String(Date.now()), category: 'New Item', description: 'Describe the work to be performed...', unit: 'job', quantity: 1, unitPrice: 0, taxable: true },
    ]);
  };

  const handleSaveEstimate = async () => {
    if (lineItems.some(item => !item.category.trim())) {
      Alert.alert('Required', 'All items must have a title.');
      return;
    }

    if (!projectId) {
      Alert.alert('Error', 'No project associated with this estimate.');
      return;
    }

    try {
      await addEstimate({
        projectId,
        version: 1,
        lineItems: lineItems.map(item => ({ ...item, subtotal: item.quantity * item.unitPrice })),
        taxRate: totals.taxPct,
        marginRate: totals.marginPct,
        subtotal: totals.subtotal,
        tax: totals.tax,
        margin: totals.margin,
        total: totals.total,
        notes,
        confidence: aiConfidence || 92,
        status: 'Draft',
      });
      Alert.alert('Estimate Saved', 'Your estimate has been saved successfully.', [
        { text: 'OK', onPress: () => navigation.popToTop() },
      ]);
    } catch (error: any) {
      Alert.alert('Save Failed', error?.message || 'Failed to save estimate. Please try again.');
    }
  };

  // ── Loading State ──
  if (isLoadingAI) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Edit Estimate" onBack={() => navigation.goBack()} />
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={colors.primary} />
          <Text style={styles.loadingTitle}>AI analyzing your project...</Text>
          <Text style={styles.loadingText}>
            Reviewing {project?.photos.length ?? 0} photo(s) and project details to generate an accurate estimate.
          </Text>
        </View>
      </View>
    );
  }

  // ── Photo Rejected State ──
  if (photoRejected) {
    return (
      <View style={styles.container}>
        <ScreenHeader title="Photo Review" onBack={() => navigation.goBack()} />
        <ScrollView style={styles.scrollContent} contentContainerStyle={styles.rejectedScrollContent}>
          <View style={styles.rejectedIconContainer}>
            <AlertTriangle size={36} color={colors.error} />
          </View>
          <Text style={styles.rejectedTitle}>Invalid Photos Detected</Text>
          <Text style={styles.rejectedSubtitle}>
            The photos you uploaded are not related to construction or renovation work and cannot be used to generate an estimate.
          </Text>

          <Card variant="outlined" style={styles.rejectedCard}>
            <Text style={styles.rejectedCardTitle}>What We Detected</Text>
            <Text style={styles.rejectedCardText}>{photoAnalysis || 'No analysis available.'}</Text>
          </Card>

          <Card variant="outlined" style={styles.rejectedCard}>
            <Text style={styles.rejectedCardTitle}>Why It Was Rejected</Text>
            <Text style={styles.rejectedCardText}>{rejectionReason || 'The photos do not show construction-related content.'}</Text>
          </Card>

          <Card style={styles.rejectedHintCard}>
            <Text style={styles.rejectedHintTitle}>Valid Photos Include:</Text>
            <Text style={styles.rejectedHintText}>
              {'\u2022'} Buildings, rooms, walls, floors, ceilings{'\n'}
              {'\u2022'} Roofs, foundations, structural elements{'\n'}
              {'\u2022'} Plumbing, electrical, HVAC systems{'\n'}
              {'\u2022'} Damage to repair (water, mold, cracks){'\n'}
              {'\u2022'} Landscaping, fences, concrete, driveways{'\n'}
              {'\u2022'} Property exteriors and interiors
            </Text>
          </Card>

          <Button
            title="Upload New Photos"
            onPress={() => navigation.goBack()}
            size="lg"
            fullWidth
            style={styles.actionBtnSpacing}
          />

          <Button
            title="Back to Projects"
            onPress={() => navigation.popToTop()}
            variant="outline"
            size="lg"
            fullWidth
          />

          <View style={{ height: 60 }} />
        </ScrollView>
      </View>
    );
  }

  // ── Main Estimate Editor ──
  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScreenHeader title="Edit Estimate" onBack={() => navigation.goBack()} />

      <ScrollView
        style={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* Success Banner */}
        <View style={styles.successBanner}>
          <CheckCircle size={28} color={colors.success} style={styles.successIconSpacing} />
          <View style={styles.successContent}>
            <Text style={styles.successTitle}>Estimate Generated!</Text>
            <Text style={styles.successText}>
              {aiSource === 'ai'
                ? `AI analyzed ${project?.photos.length ?? 0} photo(s) for ${services.join(', ')} with ${aiConfidence}% confidence. Review and edit all items below before saving.`
                : `Estimate generated for ${services.join(', ')} based on project data. Review and edit all items below before saving.`}
            </Text>
          </View>
        </View>

        {/* Service Description reminder */}
        {description.trim().length > 0 && (
          <Card variant="outlined" style={styles.descriptionBanner}>
            <View style={styles.descriptionRow}>
              <Info size={16} color={colors.info} style={{ marginRight: spacing.sm }} />
              <Text style={styles.descriptionLabel}>Your description (used by AI):</Text>
            </View>
            <Text style={styles.descriptionText}>{description}</Text>
          </Card>
        )}

        {/* Difficulty Factor */}
        {difficultyMultiplier > 1.0 && (
          <View style={styles.difficultyBanner}>
            <AlertTriangle size={16} color={colors.warning} style={{ marginRight: spacing.sm }} />
            <View style={{ flex: 1 }}>
              <Text style={styles.difficultyLabel}>
                Difficulty: {difficultyLabel} (+{Math.round((difficultyMultiplier - 1) * 100)}%)
              </Text>
              <Text style={styles.difficultyText}>
                Prices adjusted for: {conditions.propertyType}
                {conditions.accessLevel !== 'Easy' ? `, ${conditions.accessLevel} access` : ''}
                {parseInt(conditions.floorLevel) > 0 ? `, Floor ${conditions.floorLevel}` : ''}
                {parseInt(conditions.floorLevel) >= 2 && !conditions.hasElevator ? ', No elevator' : ''}
                {conditions.parkingType !== 'Easy' ? `, ${conditions.parkingType} parking` : ''}
                {locationMult > 1.0 ? `, ${locationLabel} (${conditions.city || 'ZIP ' + conditions.zip})` : ''}
              </Text>
            </View>
          </View>
        )}

        {/* Project Info */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Project Details</Text>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Client:</Text>
            <Text style={styles.infoValue}>{client?.name ?? 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Project:</Text>
            <Text style={styles.infoValue}>{project?.name ?? 'N/A'}</Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Address:</Text>
            <Text style={styles.infoValue}>
              {project ? `${project.address}, ${project.city}, FL` : 'N/A'}
            </Text>
          </View>
          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Services:</Text>
            <Text style={styles.infoValue}>{services.join(', ') || 'N/A'}</Text>
          </View>
        </Card>

        {/* Editable Line Items */}
        <Card style={styles.cardSpacing}>
          <View style={styles.cardHeaderRow}>
            <Text style={styles.cardTitle}>Line Items ({lineItems.length})</Text>
            <Text style={styles.editHint}>Tap to edit</Text>
          </View>

          {lineItems.map((item, index) => (
            <View key={item.id} style={styles.lineItem}>
              <View style={styles.lineItemTopRow}>
                <View style={styles.lineItemIndex}>
                  <Text style={styles.lineItemIndexText}>{index + 1}</Text>
                </View>
                <TouchableOpacity onPress={() => removeLineItem(item.id)} style={styles.removeItemBtn}>
                  <X size={14} color={colors.error} />
                </TouchableOpacity>
              </View>

              <Text style={styles.fieldLabel}>Title</Text>
              <TextInput
                style={styles.editInput}
                value={item.category}
                onChangeText={(v) => updateLineItem(item.id, 'category', v)}
                placeholder="Item title..."
                placeholderTextColor={colors.textTertiary}
              />

              <Text style={styles.fieldLabel}>Description</Text>
              <TextInput
                style={[styles.editInput, styles.editTextArea]}
                value={item.description}
                onChangeText={(v) => updateLineItem(item.id, 'description', v)}
                placeholder="Describe the work..."
                placeholderTextColor={colors.textTertiary}
                multiline
                textAlignVertical="top"
              />

              <View style={styles.lineItemValuesRow}>
                <View style={styles.valueCol}>
                  <Text style={styles.fieldLabel}>Qty</Text>
                  <TextInput
                    style={styles.editInputSmall}
                    value={String(item.quantity)}
                    onChangeText={(v) => updateLineItem(item.id, 'quantity', parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.valueCol}>
                  <Text style={styles.fieldLabel}>Unit</Text>
                  <TextInput
                    style={styles.editInputSmall}
                    value={item.unit}
                    onChangeText={(v) => updateLineItem(item.id, 'unit', v)}
                    placeholder="sqft"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
                <View style={styles.valueCol}>
                  <Text style={styles.fieldLabel}>$/Unit</Text>
                  <TextInput
                    style={styles.editInputSmall}
                    value={String(item.unitPrice)}
                    onChangeText={(v) => updateLineItem(item.id, 'unitPrice', parseFloat(v) || 0)}
                    keyboardType="numeric"
                    placeholder="0.00"
                    placeholderTextColor={colors.textTertiary}
                  />
                </View>
              </View>

              <TouchableOpacity
                style={styles.taxToggleRow}
                onPress={() => updateLineItem(item.id, 'taxable', !item.taxable)}
              >
                <View style={[styles.taxCheckbox, item.taxable && styles.taxCheckboxActive]}>
                  {item.taxable && <Check size={14} color={colors.textOnPrimary} />}
                </View>
                <Text style={styles.taxToggleLabel}>Taxable</Text>
              </TouchableOpacity>

              <View style={styles.lineItemSubtotalRow}>
                <Text style={styles.subtotalLabel}>Subtotal</Text>
                <Text style={styles.subtotalValue}>${(item.quantity * item.unitPrice).toFixed(2)}</Text>
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addItemButton} onPress={addLineItem}>
            <Plus size={18} color={colors.primary} />
            <Text style={styles.addItemText}>Add Line Item</Text>
          </TouchableOpacity>
        </Card>

        {/* Rates */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Rates</Text>
          <View style={styles.ratesRow}>
            <View style={styles.rateCol}>
              <Text style={styles.fieldLabel}>Tax Rate (%)</Text>
              <TextInput style={styles.editInputSmall} value={taxRate} onChangeText={setTaxRate} keyboardType="numeric" placeholder="7.0" placeholderTextColor={colors.textTertiary} />
            </View>
            <View style={styles.rateCol}>
              <Text style={styles.fieldLabel}>Margin (%)</Text>
              <TextInput style={styles.editInputSmall} value={marginRate} onChangeText={setMarginRate} keyboardType="numeric" placeholder="20.0" placeholderTextColor={colors.textTertiary} />
            </View>
          </View>
        </Card>

        {/* Totals */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Summary</Text>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Subtotal</Text>
            <Text style={styles.totalValue}>${totals.subtotal.toFixed(2)}</Text>
          </View>
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Taxable ({totals.taxPct}% on ${totals.taxableSubtotal.toFixed(2)})</Text>
            <Text style={styles.totalValue}>${totals.tax.toFixed(2)}</Text>
          </View>
          {totals.marginPct > 0 && (
            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>Margin ({totals.marginPct}%)</Text>
              <Text style={styles.totalValue}>${totals.margin.toFixed(2)}</Text>
            </View>
          )}
          <Divider marginVertical={spacing.md} />
          <View style={styles.totalRow}>
            <Text style={styles.grandTotalLabel}>Total</Text>
            <Text style={styles.grandTotalValue}>${totals.total.toFixed(2)}</Text>
          </View>
        </Card>

        {/* Notes */}
        <Card style={styles.cardSpacing}>
          <Text style={styles.cardTitle}>Notes & Assumptions</Text>
          <TextInput
            style={[styles.editInput, styles.editTextArea, { minHeight: 120 }]}
            value={notes}
            onChangeText={setNotes}
            placeholder="Add notes about this estimate..."
            placeholderTextColor={colors.textTertiary}
            multiline
            textAlignVertical="top"
          />
        </Card>

        {/* Actions */}
        <Button
          title="Save Estimate"
          onPress={handleSaveEstimate}
          size="lg"
          fullWidth
          icon={<Save size={18} color={colors.textOnPrimary} />}
          style={styles.actionBtnSpacing}
        />

        <Button
          title="Back to Photos"
          onPress={() => navigation.goBack()}
          variant="outline"
          size="lg"
          fullWidth
          icon={<ArrowLeft size={18} color={colors.primary} />}
        />

        <View style={{ height: 100 }} />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.bgSecondary,
  },
  scrollContent: {
    flex: 1,
    padding: spacing.lg,
  },

  // Loading
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing['4xl'],
  },
  loadingTitle: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
    marginTop: spacing['2xl'],
    marginBottom: spacing.sm,
  },
  loadingText: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.base,
  },

  // Rejected
  rejectedScrollContent: {
    alignItems: 'center',
    paddingBottom: spacing['4xl'],
  },
  rejectedIconContainer: {
    width: 80,
    height: 80,
    borderRadius: radii.full,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing['2xl'],
    marginBottom: spacing.xl,
    borderWidth: 3,
    borderColor: colors.error,
  },
  rejectedTitle: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.error,
    marginBottom: spacing.sm,
    textAlign: 'center',
  },
  rejectedSubtitle: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
    textAlign: 'center',
    lineHeight: typography.lineHeights.base,
    marginBottom: spacing['2xl'],
    paddingHorizontal: spacing.sm,
  },
  rejectedCard: {
    width: '100%',
    marginBottom: spacing.md,
  },
  rejectedCardTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.sm,
  },
  rejectedCardText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.base,
  },
  rejectedHintCard: {
    width: '100%',
    marginBottom: spacing['2xl'],
    backgroundColor: colors.infoBg,
  },
  rejectedHintTitle: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.semibold,
    color: colors.info,
    marginBottom: spacing.sm,
  },
  rejectedHintText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights['2xl'],
  },

  // Success banner
  successBanner: {
    backgroundColor: colors.successBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    flexDirection: 'row',
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.success,
  },
  successIconSpacing: {
    marginRight: spacing.md,
    marginTop: spacing.xs,
  },
  successContent: {
    flex: 1,
  },
  successTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.success,
    marginBottom: spacing.xs,
  },
  successText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
    lineHeight: typography.lineHeights.base,
  },

  // Description banner
  descriptionBanner: {
    marginBottom: spacing.lg,
  },
  descriptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  descriptionLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.semibold,
    color: colors.info,
  },
  descriptionText: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    lineHeight: typography.lineHeights.base,
  },

  // Difficulty banner
  difficultyBanner: {
    backgroundColor: colors.warningBg,
    borderRadius: radii.lg,
    padding: spacing.lg,
    marginBottom: spacing.lg,
    borderWidth: 1,
    borderColor: colors.warning,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  difficultyLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.warning,
    marginBottom: spacing.xs,
  },
  difficultyText: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },

  // Card
  cardSpacing: {
    marginBottom: spacing.lg,
  },
  cardTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.semibold,
    color: colors.textPrimary,
    marginBottom: spacing.lg,
  },
  cardHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.lg,
  },
  editHint: {
    fontSize: typography.sizes.xs,
    color: colors.primary,
    fontStyle: 'italic',
  },

  // Info rows
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  infoLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },
  infoValue: {
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
    flex: 1,
    textAlign: 'right',
  },

  // Line items
  lineItem: {
    marginBottom: spacing.lg,
    paddingBottom: spacing.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.divider,
  },
  lineItemTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.sm,
  },
  lineItemIndex: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  lineItemIndexText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    color: colors.textOnPrimary,
  },
  removeItemBtn: {
    width: 28,
    height: 28,
    borderRadius: radii.full,
    backgroundColor: colors.errorBg,
    alignItems: 'center',
    justifyContent: 'center',
  },

  fieldLabel: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
    marginBottom: spacing.xs,
    marginTop: spacing.sm,
  },

  editInput: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    padding: spacing.md,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
  },
  editTextArea: {
    minHeight: 70,
    textAlignVertical: 'top',
  },
  editInputSmall: {
    backgroundColor: colors.bgSecondary,
    borderRadius: radii.md,
    padding: spacing.sm + 2,
    borderWidth: 1,
    borderColor: colors.border,
    fontSize: typography.sizes.sm,
    color: colors.textPrimary,
    textAlign: 'center',
  },

  lineItemValuesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing.xs,
    gap: spacing.sm,
  },
  valueCol: {
    flex: 1,
  },

  lineItemSubtotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: colors.divider,
  },
  subtotalLabel: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.medium,
    color: colors.textSecondary,
  },
  subtotalValue: {
    fontSize: typography.sizes.md,
    fontWeight: typography.weights.bold,
    color: colors.primary,
  },

  taxToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  taxCheckbox: {
    width: 22,
    height: 22,
    borderRadius: radii.sm,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.sm,
  },
  taxCheckboxActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  taxToggleLabel: {
    fontSize: typography.sizes.sm,
    color: colors.textSecondary,
  },

  addItemButton: {
    borderWidth: 2,
    borderColor: colors.primary,
    borderStyle: 'dashed',
    borderRadius: radii.md,
    padding: spacing.md,
    alignItems: 'center',
    marginTop: spacing.sm,
    flexDirection: 'row',
    justifyContent: 'center',
    gap: spacing.sm,
  },
  addItemText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
    color: colors.primary,
  },

  ratesRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  rateCol: {
    flex: 1,
  },

  // Totals
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: spacing.md,
  },
  totalLabel: {
    fontSize: typography.sizes.base,
    color: colors.textSecondary,
  },
  totalValue: {
    fontSize: typography.sizes.base,
    color: colors.textPrimary,
    fontWeight: typography.weights.medium,
  },
  grandTotalLabel: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    color: colors.textPrimary,
  },
  grandTotalValue: {
    fontSize: typography.sizes['2xl'],
    fontWeight: typography.weights.bold,
    color: colors.success,
  },

  // Actions
  actionBtnSpacing: {
    marginBottom: spacing.md,
  },
});
