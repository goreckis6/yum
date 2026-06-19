import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';

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

const RECEIPT_CATEGORIES = ['Meals', 'Groceries', 'Fuel', 'Travel', 'Office', 'Other'];

const RECEIPT_SCHEMA = `{
  "merchant": "string (store / business name)",
  "date": "string (ISO date YYYY-MM-DD of the purchase; best guess if ambiguous)",
  "total": number (grand total paid),
  "subtotal": number (pre-tax subtotal, 0 if unknown),
  "tax": number (tax amount, 0 if none),
  "currency": "string (ISO code like USD, EUR, PLN — infer from symbol/locale)",
  "category": "string (ONE of: Meals, Groceries, Fuel, Travel, Office, Other)",
  "paymentMethod": "string (e.g. VISA ****1234, Cash; empty if unknown)",
  "items": [{ "n": "string (line item name)", "p": number (line price) }]
}`;

function buildMockReceipt() {
  return {
    merchant: 'Blue Bottle Coffee',
    date: new Date().toISOString().slice(0, 10),
    total: 16.82,
    subtotal: 15.5,
    tax: 1.32,
    currency: 'USD',
    category: 'Meals',
    paymentMethod: 'VISA ****5132',
    items: [
      { n: 'Gibraltar', p: 5.25 },
      { n: 'Almond Croissant', p: 4.75 },
      { n: 'Cold Brew', p: 5.5 },
    ],
  };
}

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

app.post('/api/extract-receipt-image', async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!openai) {
      await new Promise((r) => setTimeout(r, 1000));
      return res.json({ receipt: buildMockReceipt(), demo: true });
    }

    const completion = await openai.chat.completions.create({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You read retail / restaurant receipts from a photo and return structured data as valid JSON matching this schema: ${RECEIPT_SCHEMA}. Read totals carefully — "total" is the final amount paid (after tax). Parse the date to ISO YYYY-MM-DD. Infer currency from the symbol or locale. Pick exactly ONE category from [${RECEIPT_CATEGORIES.join(', ')}] that best fits the merchant. If a value is not visible, use 0 for numbers and an empty string for text. Never invent line items that are not on the receipt.`,
        },
        {
          role: 'user',
          content: [
            { type: 'text', text: 'Extract the receipt data from this image.' },
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${imageBase64}`, detail: 'high' },
            },
          ],
        },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');
    const parsed = JSON.parse(raw);

    const category = RECEIPT_CATEGORIES.includes(parsed.category) ? parsed.category : 'Other';
    res.json({
      receipt: {
        merchant: parsed.merchant || 'Unknown merchant',
        date: parsed.date || new Date().toISOString().slice(0, 10),
        total: Number(parsed.total) || 0,
        subtotal: Number(parsed.subtotal) || 0,
        tax: Number(parsed.tax) || 0,
        currency: parsed.currency || 'USD',
        category,
        paymentMethod: parsed.paymentMethod || '',
        items: Array.isArray(parsed.items)
          ? parsed.items.map((it) => ({ n: String(it.n || ''), p: Number(it.p) || 0 }))
          : [],
      },
      demo: false,
    });
  } catch (err) {
    console.error('extract-receipt-image error:', err);
    res.status(500).json({ error: err.message || 'Failed to read receipt' });
  }
});

function csvCell(v) {
  const s = String(v ?? '');
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function receiptsToCsv(receipts) {
  const head = ['Merchant', 'Date', 'Category', 'Tags', 'Subtotal', 'Tax', 'Total', 'Currency', 'Payment'];
  const rows = receipts.map((r) =>
    [
      r.merchant,
      r.date,
      r.category,
      (r.tags || []).join(' '),
      (r.subtotal ?? 0).toFixed(2),
      (r.tax ?? 0).toFixed(2),
      (r.total ?? 0).toFixed(2),
      r.currency || '',
      r.paymentMethod || '',
    ]
      .map(csvCell)
      .join(','),
  );
  const grand = receipts.reduce((n, r) => n + (Number(r.total) || 0), 0);
  rows.push(['TOTAL', '', '', '', '', '', grand.toFixed(2), receipts[0]?.currency || '', ''].map(csvCell).join(','));
  return [head.join(','), ...rows].join('\n');
}

async function fetchImageBuffer(url) {
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) });
    if (!res.ok) return null;
    const ab = await res.arrayBuffer();
    return Buffer.from(ab);
  } catch {
    return null;
  }
}

