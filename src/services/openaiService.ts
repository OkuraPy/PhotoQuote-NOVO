import * as FileSystem from 'expo-file-system/legacy';
import Constants from 'expo-constants';

// API key loaded from .env via app.config.js → expo-constants
const OPENAI_API_KEY = Constants.expoConfig?.extra?.openaiApiKey || '';
const MODEL = 'gpt-5.2-pro-2025-12-11';

function isRemoteUrl(uri: string): boolean {
  return uri.startsWith('http://') || uri.startsWith('https://');
}

export interface AILineItem {
  category: string;
  description: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  taxable: boolean;
}

export interface AIEstimateResult {
  lineItems: AILineItem[];
  confidence: number;
  notes: string;
  photoAnalysis: string;
}

export class PhotoValidationError extends Error {
  public readonly photoAnalysis: string;
  constructor(message: string, photoAnalysis: string) {
    super(message);
    this.name = 'PhotoValidationError';
    this.photoAnalysis = photoAnalysis;
  }
}

async function imageToBase64(uri: string): Promise<string> {
  try {
    if (isRemoteUrl(uri)) {
      const tempPath = `${FileSystem.cacheDirectory}temp_photo_${Date.now()}.jpg`;
      const download = await FileSystem.downloadAsync(uri, tempPath);
      const base64 = await FileSystem.readAsStringAsync(download.uri, {
        encoding: 'base64' as const,
      });
      FileSystem.deleteAsync(tempPath, { idempotent: true }).catch(() => {});
      return base64;
    }
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: 'base64' as const,
    });
    return base64;
  } catch (error) {
    console.warn(`[imageToBase64] Failed to convert image: ${uri}`, error);
    return '';
  }
}

