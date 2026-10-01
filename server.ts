import 'dotenv/config';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = 3000;

app.use(express.json({ limit: '12mb' }));

function getGeminiClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY' || apiKey.trim() === '') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

// ============================================================================
// 1. AI CLOTHING IMAGE ANALYSIS (/api/analyze-clothing)
// ============================================================================
app.post('/api/analyze-clothing', async (req, res) => {
  try {
    const { imageBase64, mimeType, hintName } = req.body;
    if (!imageBase64) {
      res.status(400).json({ error: 'Image data is required for analysis.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI service unavailable — using smart rule-based garment analysis.',
        fallback: true,
      });
      return;
    }

    const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');

    const promptText = `You are an expert personal fashion stylist and garment archivist with deep knowledge of both contemporary Western tailoring and East African / Tanzanian attire (such as Kitenge, Kanzu, Dashiki, Kaunda suits, linen safari shirts, and tropical smart-casual wear).
Analyze this clothing or accessory image carefully. ${hintName ? `User hint: "${hintName}".` : ''}

Classify the item accurately according to these taxonomy rules:
- category MUST be one of: "Tops", "Bottoms", "Footwear", "Accessories", "Traditional"
- subcategory MUST be the closest match from:
  Tops: "T-shirt", "Polo", "Shirt", "Sweater", "Hoodie", "Jacket", "Coat"
  Bottoms: "Jeans", "Chinos", "Formal trousers", "Cargo pants", "Shorts", "Other"
  Footwear: "Sneakers", "Loafers", "Oxford shoes", "Derby shoes", "Boots", "Sandals", "Other"
  Accessories: "Watch", "Belt", "Hat/cap", "Sunglasses", "Tie", "Bracelet", "Bag", "Other"
  Traditional: "Kanzu", "Kitenge", "Dashiki", "Traditional shirts", "Other cultural clothing"
- formality MUST be one of: "Casual", "Smart Casual", "Business", "Formal", "Traditional / Ceremonial"
- season MUST be one of: "All-Season", "Hot / Dry", "Warm / Humid", "Cool / Evening", "Rainy"
- fit MUST be one of: "Slim", "Regular", "Relaxed", "Tailored", "Oversized", "Standard"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType || 'image/jpeg',
              data: cleanBase64,
            },
          },
          { text: promptText },
        ],
      },
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            name: {
              type: Type.STRING,
              description: 'Refined editorial name of the garment (e.g., Cognac Leather Derby Shoes, Indigo Kitenge Short-Sleeve Shirt).',
            },
            category: {
              type: Type.STRING,
              description: 'Tops, Bottoms, Footwear, Accessories, or Traditional.',
            },
            subcategory: {
              type: Type.STRING,
              description: 'Subcategory of the item.',
            },
            primaryColor: {
              type: Type.STRING,
              description: 'Dominant color name (e.g., Navy, Ivory, Cognac Brown, Olive, Charcoal, Terracotta).',
            },
            secondaryColor: {
              type: Type.STRING,
              description: 'Secondary or accent color, or None if solid.',
            },
            pattern: {
              type: Type.STRING,
              description: 'Pattern (e.g., Solid, Striped, Kitenge Geometric, Checked, Embroidered, Textured).',
            },
            material: {
              type: Type.STRING,
              description: 'Estimated material (e.g., Linen, Cotton Poplin, Full-Grain Leather, Denim, Wool Blend).',
            },
            formality: {
              type: Type.STRING,
              description: 'Casual, Smart Casual, Business, Formal, or Traditional / Ceremonial.',
            },
            style: {
              type: Type.STRING,
              description: 'Style label (e.g., Smart Casual, Minimalist Tailored, Heritage Cultural, Relaxed Weekend).',
            },
            season: {
              type: Type.STRING,
              description: 'All-Season, Hot / Dry, Warm / Humid, Cool / Evening, or Rainy.',
            },
            fit: {
              type: Type.STRING,
              description: 'Slim, Regular, Relaxed, Tailored, Oversized, or Standard.',
            },
            possibleMatchingColors: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 5 complementary colors that pair well with this piece.',
            },
            suitableOccasions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: '3 to 6 occasions this piece suits (e.g. Business, Wedding, Dinner, Smart casual, Church, Date).',
            },
            stylistTip: {
              type: Type.STRING,
              description: 'One concise sentence explaining how to wear or pair this piece.',
            },
          },
          required: [
            'name',
            'category',
            'subcategory',
            'primaryColor',
            'secondaryColor',
            'pattern',
            'material',
            'formality',
            'style',
            'season',
            'fit',
            'possibleMatchingColors',
            'suitableOccasions',
            'stylistTip',
          ],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini model');
    }

    const parsed = JSON.parse(text.trim());
    res.json({ analysis: parsed, source: 'gemini' });
  } catch (error) {
    console.error('Error in /api/analyze-clothing:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to analyze clothing image with AI',
      fallback: true,
    });
  }
});

// ============================================================================
// 2. CUSTOM OCCASION INTERPRETER (/api/interpret-occasion)
// ============================================================================
app.post('/api/interpret-occasion', async (req, res) => {
  try {
    const { customOccasionText, locationCity } = req.body;
    if (!customOccasionText || typeof customOccasionText !== 'string') {
      res.status(400).json({ error: 'Custom occasion text is required.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI service unavailable — using rule-based occasion interpreter.',
        fallback: true,
      });
      return;
    }

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: `Interpret this user's event description for a personal wardrobe stylist app in East Africa / Tanzania (${locationCity || 'Dar es Salaam'}):
"${customOccasionText}"

Extract the occasion, dressCode, timeOfDay, locationContext, weatherContext, desiredStyle, and a brief 1-sentence stylist interpretation.`,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            occasion: {
              type: Type.STRING,
              description: 'Normalized or concise occasion title (e.g., Wedding, Church, Business Meeting, Graduation, Dinner Date).',
            },
            dressCode: {
              type: Type.STRING,
              description: 'Approximate dress code (e.g., Smart Casual, Formal Tailored, Traditional Ceremonial, Relaxed Casual).',
            },
            timeOfDay: {
              type: Type.STRING,
              description: 'Morning, Afternoon, Evening, or Night.',
            },
            locationContext: {
              type: Type.STRING,
              description: 'Inferred environment or venue (e.g., Garden Reception, Restaurant, Corporate Office, Outdoor Venue).',
            },
            weatherContext: {
              type: Type.STRING,
              description: 'Recommended climate consideration (e.g., Warm & Humid Coastal, Breezy Evening, Sunny Afternoon).',
            },
            desiredStyle: {
              type: Type.STRING,
              description: 'Recommended style direction (e.g., Refined Smart Casual, Classic Formal, Contemporary Heritage).',
            },
            summary: {
              type: Type.STRING,
              description: 'One friendly sentence confirming how the stylist interpreted the occasion.',
            },
          },
          required: [
            'occasion',
            'dressCode',
            'timeOfDay',
            'locationContext',
            'weatherContext',
            'desiredStyle',
            'summary',
          ],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini');
    }

    res.json({ interpretation: JSON.parse(text.trim()), source: 'gemini' });
  } catch (error) {
    console.error('Error in /api/interpret-occasion:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to interpret occasion',
      fallback: true,
    });
  }
});

// ============================================================================
// 3. AI PERSONAL STYLIST (/api/style-me)
// ============================================================================
app.post('/api/style-me', async (req, res) => {
  try {
    const {
      userProfile,
      wardrobe,
      occasion,
      timeOfDay,
      locationContext,
      weatherContext,
      desiredStyle,
      previousFeedback,
      excludeCombinationKeys,
    } = req.body;

    if (!Array.isArray(wardrobe) || wardrobe.length === 0) {
      res.status(400).json({ error: 'Wardrobe items are required to generate an outfit.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI stylist unavailable — switching to rule-based compatibility engine.',
        fallback: true,
      });
      return;
    }

    // Strip large base64 imageUrl strings before sending wardrobe catalog to Gemini
    const compactWardrobe = wardrobe.map((item: Record<string, unknown>) => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      primaryColor: item.primaryColor,
      secondaryColor: item.secondaryColor,
      pattern: item.pattern,
      material: item.material,
      formality: item.formality,
      style: item.style,
      season: item.season,
      fit: item.fit,
      occasions: item.occasions,
      isFavorite: item.isFavorite,
    }));

    const prompt = `You are MyWardrobe AI, a personal luxury & everyday wardrobe stylist tailored for East African / Tanzanian and global contexts.
Your task is to assemble the single best complete outfit for the user using ONLY items that exist in their provided WARDROBE JSON.

CRITICAL RULES:
1. ONLY select itemId values that actually exist in the provided WARDROBE array. Never invent item IDs.
2. Each outfit should aim to include:
   - A Top (or a Traditional garment such as a Kanzu, Kitenge shirt, or Dashiki)
   - A Bottom (trousers, chinos, jeans, shorts - note: if a full-length Kanzu robe is chosen, light trousers underneath are still appropriate)
   - Footwear (shoes, loafers, sneakers, derby, oxford, sandals)
   - Optional Jacket/Coat (only if appropriate for the formality, evening coolness, or business setting)
   - Belt (match leather tone with shoes where applicable: e.g. brown leather shoes with brown belt, black shoes with black belt)
   - Watch
   - Optional extra Accessory (sunglasses, bag, tie, bracelet, hat)
3. If the user's wardrobe does NOT contain a suitable item for a required or strongly recommended slot (for example, no Footwear, or no formal trousers for an Interview), leave that slot's ID as an empty string "" and add a clear entry to "missingItems" such as "Missing from wardrobe: Formal leather shoes".
4. Avoid clashing patterns (do not pair two loud competing patterns unless intentionally balanced) and avoid formality clashes (never pair a formal suit or Kanzu with athletic sneakers or beach sandals unless appropriate).
5. Respect warm-weather comfort (linen, breathable cotton, Kitenge, light chinos) when weather is Hot / Warm / Coastal (e.g., Dar es Salaam).
6. Do NOT include any internal chain-of-thought or numerical scores in "reasoning". Provide a polished, user-friendly 2-3 sentence explanation under "reasoning" ("Why this works") explaining the color harmony, formality balance, and shoe/accessory connection.
${Array.isArray(excludeCombinationKeys) && excludeCombinationKeys.length > 0 ? `7. IMPORTANT: Generate a DIFFERENT combination from these previously shown item ID sets: ${JSON.stringify(excludeCombinationKeys)}` : ''}

CONTEXT:
- USER PROFILE: ${JSON.stringify(userProfile || {})}
- OCCASION: ${occasion || 'Smart casual'}
- TIME: ${timeOfDay || 'Daytime'}
- LOCATION: ${locationContext || 'City venue'}
- WEATHER: ${weatherContext || 'Warm & Pleasant (28°C)'}
- DESIRED STYLE: ${desiredStyle || 'Smart casual'}
- RECENT FEEDBACK SIGNALS: ${JSON.stringify((previousFeedback || []).slice(0, 8))}
- WARDROBE CATALOG: ${JSON.stringify(compactWardrobe)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Editorial title for this outfit (e.g., Coastal Evening Smart-Casual, Heritage Friday Tailoring).',
            },
            occasion: {
              type: Type.STRING,
              description: 'The target occasion.',
            },
            dressCode: {
              type: Type.STRING,
              description: 'The dress code classification (e.g., Smart Casual, Business Formal, Ceremonial Heritage).',
            },
            outfit: {
              type: Type.OBJECT,
              properties: {
                topId: { type: Type.STRING, description: 'itemId of the selected Top or Traditional shirt/tunic, or empty string if missing.' },
                bottomId: { type: Type.STRING, description: 'itemId of the selected Bottom, or empty string if missing.' },
                footwearId: { type: Type.STRING, description: 'itemId of the selected Footwear, or empty string if missing.' },
                jacketId: { type: Type.STRING, description: 'itemId of optional Jacket/Blazer, or empty string if not needed/missing.' },
                beltId: { type: Type.STRING, description: 'itemId of selected Belt, or empty string if not needed/missing.' },
                watchId: { type: Type.STRING, description: 'itemId of selected Watch, or empty string if missing.' },
                accessoryId: { type: Type.STRING, description: 'itemId of additional Accessory (sunglasses, tie, bag, etc.), or empty string.' },
              },
              required: ['topId', 'bottomId', 'footwearId', 'jacketId', 'beltId', 'watchId', 'accessoryId'],
            },
            reasoning: {
              type: Type.STRING,
              description: 'Short, user-friendly explanation of why this outfit works (color harmony, occasion fit, belt/shoe pairing).',
            },
            missingItems: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'List of items missing from the wardrobe if any key slot could not be filled appropriately.',
            },
            alternatives: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  slot: { type: Type.STRING, description: 'top, bottom, footwear, jacket, belt, watch, or accessory' },
                  itemId: { type: Type.STRING, description: 'Valid itemId from the wardrobe that can swap into this slot' },
                  reason: { type: Type.STRING, description: 'Brief note on how this swap shifts the look' },
                },
                required: ['slot', 'itemId', 'reason'],
              },
            },
          },
          required: ['title', 'occasion', 'dressCode', 'outfit', 'reasoning', 'missingItems', 'alternatives'],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini stylist');
    }

    const parsed = JSON.parse(text.trim());
    res.json({ recommendation: parsed, source: 'gemini' });
  } catch (error) {
    console.error('Error in /api/style-me:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to generate AI outfit recommendation',
      fallback: true,
    });
  }
});

