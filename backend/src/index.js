import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  : null;

const RECIPE_SCHEMA = `{
  "title": "string",
  "app": "string (source platform e.g. TikTok, Instagram, Blog, YouTube)",
  "handle": "string (creator handle or site name)",
  "servings": number,
  "time": number (minutes),
  "rating": "string like 4.8",
  "tags": ["string (ONE main category from: Quick, Dinner, Breakfast, Lunch, Vegetarian, High-protein)"],
  "kcal": number,
  "p": number (protein grams),
  "c": number (carbs grams),
  "f": number (fat grams),
  "ingredients": [{ "a": "amount", "n": "name", "aisle": "Produce|Meat & Seafood|Dairy & Eggs|Bakery|Pantry|Frozen" }],
  "steps": ["string"]
}`;

function detectSource(url) {
  const u = url.toLowerCase();
  if (u.includes('tiktok')) return { app: 'TikTok', handle: '@creator' };
  if (u.includes('instagram')) return { app: 'Instagram', handle: '@creator' };
  if (u.includes('youtube') || u.includes('youtu.be')) return { app: 'YouTube', handle: '@channel' };
  if (u.includes('pinterest')) return { app: 'Pinterest', handle: '@creator' };
  return { app: 'Blog', handle: new URL(url).hostname.replace('www.', '') };
}

// Instagram/Facebook/Threads only embed the full caption in their og: meta
// tags when the request comes from a known social-scraper user-agent.
const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'fb.watch', 'threads.net'];

function isSocialUrl(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return SOCIAL_HOSTS.some((h) => host.endsWith(h));
  } catch {
    return false;
  }
}

async function fetchPageText(url) {
  const social = isSocialUrl(url);
  const userAgent = social
    ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const res = await fetch(url, {
    headers: {
      'User-Agent': userAgent,
      Accept: 'text/html,application/xhtml+xml',
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    throw new Error(`Could not fetch URL (${res.status})`);
  }

  const html = await res.text();
  const $ = cheerio.load(html);

  // og:title / og:description hold the caption — read them BEFORE stripping nodes
  const og = {
    title: $('meta[property="og:title"]').attr('content') || '',
    description: $('meta[property="og:description"]').attr('content') || '',
    metaDescription: $('meta[name="description"]').attr('content') || '',
    image:
      $('meta[property="og:image"]').attr('content') ||
      $('meta[name="twitter:image"]').attr('content') ||
      '',
  };

  $('script, style, nav, footer, header, noscript').remove();

  const jsonLd = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).html() || '');
      jsonLd.push(typeof data === 'string' ? data : JSON.stringify(data));
    } catch {
      /* skip invalid JSON-LD */
    }
  });

  const bodyText = $('body').text().replace(/\s+/g, ' ').trim().slice(0, 12000);

  // For social posts the og:title is the richest source (full caption text)
  const captionText = social ? `${og.title}\n${og.description}` : '';

  // Instagram/TikTok REEL covers bake a play-button + caption overlay into
  // og:image, so they don't make good clean thumbnails. Drop the image for
  // reels (photo posts under /p/ keep their clean og:image).
  const isReel = /\/(reel|reels|tv)\//i.test(url);
  if (isReel) og.image = '';

  return {
    jsonLd: jsonLd.join('\n').slice(0, 8000),
    og,
    captionText,
    bodyText,
  };
}

function buildMockRecipe(url) {
  const source = detectSource(url);
  return {
    title: 'Spicy Peanut Noodles',
    app: source.app,
    handle: source.handle,
    servings: 3,
    time: 20,
    rating: '4.9',
    tags: ['Dinner', 'Quick'],
    kcal: 540,
    p: 20,
    c: 62,
    f: 24,
    tint: '#E5E5E3',
    sourceTint: '#161616',
    ingredients: [
      { a: '250g', n: 'Egg noodles', aisle: 'Pantry' },
      { a: '3 tbsp', n: 'Peanut butter', aisle: 'Pantry' },
      { a: '2 tbsp', n: 'Soy sauce', aisle: 'Pantry' },
      { a: '1 tbsp', n: 'Chili crisp', aisle: 'Pantry' },
      { a: '2 cloves', n: 'Garlic', aisle: 'Produce' },
      { a: '2', n: 'Spring onions', aisle: 'Produce' },
    ],
    steps: [
      'Cook the noodles and drain.',
      'Whisk the peanut butter, soy and chili crisp with a splash of pasta water.',
      'Toss the noodles through the sauce.',
      'Top with spring onion and crushed peanuts.',
    ],
    sourceUrl: url,
  };
}