export async function generateAIEstimate(params: {
  photoUris: string[];
  services: string[];
  description: string;
  sqft: number;
  linearFeet: number;
  propertyType: string;
  accessLevel: string;
  floorLevel: string;
  hasElevator: boolean;
  parkingType: string;
  city: string;
  state: string;
}): Promise<AIEstimateResult> {
  const systemPrompt = `You are a professional construction estimator with 20+ years of experience in the US market, specializing in residential and commercial renovation/construction projects.

YOUR PRIMARY RESPONSIBILITIES:
1. ANALYZE the provided photos carefully and determine what they show
2. VALIDATE that the photos are relevant to construction, renovation, or property maintenance work
3. GENERATE accurate, detailed cost estimates based on what you SEE in the photos combined with the project details provided

PHOTO VALIDATION RULES (CRITICAL):
- You MUST carefully examine each photo and describe what you see
- The photos MUST show construction-related content: buildings, rooms, walls, floors, roofs, plumbing, electrical, landscaping, fences, concrete, property exteriors/interiors, damage to repair, areas to renovate, etc.
- If the photos show objects that are NOT related to construction or property work (electronics, food, animals, random objects, selfies, vehicles not at a jobsite, etc.), you MUST reject the request
- When rejecting: set "rejected" to true and explain in "rejectionReason" exactly what the photos show and why they are not valid for a construction estimate

ESTIMATION RULES (when photos are valid):
- Base your estimate on what you ACTUALLY SEE in the photos, not just the description
- If the photos show specific conditions (water damage, mold, cracks, worn flooring, old paint, etc.), include appropriate line items to address them
- Use realistic pricing for the specified location and current market rates
- Each line item must have: category, detailed description, unit of measurement, quantity, unit price, and taxable flag
- Include 4-8 line items per service type covering: preparation, main work, finishing, and cleanup
- Materials are typically taxable; pure labor services may not be
- If you see issues in the photos not mentioned in the description (mold, water damage, structural concerns, code violations), ADD extra line items to address them
- Quantities should reflect measurements provided OR your visual estimate from the photos

Always respond with a valid JSON object. Do not include any text outside the JSON.`;

  const conditionsSummary = [
    `Property: ${params.propertyType}`,
    `Access: ${params.accessLevel}`,
    params.floorLevel !== '0' ? `Floor: ${params.floorLevel}` : null,
    params.floorLevel !== '0' ? `Elevator: ${params.hasElevator ? 'Yes' : 'No'}` : null,
    `Parking: ${params.parkingType}`,
  ].filter(Boolean).join(', ');

  const userText = `STEP 1: Carefully analyze each photo and describe what you see.
STEP 2: Determine if the photos are relevant to construction/renovation/property work.
STEP 3: If valid, generate a detailed cost estimate. If NOT valid, reject with explanation.

Project Details:
- Services requested: ${params.services.join(', ')}
- Client description: ${params.description || 'No description provided'}
- Location: ${params.city || 'Unknown'}, ${params.state || 'FL'}
- Property type: ${params.propertyType}
- Area: ${params.sqft > 0 ? params.sqft + ' sqft' : 'Not specified'}${params.linearFeet > 0 ? ', ' + params.linearFeet + ' linear feet' : ''}
- Conditions: ${conditionsSummary}

Return a JSON object with this EXACT structure:

If photos are VALID for construction estimate:
{
  "rejected": false,
  "photoAnalysis": "Detailed description of what you see in each photo (conditions, materials, damage, dimensions, etc.)",
  "lineItems": [
    {
      "category": "Category Name",
      "description": "Detailed description of the specific work to be performed, including materials and methods",
      "unit": "sqft | lf | each | job | day",
      "quantity": <number>,
      "unitPrice": <number in USD>,
      "taxable": true | false
    }
  ],
  "confidence": <number 0-100>,
  "notes": "Important notes, assumptions, or recommendations based on what you observed in the photos"
}

If photos are NOT VALID (not construction-related):
{
  "rejected": true,
  "rejectionReason": "Clear explanation of what the photos show and why they cannot be used for a construction estimate",
  "photoAnalysis": "Description of what was detected in the photos"
}

PRICING GUIDELINES for ${params.city || 'Florida'}, ${params.state || 'FL'}:
- Use current market rates for this specific location
- Adjust pricing for difficulty factors: ${conditionsSummary}
- Include all necessary preparation, protection, and cleanup work
- If photos reveal additional issues, add line items with appropriate pricing
- Be thorough: a real contractor would include ALL necessary work steps`;

  // Prepare photos (limit to 5 to manage costs)
  const photosToSend = params.photoUris.slice(0, 5);

  // Build content array with text + images (Responses API format)
  const userContent: any[] = [{ type: 'input_text', text: userText }];
  let validPhotoCount = 0;

  for (const uri of photosToSend) {
    try {
      // Always convert to base64 for reliability (avoids CDN issues, HEIC format issues)
      const b64 = await imageToBase64(uri);
      if (b64) {
        userContent.push({
          type: 'input_image',
          image_url: `data:image/jpeg;base64,${b64}`,
        });
        validPhotoCount++;
      }
    } catch (error) {
      console.warn(`[generateAIEstimate] Skipping photo ${uri}:`, error);
    }
  }

  if (validPhotoCount === 0) {
    throw new Error('No valid photos to analyze. Please upload at least one photo.');
  }

  if (!OPENAI_API_KEY) {
    throw new Error('OpenAI API key is not configured. Please check your environment settings.');
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 120000); // 2 min timeout

  let response: Response;
  try {
    response = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      instructions: systemPrompt,
      input: [
        { role: 'user', content: userContent },
      ],
      text: { format: { type: 'json_object' } },
      max_output_tokens: 4096,
    }),
    signal: controller.signal,
  });
  } catch (error: any) {
    clearTimeout(timeoutId);
    if (error?.name === 'AbortError') {
      throw new Error('AI request timed out. Please try again with fewer photos.');
    }
    throw new Error(`Network error: ${error?.message || 'Failed to connect to AI service'}`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();

  // Extract text from Responses API output structure
  const messageContent = data.output
    ?.filter((o: any) => o.type === 'message')
    ?.map((o: any) => o.content?.filter((c: any) => c.type === 'output_text')?.map((c: any) => c.text).join(''))
    ?.join('');

  if (!messageContent) {
    throw new Error('Empty response from OpenAI');
  }

  let parsed: any;
  // Clean common AI response issues before parsing
  let cleanedContent = messageContent.trim();
  // Remove markdown code fences if present (```json ... ```)
  cleanedContent = cleanedContent.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');

  try {
    parsed = JSON.parse(cleanedContent);
  } catch {
    // If AI returned text with JSON embedded, try to extract the largest JSON object
    const jsonMatch = cleanedContent.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      try {
        parsed = JSON.parse(jsonMatch[0]);
      } catch {
        console.error('[OpenAI] Malformed JSON response:', cleanedContent.substring(0, 500));
        throw new Error('AI returned malformed JSON. Please try again.');
      }
    } else {
      console.error('[OpenAI] No JSON found in response:', cleanedContent.substring(0, 500));
      throw new Error('AI returned an unexpected response. Please try again.');
    }
  }

  // Check if photos were rejected
  if (parsed.rejected === true) {
    throw new PhotoValidationError(
      parsed.rejectionReason || 'The photos provided are not related to construction or renovation work.',
      parsed.photoAnalysis || ''
    );
  }

  // Validate structure
  if (!Array.isArray(parsed.lineItems) || parsed.lineItems.length === 0) {
    throw new Error('Invalid response: no line items returned');
  }

  // Filter out items with no price (AI sometimes adds empty placeholder items)
  const validItems = parsed.lineItems.filter(
    (item: any) => item.category && (Number(item.unitPrice) > 0 || Number(item.quantity) > 0)
  );

  if (validItems.length === 0) {
    throw new Error('AI returned line items but none had valid pricing.');
  }

  // Normalize and validate each item
  const lineItems: AILineItem[] = validItems.map((item: any) => ({
    category: String(item.category || 'Unnamed Item'),
    description: String(item.description || ''),
    unit: String(item.unit || 'job'),
    quantity: Math.max(0, Number(item.quantity) || 1),
    unitPrice: Math.max(0, Number(item.unitPrice) || 0),
    taxable: item.taxable !== false,
  }));

  return {
    lineItems,
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 85)),
    notes: String(parsed.notes || ''),
    photoAnalysis: String(parsed.photoAnalysis || ''),
  };
}