// ============================================================================
// 4. AI TRIP CAPSULE PACKING PLANNER (/api/plan-trip)
// ============================================================================
app.post('/api/plan-trip', async (req, res) => {
  try {
    const {
      destination,
      durationDays,
      tripVibe,
      wardrobe,
      userProfile,
    } = req.body;

    if (!Array.isArray(wardrobe) || wardrobe.length === 0) {
      res.status(400).json({ error: 'Wardrobe items are required to plan a trip packing list.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(503).json({
        error: 'AI stylist unavailable — switching to rule-based trip capsule engine.',
        fallback: true,
      });
      return;
    }

    const compactWardrobe = wardrobe.map((item: Record<string, unknown>) => ({
      itemId: item.itemId,
      name: item.name,
      category: item.category,
      subcategory: item.subcategory,
      primaryColor: item.primaryColor,
      secondaryColor: item.secondaryColor,
      pattern: item.pattern,
      material: item.material,
      formality: item.formality,
      style: item.style,
      season: item.season,
      occasions: item.occasions,
    }));

    const days = Math.max(1, Math.min(30, Number(durationDays) || 4));
    const prompt = `You are MyWardrobe AI, an expert travel capsule wardrobe stylist.
Create an optimized packing list ("Trip" list) strictly from the user's existing WARDROBE JSON for:
- DESTINATION: ${destination || 'Zanzibar, Tanzania'}
- DURATION: ${days} days
- TRIP PURPOSE / VIBE: ${tripVibe || 'Smart Casual & Leisure'}
- USER PROFILE: ${JSON.stringify(userProfile || {})}

CRITICAL RULES:
1. ONLY select itemId values that exist in the provided WARDROBE CATALOG. Never invent IDs.
2. Optimize for maximum mix-and-match versatility so the user packs light while having enough tops, bottoms, shoes, optional layer/jacket, belt, watch, and accessories for ${days} days.
3. Match the climate and culture of ${destination || 'the destination'}.
4. Return a concise 2-3 sentence "rationale" explaining why this capsule works (how the colors/shoes coordinate across multiple days).
5. WARDROBE CATALOG: ${JSON.stringify(compactWardrobe)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Editorial title for this trip packing list (e.g., 4-Day Zanzibar Coastal Capsule).',
            },
            climate: {
              type: Type.STRING,
              description: 'Inferred destination weather/climate (e.g., Warm & Breezy Coastal 29°C).',
            },
            itemIds: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Array of valid itemIds from the user wardrobe to pack.',
            },
            rationale: {
              type: Type.STRING,
              description: '2-3 sentence explanation of why this set of clothes is optimal for the trip.',
            },
            outfitCombinationsCount: {
              type: Type.INTEGER,
              description: 'Estimated number of distinct outfits these packed items can create.',
            },
            missingSuggestions: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Optional list of missing items if the wardrobe lacks essentials for the destination.',
            },
          },
          required: [
            'title',
            'climate',
            'itemIds',
            'rationale',
            'outfitCombinationsCount',
            'missingSuggestions',
          ],
        },
      },
    });

    const text = response.text;
    if (!text) {
      throw new Error('Empty response from Gemini trip planner');
    }

    res.json({ tripCapsule: JSON.parse(text.trim()), source: 'gemini' });
  } catch (error) {
    console.error('Error in /api/plan-trip:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Failed to plan trip capsule with AI',
      fallback: true,
    });
  }
});

// ============================================================================
// 5. LIVE WEATHER API (/api/weather) — OpenWeatherMap + Open-Meteo Fallback
// ============================================================================
interface CityPresetCoords {
  name: string;
  country: string;
  lat: number;
  lon: number;
  defaultTempC: number;
  defaultHumidity: number;
  defaultCondition: string;
}

const KNOWN_CITY_COORDS: Record<string, CityPresetCoords> = {
  'dar es salaam': {
    name: 'Dar es Salaam',
    country: 'TZ',
    lat: -6.7924,
    lon: 39.2083,
    defaultTempC: 29,
    defaultHumidity: 74,
    defaultCondition: 'Warm & Breezy',
  },
  zanzibar: {
    name: 'Zanzibar',
    country: 'TZ',
    lat: -6.1659,
    lon: 39.2026,
    defaultTempC: 30,
    defaultHumidity: 76,
    defaultCondition: 'Hot & Sunny Coastal',
  },
  arusha: {
    name: 'Arusha',
    country: 'TZ',
    lat: -3.3869,
    lon: 36.683,
    defaultTempC: 22,
    defaultHumidity: 58,
    defaultCondition: 'Cool Highland Breeze',
  },
  dodoma: {
    name: 'Dodoma',
    country: 'TZ',
    lat: -6.163,
    lon: 35.7516,
    defaultTempC: 27,
    defaultHumidity: 46,
    defaultCondition: 'Warm & Dry',
  },
  nairobi: {
    name: 'Nairobi',
    country: 'KE',
    lat: -1.2921,
    lon: 36.8219,
    defaultTempC: 21,
    defaultHumidity: 55,
    defaultCondition: 'Cool Highland & Crisp',
  },
  mombasa: {
    name: 'Mombasa',
    country: 'KE',
    lat: -4.0435,
    lon: 39.6682,
    defaultTempC: 30,
    defaultHumidity: 75,
    defaultCondition: 'Warm & Humid Coastal',
  },
  'cape town': {
    name: 'Cape Town',
    country: 'ZA',
    lat: -33.9249,
    lon: 18.4241,
    defaultTempC: 20,
    defaultHumidity: 64,
    defaultCondition: 'Cool Coastal Breeze',
  },
  london: {
    name: 'London',
    country: 'GB',
    lat: 51.5074,
    lon: -0.1278,
    defaultTempC: 16,
    defaultHumidity: 68,
    defaultCondition: 'Cool & Overcast',
  },
  dubai: {
    name: 'Dubai',
    country: 'AE',
    lat: 25.2048,
    lon: 55.2708,
    defaultTempC: 33,
    defaultHumidity: 52,
    defaultCondition: 'Hot & Sunny',
  },
};

function mapWmoCodeToCondition(code: number): { condition: string; isRainy: boolean } {
  if (code === 0) return { condition: 'Clear Sky', isRainy: false };
  if (code === 1 || code === 2) return { condition: 'Partly Cloudy', isRainy: false };
  if (code === 3) return { condition: 'Overcast Clouds', isRainy: false };
  if (code === 45 || code === 48) return { condition: 'Misty Breeze', isRainy: false };
  if (code >= 51 && code <= 67) return { condition: 'Rain Showers', isRainy: true };
  if (code >= 71 && code <= 77) return { condition: 'Crisp & Cold', isRainy: false };
  if (code >= 80 && code <= 82) return { condition: 'Passing Rain Shower', isRainy: true };
  if (code >= 95) return { condition: 'Thunderstorm & Rain', isRainy: true };
  return { condition: 'Pleasant & Clear', isRainy: false };
}

function buildStylistWeatherContext(params: {
  tempC: number;
  humidity: number;
  condition: string;
  windKmh?: number;
  isRainy?: boolean;
  cityName: string;
}): { weatherContext: string; stylistDescriptor: string; stylingTip: string } {
  const roundedTemp = Math.round(params.tempC);
  const condLower = params.condition.toLowerCase();
  const isRainy =
    Boolean(params.isRainy) ||
    condLower.includes('rain') ||
    condLower.includes('drizzle') ||
    condLower.includes('shower') ||
    condLower.includes('storm');

  let stylistDescriptor = 'Warm & Breezy';
  let stylingTip = 'Breathable cotton, linen weaves, and relaxed smart-casual silhouettes recommended.';

  if (isRainy) {
    stylistDescriptor = 'Rainy Season Shower';
    stylingTip = 'Opt for structured layers, darker trouser hems, and closed leather footwear.';
  } else if (roundedTemp >= 31) {
    stylistDescriptor = 'Hot & Sunny Coastal';
    stylingTip = 'Prioritize lightweight linen, short-sleeve woven shirts, and unlined tailoring.';
  } else if (roundedTemp >= 27 && params.humidity >= 70) {
    stylistDescriptor = 'Warm & Humid';
    stylingTip = 'Moisture-wicking poplin, open weaves, and light earthy or ivory tones work best.';
  } else if (roundedTemp >= 24) {
    stylistDescriptor = 'Warm & Breezy';
    stylingTip = 'Ideal for breathable shirts, tailored chinos, and optional unlined evening blazers.';
  } else if (roundedTemp <= 22) {
    stylistDescriptor = 'Cool Evening / Highland';
    stylingTip = 'Great conditions for layering a tailored blazer, fine-gauge knitwear, or structured jacket.';
  }

  const weatherContext = `${stylistDescriptor} (${roundedTemp}°C) · ${params.condition} in ${params.cityName}`;
  return { weatherContext, stylistDescriptor, stylingTip };
}

app.get('/api/weather', async (req, res) => {
  const rawCity = typeof req.query.city === 'string' ? req.query.city.trim() : '';
  const rawLat = typeof req.query.lat === 'string' ? parseFloat(req.query.lat) : NaN;
  const rawLon = typeof req.query.lon === 'string' ? parseFloat(req.query.lon) : NaN;
  const hasCoords = !Number.isNaN(rawLat) && !Number.isNaN(rawLon);

  const owmApiKey = process.env.OPENWEATHERMAP_API_KEY;
  const hasValidOwmKey =
    Boolean(owmApiKey) &&
    owmApiKey !== 'MY_OPENWEATHERMAP_API_KEY' &&
    owmApiKey!.trim().length > 5;

  // 1. Try OpenWeatherMap API first when OPENWEATHERMAP_API_KEY is configured
  if (hasValidOwmKey) {
    try {
      const queryParam = hasCoords
        ? `lat=${encodeURIComponent(rawLat)}&lon=${encodeURIComponent(rawLon)}`
        : `q=${encodeURIComponent(rawCity || 'Dar es Salaam,TZ')}`;
      const owmUrl = `https://api.openweathermap.org/data/2.5/weather?${queryParam}&units=metric&appid=${encodeURIComponent(
        owmApiKey!.trim()
      )}`;
      const owmResp = await fetch(owmUrl, { signal: AbortSignal.timeout(6000) });
      if (owmResp.ok) {
        const data = (await owmResp.json()) as {
          name?: string;
          sys?: { country?: string };
          main?: { temp?: number; feels_like?: number; humidity?: number };
          weather?: { main?: string; description?: string }[];
          wind?: { speed?: number };
          coord?: { lat?: number; lon?: number };
        };
        const tempC = Math.round(data.main?.temp ?? 28);
        const feelsLikeC = Math.round(data.main?.feels_like ?? tempC);
        const humidity = Math.round(data.main?.humidity ?? 68);
        const windKmh = Math.round((data.wind?.speed ?? 3.5) * 3.6);
        const rawDesc = data.weather?.[0]?.description || data.weather?.[0]?.main || 'Clear Sky';
        const condition = rawDesc.replace(/\b\w/g, (c) => c.toUpperCase());
        const cityName = data.name || rawCity.split(',')[0] || 'Dar es Salaam';
        const country = data.sys?.country || '';

        const { weatherContext, stylistDescriptor, stylingTip } = buildStylistWeatherContext({
          tempC,
          humidity,
          condition,
          windKmh,
          cityName,
        });

        res.json({
          provider: 'OpenWeatherMap',
          city: cityName,
          country,
          tempC,
          feelsLikeC,
          humidity,
          windKmh,
          condition,
          stylistDescriptor,
          stylingTip,
          weatherContext,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    } catch (owmError) {
      console.warn('OpenWeatherMap lookup failed, falling back to Open-Meteo:', owmError);
    }
  }

  // 2. Resolve coordinates & city name for Open-Meteo live weather
  let targetLat = hasCoords ? rawLat : -6.7924;
  let targetLon = hasCoords ? rawLon : 39.2083;
  let resolvedCity = rawCity ? rawCity.split(',')[0].trim() : 'Dar es Salaam';
  let resolvedCountry = 'TZ';

  if (!hasCoords && rawCity) {
    const cleanKey = rawCity.toLowerCase().split(',')[0].trim();
    const matchedPreset = Object.entries(KNOWN_CITY_COORDS).find(
      ([key]) => cleanKey.includes(key) || key.includes(cleanKey)
    );
    if (matchedPreset) {
      targetLat = matchedPreset[1].lat;
      targetLon = matchedPreset[1].lon;
      resolvedCity = matchedPreset[1].name;
      resolvedCountry = matchedPreset[1].country;
    } else {
      try {
        const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
          cleanKey
        )}&count=1&language=en&format=json`;
        const geoResp = await fetch(geoUrl, { signal: AbortSignal.timeout(4500) });
        if (geoResp.ok) {
          const geoData = (await geoResp.json()) as {
            results?: { name: string; country_code?: string; latitude: number; longitude: number }[];
          };
          const first = geoData.results?.[0];
          if (first) {
            targetLat = first.latitude;
            targetLon = first.longitude;
            resolvedCity = first.name;
            resolvedCountry = (first.country_code || '').toUpperCase();
          }
        }
      } catch {
        // Keep default coordinates if geocoding network call fails
      }
    }
  } else if (hasCoords) {
    // Reverse geocode or find closest known city name
    try {
      const revUrl = `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${encodeURIComponent(
        targetLat
      )}&longitude=${encodeURIComponent(targetLon)}&localityLanguage=en`;
      const revResp = await fetch(revUrl, { signal: AbortSignal.timeout(4000) });
      if (revResp.ok) {
        const revData = (await revResp.json()) as {
          city?: string;
          locality?: string;
          principalSubdivision?: string;
          countryCode?: string;
        };
        resolvedCity =
          revData.city || revData.locality || revData.principalSubdivision || 'Local Area';
        resolvedCountry = revData.countryCode || '';
      }
    } catch {
      resolvedCity = rawCity ? rawCity.split(',')[0].trim() : 'Current Location';
    }
  }

  // 3. Query Open-Meteo Real-Time Forecast API
  try {
    const meteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${encodeURIComponent(
      targetLat
    )}&longitude=${encodeURIComponent(
      targetLon
    )}&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m&timezone=auto`;
    const meteoResp = await fetch(meteoUrl, { signal: AbortSignal.timeout(5500) });
    if (meteoResp.ok) {
      const meteoData = (await meteoResp.json()) as {
        current?: {
          temperature_2m?: number;
          relative_humidity_2m?: number;
          apparent_temperature?: number;
          precipitation?: number;
          weather_code?: number;
          wind_speed_10m?: number;
        };
      };
      const cur = meteoData.current;
      if (cur && typeof cur.temperature_2m === 'number') {
        const tempC = Math.round(cur.temperature_2m);
        const feelsLikeC = Math.round(cur.apparent_temperature ?? tempC);
        const humidity = Math.round(cur.relative_humidity_2m ?? 68);
        const windKmh = Math.round(cur.wind_speed_10m ?? 12);
        const { condition, isRainy } = mapWmoCodeToCondition(cur.weather_code ?? 1);

        const { weatherContext, stylistDescriptor, stylingTip } = buildStylistWeatherContext({
          tempC,
          humidity,
          condition,
          windKmh,
          isRainy: isRainy || (cur.precipitation ?? 0) > 0.4,
          cityName: resolvedCity,
        });

        res.json({
          provider: 'Open-Meteo Live Weather',
          city: resolvedCity,
          country: resolvedCountry,
          tempC,
          feelsLikeC,
          humidity,
          windKmh,
          condition,
          stylistDescriptor,
          stylingTip,
          weatherContext,
          updatedAt: new Date().toISOString(),
        });
        return;
      }
    }
  } catch (meteoError) {
    console.warn('Open-Meteo weather fetch failed, using climate profile fallback:', meteoError);
  }

  // 4. Offline / Resilient Fallback
  const cleanKey = resolvedCity.toLowerCase();
  const preset =
    Object.entries(KNOWN_CITY_COORDS).find(
      ([k]) => cleanKey.includes(k) || k.includes(cleanKey)
    )?.[1] || KNOWN_CITY_COORDS['dar es salaam'];

  const { weatherContext, stylistDescriptor, stylingTip } = buildStylistWeatherContext({
    tempC: preset.defaultTempC,
    humidity: preset.defaultHumidity,
    condition: preset.defaultCondition,
    windKmh: 14,
    cityName: resolvedCity,
  });

  res.json({
    provider: 'Regional Climate Engine',
    city: resolvedCity,
    country: resolvedCountry || preset.country,
    tempC: preset.defaultTempC,
    feelsLikeC: preset.defaultTempC + 1,
    humidity: preset.defaultHumidity,
    windKmh: 14,
    condition: preset.defaultCondition,
    stylistDescriptor,
    stylingTip,
    weatherContext,
    updatedAt: new Date().toISOString(),
  });
});

// ============================================================================
// VITE MIDDLEWARE (DEVELOPMENT) OR STATIC DIST (PRODUCTION)
// ============================================================================
async function startServer() {
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`MyWardrobe AI server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
