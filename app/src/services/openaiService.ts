import * as FileSystem from 'expo-file-system';
import Constants from 'expo-constants';

// API key loaded from .env via app.config.js → expo-constants
const OPENAI_API_KEY = Constants.expoConfig?.extra?.openaiApiKey || '';
const MODEL = 'gpt-5.2';

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
}

async function imageToBase64(uri: string): Promise<string> {
  try {
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64;
  } catch {
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
  const systemPrompt = `You are a professional construction estimator with 20+ years of experience in the US market. You analyze construction site photos and project details to generate accurate, detailed cost estimates.

Your estimates should include realistic pricing based on current market rates for the specified location. Each line item should have a clear category, detailed description of the work, appropriate unit of measurement, quantity, and unit price.

Always respond with a valid JSON object matching the requested schema. Do not include any text outside the JSON.`;

  const conditionsSummary = [
    `Property: ${params.propertyType}`,
    `Access: ${params.accessLevel}`,
    params.floorLevel !== '0' ? `Floor: ${params.floorLevel}` : null,
    params.floorLevel !== '0' ? `Elevator: ${params.hasElevator ? 'Yes' : 'No'}` : null,
    `Parking: ${params.parkingType}`,
  ].filter(Boolean).join(', ');

  const userText = `Analyze these construction photos and generate a detailed cost estimate.

Project Details:
- Services requested: ${params.services.join(', ')}
- Client description: ${params.description || 'No description provided'}
- Location: ${params.city || 'Unknown'}, ${params.state || 'FL'}
- Property type: ${params.propertyType}
- Area: ${params.sqft > 0 ? params.sqft + ' sqft' : 'Not specified'}${params.linearFeet > 0 ? ', ' + params.linearFeet + ' linear feet' : ''}
- Conditions: ${conditionsSummary}

Generate a complete estimate with all necessary line items. Return a JSON object with this structure:
{
  "lineItems": [
    {
      "category": "Category Name (e.g., Surface Preparation)",
      "description": "Detailed description of the specific work to be performed, including materials and methods",
      "unit": "sqft" | "lf" | "each" | "job" | "day",
      "quantity": <number>,
      "unitPrice": <number in USD>,
      "taxable": true | false
    }
  ],
  "confidence": <number 0-100, your confidence in the accuracy of this estimate>,
  "notes": "Important notes, assumptions, or recommendations based on what you observed in the photos"
}

Guidelines:
- Include 4-8 line items per service type (preparation, main work, finishing, cleanup)
- Use realistic pricing for ${params.city || 'Florida'}, ${params.state || 'FL'} market rates
- If photos show damage, complexity, or special conditions, adjust pricing accordingly
- Materials are typically taxable, pure labor services may not be
- Add extra items if photos reveal issues not mentioned in the description (mold, water damage, structural concerns, etc.)
- Quantities should reflect the area/measurements provided or estimated from photos
- Include all necessary preparation, protection, and cleanup work`;

  // Convert photos to base64 (limit to 5 to manage costs)
  const photosToSend = params.photoUris.slice(0, 5);
  const base64Photos: string[] = [];

  for (const uri of photosToSend) {
    const b64 = await imageToBase64(uri);
    if (b64) base64Photos.push(b64);
  }

  // Build content array with text + images
  const content: any[] = [{ type: 'text', text: userText }];

  for (const b64 of base64Photos) {
    content.push({
      type: 'image_url',
      image_url: {
        url: `data:image/jpeg;base64,${b64}`,
        detail: 'low',
      },
    });
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${OPENAI_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content },
      ],
      response_format: { type: 'json_object' },
      max_completion_tokens: 4096,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const messageContent = data.choices?.[0]?.message?.content;

  if (!messageContent) {
    throw new Error('Empty response from OpenAI');
  }

  const parsed = JSON.parse(messageContent);

  // Validate structure
  if (!Array.isArray(parsed.lineItems) || parsed.lineItems.length === 0) {
    throw new Error('Invalid response: no line items returned');
  }

  // Normalize and validate each item
  const lineItems: AILineItem[] = parsed.lineItems.map((item: any) => ({
    category: String(item.category || 'Unnamed Item'),
    description: String(item.description || ''),
    unit: String(item.unit || 'job'),
    quantity: Number(item.quantity) || 1,
    unitPrice: Number(item.unitPrice) || 0,
    taxable: item.taxable !== false,
  }));

  return {
    lineItems,
    confidence: Math.min(100, Math.max(0, Number(parsed.confidence) || 85)),
    notes: String(parsed.notes || ''),
  };
}
