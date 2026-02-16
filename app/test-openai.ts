/**
 * Teste standalone da API OpenAI
 *
 * Execute com: npx ts-node test-openai.ts
 * Ou com:      npx tsx test-openai.ts
 */

import 'dotenv/config';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY || '';

// Models to test in order of preference
const MODELS_TO_TEST = [
  'gpt-5.2',
  'gpt-5.2-chat-latest',
  'gpt-4.1',
  'gpt-4o',
];

async function testListModels() {
  console.log('========================================');
  console.log('TEST 1: Listing available models');
  console.log('========================================');

  try {
    const response = await fetch('https://api.openai.com/v1/models', {
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error listing models (${response.status}): ${errorText}`);
      return [];
    }

    const data = await response.json();
    const modelIds: string[] = data.data.map((m: any) => m.id).sort();

    // Filter for GPT models
    const gptModels = modelIds.filter((id: string) =>
      id.startsWith('gpt-') || id.startsWith('o1') || id.startsWith('o3') || id.startsWith('o4')
    );

    console.log(`✅ API key is valid. Found ${modelIds.length} models total.`);
    console.log(`\nGPT/Reasoning models available:`);
    gptModels.forEach((id: string) => console.log(`  - ${id}`));

    return modelIds;
  } catch (err) {
    console.log(`❌ Network error: ${err}`);
    return [];
  }
}

async function testSimpleChat(model: string) {
  console.log(`\n========================================`);
  console.log(`TEST 2: Simple chat with model "${model}"`);
  console.log(`========================================`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'user', content: 'Reply with exactly: "Hello, API is working!"' },
        ],
        max_completion_tokens: 50,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Error (${response.status}): ${errorText}`);
      return false;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    console.log(`✅ Model "${model}" responded: ${reply}`);
    console.log(`   Usage: ${JSON.stringify(data.usage)}`);
    return true;
  } catch (err) {
    console.log(`❌ Network error: ${err}`);
    return false;
  }
}

async function testJsonMode(model: string) {
  console.log(`\n========================================`);
  console.log(`TEST 3: JSON mode with model "${model}"`);
  console.log(`========================================`);

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'system',
            content: 'You are a helpful assistant. Always respond with valid JSON.'
          },
          {
            role: 'user',
            content: 'Return a JSON object with fields: "name" (string), "value" (number), "active" (boolean). Use example values.'
          },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 200,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ JSON mode error (${response.status}): ${errorText}`);
      return false;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    console.log(`✅ JSON response: ${content}`);

    // Try to parse
    try {
      const parsed = JSON.parse(content);
      console.log(`✅ Valid JSON parsed:`, parsed);
      return true;
    } catch {
      console.log(`❌ Response is not valid JSON`);
      return false;
    }
  } catch (err) {
    console.log(`❌ Network error: ${err}`);
    return false;
  }
}

async function testVision(model: string) {
  console.log(`\n========================================`);
  console.log(`TEST 4: Vision (image input) with model "${model}"`);
  console.log(`========================================`);

  // Use a tiny 1x1 pixel red PNG as test image (base64)
  const tinyRedPng = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8/5+hHgAHggJ/PchI7wAAAABJRU5ErkJggg==';

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: 'What color is this image? Reply with just the color name.' },
              {
                type: 'image_url',
                image_url: {
                  url: `data:image/png;base64,${tinyRedPng}`,
                  detail: 'low',
                },
              },
            ],
          },
        ],
        max_completion_tokens: 50,
        temperature: 0,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Vision error (${response.status}): ${errorText}`);
      return false;
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content;
    console.log(`✅ Vision response: ${reply}`);
    return true;
  } catch (err) {
    console.log(`❌ Network error: ${err}`);
    return false;
  }
}

async function testEstimatePrompt(model: string) {
  console.log(`\n========================================`);
  console.log(`TEST 5: Full estimate prompt (no images) with model "${model}"`);
  console.log(`========================================`);

  const systemPrompt = `You are a professional construction estimator. Generate cost estimates as JSON.
Always respond with a valid JSON object. Do not include any text outside the JSON.`;

  const userText = `Generate a simple cost estimate for painting a residential room.

Project Details:
- Services requested: Interior Painting
- Location: Miami, FL
- Area: 200 sqft

Return a JSON object with this structure:
{
  "lineItems": [
    {
      "category": "Category Name",
      "description": "Work description",
      "unit": "sqft",
      "quantity": 200,
      "unitPrice": 3.50,
      "taxable": true
    }
  ],
  "confidence": 85,
  "notes": "Notes about the estimate"
}`;

  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userText },
        ],
        response_format: { type: 'json_object' },
        max_completion_tokens: 4096,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.log(`❌ Estimate error (${response.status}): ${errorText}`);
      return false;
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      console.log(`❌ Empty response from API`);
      return false;
    }

    const parsed = JSON.parse(content);

    if (!Array.isArray(parsed.lineItems) || parsed.lineItems.length === 0) {
      console.log(`❌ No line items in response:`, parsed);
      return false;
    }

    console.log(`✅ Estimate generated successfully!`);
    console.log(`   Line items: ${parsed.lineItems.length}`);
    console.log(`   Confidence: ${parsed.confidence}%`);
    console.log(`   Notes: ${parsed.notes}`);
    console.log(`\n   Items:`);
    parsed.lineItems.forEach((item: any, i: number) => {
      console.log(`   ${i + 1}. [${item.category}] ${item.description} - ${item.quantity} ${item.unit} @ $${item.unitPrice}`);
    });

    return true;
  } catch (err) {
    console.log(`❌ Error: ${err}`);
    return false;
  }
}

async function main() {
  console.log('🔍 OpenAI API Test Suite');
  console.log(`   Key: ${OPENAI_API_KEY.substring(0, 20)}...${OPENAI_API_KEY.substring(OPENAI_API_KEY.length - 4)}`);
  console.log(`   Date: ${new Date().toISOString()}\n`);

  // Test 1: List models and verify API key
  const availableModels = await testListModels();

  // Find the first working model
  let workingModel = '';

  for (const model of MODELS_TO_TEST) {
    const isAvailable = availableModels.includes(model);
    console.log(`\n   Model "${model}" in list: ${isAvailable ? '✅ YES' : '❌ NO'}`);
  }

  // Test 2: Try each model for simple chat
  for (const model of MODELS_TO_TEST) {
    const works = await testSimpleChat(model);
    if (works && !workingModel) {
      workingModel = model;
      console.log(`\n   >>> Using "${model}" for remaining tests <<<`);
      break;
    }
  }

  if (!workingModel) {
    console.log('\n❌ No working model found! Check your API key and plan.');
    return;
  }

  // Test 3: JSON mode
  await testJsonMode(workingModel);

  // Test 4: Vision
  await testVision(workingModel);

  // Test 5: Full estimate prompt
  await testEstimatePrompt(workingModel);

  console.log('\n========================================');
  console.log('SUMMARY');
  console.log('========================================');
  console.log(`Working model: ${workingModel}`);

  if (workingModel !== 'gpt-5.2') {
    console.log(`\n⚠️  IMPORTANT: The current openaiService.ts uses "gpt-5.2".`);
    console.log(`   You should update it to use "${workingModel}" instead.`);
    console.log(`   File: app/src/services/openaiService.ts, line 5`);
  }
}

main().catch(console.error);