async function receiptsToPdf(receipts, includePhotos = false) {
  // Pre-fetch receipt photos (if requested) before streaming the PDF.
  const photos = includePhotos
    ? await Promise.all(receipts.map((r) => (r.imageUrl ? fetchImageBuffer(r.imageUrl) : Promise.resolve(null))))
    : [];

  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 40 });
      const chunks = [];
      doc.on('data', (c) => chunks.push(c));
      doc.on('end', () => resolve(Buffer.concat(chunks)));

      const grand = receipts.reduce((n, r) => n + (Number(r.total) || 0), 0);
      const cur = receipts[0]?.currency || '';

      doc.fontSize(20).fillColor('#241B12').text('Receipts export', { continued: false });
      doc.moveDown(0.3);
      doc.fontSize(10).fillColor('#9C8F7C').text(`${receipts.length} receipts · ${cur} ${grand.toFixed(2)} total · generated ${new Date().toISOString().slice(0, 10)}`);
      doc.moveDown(1);

      const cols = [
        { label: 'Merchant', w: 150 },
        { label: 'Date', w: 75 },
        { label: 'Category', w: 80 },
        { label: 'Tax', w: 60 },
        { label: 'Total', w: 70 },
      ];
      const startX = doc.x;
      let y = doc.y;
      doc.fontSize(9).fillColor('#6F6356');
      let x = startX;
      cols.forEach((col) => {
        doc.text(col.label, x, y, { width: col.w });
        x += col.w;
      });
      y += 16;
      doc.moveTo(startX, y - 4).lineTo(startX + cols.reduce((n, c) => n + c.w, 0), y - 4).strokeColor('#EEE6D9').stroke();

      doc.fontSize(10).fillColor('#241B12');
      receipts.forEach((r) => {
        if (y > 760) {
          doc.addPage();
          y = doc.y;
        }
        x = startX;
        const cells = [r.merchant, r.date, r.category, (r.tax ?? 0).toFixed(2), `${(r.total ?? 0).toFixed(2)}`];
        cells.forEach((cell, i) => {
          doc.text(String(cell ?? ''), x, y, { width: cols[i].w });
          x += cols[i].w;
        });
        y += 18;
      });

      y += 6;
      doc.moveTo(startX, y).lineTo(startX + cols.reduce((n, c) => n + c.w, 0), y).strokeColor('#EEE6D9').stroke();
      y += 8;
      doc.fontSize(12).fillColor('#C7613C').text(`Total: ${cur} ${grand.toFixed(2)}`, startX, y);

      // Optional appendix with the original receipt photos.
      const withPhotos = photos.filter(Boolean).length;
      if (includePhotos && withPhotos) {
        doc.addPage();
        doc.fontSize(16).fillColor('#241B12').text('Receipt photos', { align: 'left' });
        doc.moveDown(0.6);
        receipts.forEach((r, i) => {
          const img = photos[i];
          if (!img) return;
          if (doc.y > 560) doc.addPage();
          doc.fontSize(10).fillColor('#6F6356').text(`${r.merchant} · ${r.date} · ${cur} ${(r.total ?? 0).toFixed(2)}`);
          doc.moveDown(0.3);
          try {
            doc.image(img, { fit: [320, 360], align: 'left' });
          } catch {
            doc.fontSize(9).fillColor('#9C8F7C').text('(image could not be embedded)');
          }
          doc.moveDown(1);
        });
      }

      doc.end();
    } catch (e) {
      reject(e);
    }
  });
}

app.post('/api/receipts/export', async (req, res) => {
  try {
    const { receipts, format = 'csv', includePhotos = false } = req.body;
    if (!Array.isArray(receipts) || receipts.length === 0) {
      return res.status(400).json({ error: 'receipts array is required' });
    }
    const stamp = new Date().toISOString().slice(0, 10);

    if (format === 'pdf') {
      const buf = await receiptsToPdf(receipts, includePhotos);
      return res.json({
        filename: `receipts-${stamp}.pdf`,
        mimeType: 'application/pdf',
        base64: buf.toString('base64'),
      });
    }

    const csv = receiptsToCsv(receipts);
    return res.json({
      filename: `receipts-${stamp}.csv`,
      mimeType: 'text/csv',
      base64: Buffer.from(csv, 'utf8').toString('base64'),
    });
  } catch (err) {
    console.error('receipts export error:', err);
    res.status(500).json({ error: err.message || 'Failed to export receipts' });
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