async function extractWithOpenAI(url, pageContent) {
  const source = detectSource(url);

  const completion = await openai.chat.completions.create({
    model: 'gpt-5.4-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You extract structured recipes from web page content. Return valid JSON matching this schema: ${RECIPE_SCHEMA}. Estimate nutrition per serving if not provided, but PREFER any nutrition numbers stated in the text (e.g. "B:" protein, "T:" fat, "W:" carbs in Polish). Keep ingredient and step text in the SAME language as the source. Use realistic aisle categories. The "caption" field, when present, is the author's full post description and is the most reliable source of ingredients and steps — extract from it carefully. Only invent a recipe if no real content is available. For "tags": pick EXACTLY ONE best-fit category from [Quick, Dinner, Breakfast, Lunch, Vegetarian, High-protein]. Quick = under 20 min. Only return one tag.`,
      },
      {
        role: 'user',
        content: `URL: ${url}\nDetected source: ${source.app}\n\nCaption (author's post description — primary source):\n${pageContent.captionText || '(none)'}\n\nOpen Graph:\n${JSON.stringify(pageContent.og)}\n\nJSON-LD:\n${pageContent.jsonLd}\n\nPage text:\n${pageContent.bodyText}`,
      },
    ],
    temperature: 0.3,
  });

  const raw = completion.choices[0]?.message?.content;
  if (!raw) throw new Error('Empty response from OpenAI');

  const parsed = JSON.parse(raw);
  return {
    ...parsed,
    tint: '#E5E5E3',
    sourceTint: '#161616',
    sourceUrl: url,
    imageUrl: parsed.imageUrl || pageContent.og.image || undefined,
    app: parsed.app || source.app,
    handle: parsed.handle || source.handle,
  };
}

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    openai: !!openai,
    message: openai ? 'Ready' : 'Running in demo mode — set OPENAI_API_KEY for live extraction',
  });
});

app.post('/api/extract-recipe', async (req, res) => {
  try {
    const { url } = req.body;
    if (!url || typeof url !== 'string') {
      return res.status(400).json({ error: 'url is required' });
    }

    let parsedUrl;
    try {
      parsedUrl = new URL(url);
    } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      return res.status(400).json({ error: 'URL must use http or https' });
    }

    if (!openai) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.json({ recipe: buildMockRecipe(url), demo: true });
    }

    let pageContent;
    try {
      pageContent = await fetchPageText(url);
    } catch (fetchErr) {
      pageContent = {
        jsonLd: '',
        og: { title: '', description: '' },
        bodyText: `Could not fetch page. URL: ${url}. Error: ${fetchErr.message}`,
      };
    }

    const recipe = await extractWithOpenAI(url, pageContent);
    res.json({ recipe, demo: false });
  } catch (err) {
    console.error('extract-recipe error:', err);
    res.status(500).json({
      error: err.message || 'Failed to extract recipe',
    });
  }
});

app.post('/api/extract-recipe-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!openai) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.json({ recipe: buildMockRecipe('scan://photo'), demo: true });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You extract structured recipes from food photos or recipe screenshots. Return valid JSON matching this schema: ${RECIPE_SCHEMA}. If the image shows a finished dish with no text, estimate a reasonable recipe for what you see. If the image shows a recipe card, blog post, or handwritten recipe, extract it faithfully. Keep ingredient and step text in the SAME language visible in the image (default Polish if unclear). Estimate nutrition if not visible. Use realistic aisle categories. For "tags": pick EXACTLY ONE best-fit category from [Quick, Dinner, Breakfast, Lunch, Vegetarian, High-protein]. Quick = under 20 min. Only return one tag.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: 'Extract the recipe from this image. Source: photo/scan.',
            },
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${imageBase64}`,
                detail: 'high',
              },
            },
          ],
        },
      ],
      temperature: 0.3,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');

    const parsed = JSON.parse(raw);
    res.json({
      recipe: {
        ...parsed,
        tint: '#E5E5E3',
        sourceTint: '#161616',
        app: parsed.app || 'Photo',
        handle: parsed.handle || '@scan',
      },
      demo: false,
    });
  } catch (err) {
    console.error('extract-recipe-image error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract recipe from image' });
  }
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' });
  }
  console.error(err);
  res.status(500).json({ error: err.message || 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YumShare API running on http://0.0.0.0:${PORT}`);
  if (!openai) {
    console.log('⚠️  OPENAI_API_KEY not set — using demo recipe responses');
  }
});
