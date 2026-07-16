import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import rateLimitMw from 'express-rate-limit';
import * as cheerio from 'cheerio';
import OpenAI from 'openai';
import PDFDocument from 'pdfkit';
import sharp from 'sharp';
import { createClient } from '@supabase/supabase-js';
import jwt from 'jsonwebtoken';
import dns from 'node:dns/promises';
import net from 'node:net';

const app = express();
const PORT = process.env.PORT || 3001;

// Behind Railway's proxy the client IP arrives in X-Forwarded-For. Trust
// exactly one hop (the platform proxy) so req.ip is the real client and
// express-rate-limit can key on it. Trusting *all* proxies (`true`) would let a
// caller spoof X-Forwarded-For to dodge the per-IP limit, so we pin it to 1.
app.set('trust proxy', 1);

app.use(cors());

// Coarse per-IP throttle in front of everything — a cheap gate against scripted
// abuse before the per-user (auth'd) limits kick in. Generous enough that a real
// user on a shared/NAT'd IP won't hit it. Health check is exempt.
app.use(
  rateLimitMw({
    windowMs: 15 * 60 * 1000,
    max: Number(process.env.IP_RATE_LIMIT) || 300,
    standardHeaders: true,
    legacyHeaders: false,
    skip: (req) => req.path === '/health',
  }),
);

// Body parsing with a small default limit for the JSON API. The routes that
// receive base64 image data are the only ones allowed a large payload; every
// other endpoint is capped at 2 MB so a 50 MB blob can't reach them. The global
// parser must run first, so it skips the image routes (which parse with bigJson
// in their own handler) — otherwise the 2 MB cap would reject the upload before
// the route-level parser ran.
const IMAGE_ROUTES = new Set([
  '/api/extract-recipe-image',
  '/api/extract-receipt-image',
  '/api/extract-nutrition-label',
  '/api/resize-image',
]);
const bigJson = express.json({ limit: '50mb' });
const smallJson = express.json({ limit: '2mb' });
app.use((req, res, next) => (IMAGE_ROUTES.has(req.path) ? next() : smallJson(req, res, next)));
app.use(express.urlencoded({ limit: '2mb', extended: true }));

// Minimal security headers (no extra dependency). This is a JSON API consumed
// by the native app, so a strict set is safe: never embed it in a frame, don't
// sniff content types, don't leak the referrer, disable legacy XSS heuristics.
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.removeHeader('X-Powered-By');
  next();
});

// Accept-Encoding: identity is the real fix for the "Premature close" errors:
// node-fetch@2 (bundled by openai@4) throws ERR_STREAM_PREMATURE_CLOSE while
// *decompressing* gzip'd responses, and for some payloads it fails on every
// attempt. Asking OpenAI not to gzip skips node-fetch's Gunzip path entirely.
// Recipe JSON is a few KB, so shipping it uncompressed costs nothing. aiChat's
// retry (below) stays as a safety net for genuinely transient drops.
const openai = process.env.OPENAI_API_KEY
  ? new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
      maxRetries: 4,
      timeout: 90000,
      defaultHeaders: { 'Accept-Encoding': 'identity' },
    })
  : null;

// The OpenAI SDK v4 ships node-fetch@2, which intermittently throws
// ERR_STREAM_PREMATURE_CLOSE while decompressing gzip'd responses. That fires
// during the response body read, so the SDK's built-in retry never catches it
// and users saw "Premature close" during extraction. (Swapping in native undici
// fetch trades this for an "invalid content-length" rejection, so we stay on
// node-fetch.) Wrap completions in an app-level retry: a premature close is
// transient, and a fresh request almost always succeeds on the next attempt.
async function aiChat(params) {
  const create = openai.chat.completions.create.bind(openai.chat.completions);
  let lastErr;
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await create(params);
    } catch (err) {
      lastErr = err;
      const codes = `${err?.code || ''} ${err?.cause?.code || ''} ${err?.name || ''} ${err?.message || ''}`;
      const retryable = /PREMATURE_CLOSE|ECONNRESET|ETIMEDOUT|EPIPE|socket hang up|APIConnection|Connection error|fetch failed/i.test(codes);
      if (attempt < 2 && retryable) {
        await new Promise((r) => setTimeout(r, 800 * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  throw lastErr;
}

// Admin Supabase client (service role) — used only for account deletion.
const SUPABASE_URL = process.env.SUPABASE_URL || process.env.EXPO_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAdmin =
  SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY
    ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
    : null;

// ─── Sign in with Apple: token revocation ──────────────────────────────────
// Apple requires apps that offer Sign in with Apple to revoke the user's token
// when they delete their account. We exchange the native authorizationCode for
// a refresh token at sign-in, store it, and revoke it on deletion.
const APPLE_TEAM_ID = process.env.APPLE_TEAM_ID;
const APPLE_KEY_ID = process.env.APPLE_KEY_ID;
const APPLE_CLIENT_ID = process.env.APPLE_CLIENT_ID || 'com.yumshare.app';
// .p8 contents; supports either real newlines or \n-escaped in the env var.
const APPLE_PRIVATE_KEY = (process.env.APPLE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
const appleConfigured = !!(APPLE_TEAM_ID && APPLE_KEY_ID && APPLE_PRIVATE_KEY);

// Short-lived JWT that authenticates us to Apple's token endpoints.
function appleClientSecret() {
  return jwt.sign({}, APPLE_PRIVATE_KEY, {
    algorithm: 'ES256',
    keyid: APPLE_KEY_ID,
    issuer: APPLE_TEAM_ID,
    audience: 'https://appleid.apple.com',
    subject: APPLE_CLIENT_ID,
    expiresIn: '10m',
  });
}

async function appleTokenRequest(path, params) {
  const res = await fetch(`https://appleid.apple.com/auth/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: APPLE_CLIENT_ID,
      client_secret: appleClientSecret(),
      ...params,
    }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `apple ${path} failed`);
  return data;
}

// Trade the one-time authorizationCode for a long-lived refresh token.
async function appleExchangeCode(code) {
  const data = await appleTokenRequest('token', { code, grant_type: 'authorization_code' });
  return data.refresh_token;
}

// Revoke a stored refresh token so the app no longer has access.
async function appleRevoke(refreshToken) {
  await appleTokenRequest('revoke', { token: refreshToken, token_type_hint: 'refresh_token' });
}

// ─── AI endpoint protection ───────────────────────────────────────────────
// The expensive OpenAI routes below are guarded by three layers:
//   requireAuth     — only logged-in users (valid Supabase JWT) get through
//   requirePremium  — only active RevenueCat subscribers (with a dev bypass)
//   rateLimit       — caps each user to AI_DAILY_LIMIT calls per day
// so that nobody can burn the OpenAI budget by hitting the open URLs.

const RC_SECRET_KEY = process.env.RC_SECRET_KEY;
// 'off' (default) lets everything through so the app works before the App
// Store / Play products exist. Set to 'on' once subscriptions go live.
const PREMIUM_ENFORCEMENT = process.env.PREMIUM_ENFORCEMENT || 'off';
const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT) || 100;
// Fair-use daily cap for premium ("unlimited") users so nobody can script the
// API. A heavy real user won't reach it; a scraper will.
const PREMIUM_DAILY_LIMIT = Number(process.env.PREMIUM_DAILY_LIMIT) || 300;
// Must match the entitlement identifier in RevenueCat (and the mobile app)
// EXACTLY, including capitalisation and spaces.
const RC_ENTITLEMENT = process.env.RC_ENTITLEMENT || 'YumiSharev1';

// Verify the caller's Supabase access token → attaches req.user.
async function requireAuth(req, res, next) {
  if (!supabaseAdmin) {
    return res.status(503).json({ error: 'Auth not configured on the server.' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ error: 'Missing auth token' });

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });
  req.user = data.user;
  next();
}

// Cache RevenueCat lookups briefly so we don't call their API on every request.
const premiumCache = new Map(); // userId -> { active, expires }
const PREMIUM_TTL_MS = 60 * 1000;

async function requirePremium(req, res, next) {
  if (PREMIUM_ENFORCEMENT !== 'on') return next(); // dev bypass

  const userId = req.user.id;
  const cached = premiumCache.get(userId);
  if (cached && cached.expires > Date.now()) {
    if (cached.active) return next();
    return res.status(403).json({ error: 'premium_required' });
  }

  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
      headers: { Authorization: `Bearer ${RC_SECRET_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    const ent = data?.subscriber?.entitlements?.[RC_ENTITLEMENT];
    const active = !!ent && (!ent.expires_date || new Date(ent.expires_date) > new Date());
    premiumCache.set(userId, { active, expires: Date.now() + PREMIUM_TTL_MS });
    if (!active) return res.status(403).json({ error: 'premium_required' });
    next();
  } catch (err) {
    console.error('requirePremium error:', err);
    // Fail closed — don't hand out free AI when RevenueCat is unreachable.
    return res.status(503).json({ error: 'Could not verify subscription' });
  }
}

// Durable per-user daily counter backed by the api_usage table — survives
// deploys and works across instances (unlike the old in-memory Map). Premium
// users get the higher fair-use cap; everyone is counted once per AI request
// here, so checkImportCredits no longer bumps separately. If the DB/function is
// unavailable we don't enforce (fail-open on the cap, never on billing).
async function rateLimit(req, res, next) {
  const userId = req.user.id;
  const premium = await isPremiumUser(userId);
  const limit = premium ? PREMIUM_DAILY_LIMIT : AI_DAILY_LIMIT;
  const used = await bumpDailyUsage(userId);
  if (used === null) return next();
  if (used > limit) return res.status(429).json({ error: 'rate_limited', limit });
  next();
}

// Convenience: the full guard chain for AI endpoints.
const aiGuard = [requireAuth, requirePremium, rateLimit];

// ── Freemium import credits ────────────────────────────────────────────────
// Enforced here (server-side) so a modified client can't mint free extractions.
// Premium subscribers are unlimited; everyone else spends one credit per
// successful extraction. A "not a recipe" fallback never costs a credit.

// Is this user an active RevenueCat subscriber? Reuses the premium cache. When
// RC isn't configured we can't verify, so we treat them as a free account
// (they still get their free credits).
async function isPremiumUser(userId) {
  if (!RC_SECRET_KEY) return false;
  const cached = premiumCache.get(userId);
  if (cached && cached.expires > Date.now()) return cached.active;
  try {
    const r = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
      headers: { Authorization: `Bearer ${RC_SECRET_KEY}` },
      signal: AbortSignal.timeout(8000),
    });
    const data = await r.json();
    const ent = data?.subscriber?.entitlements?.[RC_ENTITLEMENT];
    const active = !!ent && (!ent.expires_date || new Date(ent.expires_date) > new Date());
    premiumCache.set(userId, { active, expires: Date.now() + PREMIUM_TTL_MS });
    return active;
  } catch (err) {
    console.error('isPremiumUser error:', err);
    return false;
  }
}

// Returns the current balance (creating a 10-credit row on first use), or null
// if the DB / credits function isn't available — in which case we don't enforce.
async function getUserCredits(userId) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('get_import_credits', { p_user: userId });
  if (error) {
    console.error('getUserCredits error:', error.message);
    return null;
  }
  return data == null ? null : Number(data);
}

// Atomically spend one credit; returns the new balance (or null if unavailable).
async function spendUserCredit(userId) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('spend_import_credit', { p_user: userId });
  if (error) {
    console.error('spendUserCredit error:', error.message);
    return null;
  }
  return data == null ? null : Number(data);
}

// Record one more call today and return the new daily count (null if the DB /
// function isn't available, in which case we don't enforce the daily cap).
async function bumpDailyUsage(userId) {
  if (!supabaseAdmin) return null;
  const { data, error } = await supabaseAdmin.rpc('bump_api_usage', { p_user: userId });
  if (error) {
    console.error('bumpDailyUsage error:', error.message);
    return null;
  }
  return data == null ? null : Number(data);
}

// A "not a recipe" result — must not cost a credit.
function isEmptyRecipe(r) {
  const noTitle = !r?.title || !String(r.title).trim();
  const noContent = (r?.ingredients?.length ?? 0) === 0 && (r?.steps?.length ?? 0) === 0;
  return noTitle || noContent;
}

// Guard used at the START of an extraction: 402 when a free user is out of
// credits. Returns { premium, credits } to thread through to the spend step.
async function checkImportCredits(req, res) {
  const userId = req.user.id;
  const premium = await isPremiumUser(userId);
  if (premium) {
    // "Unlimited" total; the daily fair-use cap is enforced upstream by
    // rateLimit (durable counter), so there's nothing to bump here.
    return { ok: true, premium: true, credits: null, userId };
  }
  const credits = await getUserCredits(userId);
  if (credits !== null && credits <= 0) {
    res.status(402).json({ error: 'no_credits', credits: 0, premium: false });
    return { ok: false };
  }
  return { ok: true, premium: false, credits, userId };
}

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
  "ingredients": [{ "a": "amount", "n": "name", "aisle": "Produce|Meat & Seafood|Dairy & Eggs|Bakery|Pantry|Frozen", "group": "string (the recipe's own sub-section heading for this ingredient, e.g. 'Marinade', 'For the sauce', 'Topping'; empty string for the main ingredient list)" }],
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

const NUTRITION_SCHEMA = `{
  "name": "string (product name if visible on the label, else a short generic description like 'Tomato passata'; empty if truly unknown)",
  "brand": "string (brand / manufacturer if visible, else empty)",
  "servingSize": "string (serving size exactly as written, e.g. '30 g', '250 ml', '1 cup (240 ml)'; empty if not stated)",
  "servingQuantity": number (the serving size as a plain number of grams or millilitres, e.g. 30 or 250; 0 if not stated),
  "basis": "string (either '100g' or '100ml' — whichever unit the nutrition table is based on)",
  "per100": { "kcal": number, "p": number (protein g), "c": number (carbs g), "f": number (fat g) },
  "perServing": { "kcal": number, "p": number, "c": number, "f": number }
}`;

function buildMockNutrition() {
  return {
    name: 'Sample product',
    brand: '',
    servingSize: '30 g',
    servingQuantity: 30,
    basis: '100g',
    per100: { kcal: 380, p: 8, c: 60, f: 12 },
    perServing: { kcal: 114, p: 2.4, c: 18, f: 3.6 },
  };
}

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
const SOCIAL_HOSTS = ['instagram.com', 'facebook.com', 'fb.watch', 'threads.net', 'tiktok.com'];

function isSocialUrl(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return SOCIAL_HOSTS.some((h) => host.endsWith(h));
  } catch {
    return false;
  }
}

function isTikTokUrl(url) {
  try {
    return new URL(url).hostname.replace('www.', '').endsWith('tiktok.com');
  } catch {
    return false;
  }
}

function isPinterestUrl(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    // pin.it is the short-link domain; pinterest.* covers all country TLDs.
    return host === 'pin.it' || host.includes('pinterest.');
  } catch {
    return false;
  }
}

function isYouTubeUrl(url) {
  try {
    const host = new URL(url).hostname.replace('www.', '');
    return host === 'youtu.be' || host.endsWith('youtube.com');
  } catch {
    return false;
  }
}

function youTubeVideoId(url) {
  try {
    const u = new URL(url);
    const host = u.hostname.replace('www.', '');
    if (host === 'youtu.be') return u.pathname.slice(1).split('/')[0];
    if (u.searchParams.get('v')) return u.searchParams.get('v');
    const parts = u.pathname.split('/'); // /shorts/<id> or /embed/<id>
    const i = parts.findIndex((p) => p === 'shorts' || p === 'embed');
    if (i >= 0 && parts[i + 1]) return parts[i + 1];
    return '';
  } catch {
    return '';
  }
}

// ─── SSRF guard ─────────────────────────────────────────────────────────────
// Several endpoints fetch a URL the caller supplied (recipe page, Pinterest
// outbound link, receipt image). Without a guard, a caller could point us at
// the cloud metadata endpoint (169.254.169.254) or an internal service and read
// the response back. Resolve the host and refuse any private / reserved IP.
// Note: this checks the resolved address(es) at request time; it does not fully
// close DNS-rebinding (host re-resolving to a private IP between check and
// fetch), but it blocks the practical SSRF vectors (literal private IPs and
// hosts that resolve to them).
function isPrivateIp(ip) {
  // Unwrap IPv4-mapped IPv6 (::ffff:10.0.0.1) to its v4 form.
  const v4 = ip.startsWith('::ffff:') ? ip.slice(7) : ip;
  if (net.isIPv4(v4)) {
    const [a, b] = v4.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;            // private / loopback / this-host
    if (a === 169 && b === 254) return true;                       // link-local + cloud metadata
    if (a === 172 && b >= 16 && b <= 31) return true;              // private
    if (a === 192 && b === 168) return true;                       // private
    if (a === 100 && b >= 64 && b <= 127) return true;             // CGNAT
    if (a >= 224) return true;                                     // multicast / reserved
    return false;
  }
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;              // loopback / unspecified
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique-local fc00::/7
  if (lower.startsWith('fe80')) return true;                       // link-local
  return false;
}

async function assertPublicHost(url) {
  let parsed;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error('Invalid URL');
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('URL must use http or https');
  }
  const host = parsed.hostname;
  // Literal IP in the URL — check it directly.
  if (net.isIP(host)) {
    if (isPrivateIp(host)) throw new Error('Blocked address');
    return;
  }
  // Resolve the hostname; reject if any resolved address is private/reserved.
  let addrs;
  try {
    addrs = await dns.lookup(host, { all: true });
  } catch {
    throw new Error('Could not resolve host');
  }
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) {
    throw new Error('Blocked address');
  }
}

// fetch() wrapper that refuses private/reserved targets. Use for every request
// to a caller-supplied URL.
async function safeFetch(url, options) {
  await assertPublicHost(url);
  return fetch(url, options);
}

// TikTok doesn't expose the caption in og: tags, but its official oEmbed
// endpoint returns the full description, author and thumbnail. Short vm.tiktok
// links are resolved to their canonical URL first.
async function fetchTikTok(url) {
  const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  let finalUrl = url;
  try {
    const res = await safeFetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    finalUrl = res.url || url;
  } catch {
    /* keep original url */
  }

  const handleMatch = finalUrl.match(/@([A-Za-z0-9._]+)/);
  const handle = handleMatch ? `@${handleMatch[1]}` : '@creator';

  let caption = '';
  let author = '';
  let thumb = '';
  try {
    const o = await fetch(`https://www.tiktok.com/oembed?url=${encodeURIComponent(finalUrl)}`, {
      signal: AbortSignal.timeout(15000),
    });
    if (o.ok) {
      const j = await o.json();
      caption = j.title || '';
      author = j.author_name || '';
      thumb = j.thumbnail_url || '';
    }
  } catch {
    /* oembed unavailable — fall back to empty caption */
  }

  return {
    jsonLd: '',
    og: { title: author, description: caption, image: thumb },
    captionText: caption,
    bodyText: caption,
    handle,
  };
}

// A Pinterest pin is a bookmark, not the recipe itself — its og:description is
// only a short teaser. The real recipe lives on the external blog the pin links
// to. Resolve the pin (pin.it short links included), pull that outbound link out
// of the embedded pin JSON, and extract from the destination page, which usually
// carries a full JSON-LD Recipe. Fall back to the pin's own metadata if there is
// no usable outbound link.
async function fetchPinterest(url) {
  const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  let html = '';
  let pinImage = '';
  let pinTitle = '';
  let pinDesc = '';
  try {
    const res = await safeFetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    html = await res.text();
    const $ = cheerio.load(html);
    pinImage = $('meta[property="og:image"]').attr('content') || '';
    pinTitle = $('meta[property="og:title"]').attr('content') || '';
    pinDesc = $('meta[property="og:description"]').attr('content') || '';
  } catch {
    /* fall through to whatever metadata we managed to read */
  }

  // The pin's outbound link (the source blog) sits in the embedded pin JSON as
  // a "link" field; skip Pinterest's own URLs and its image CDN.
  let outbound = '';
  for (const m of html.matchAll(/"link"\s*:\s*"(https?:[^"]+)"/g)) {
    const candidate = m[1].replace(/\\\//g, '/');
    if (!/pinterest\.|pinimg\.com|pin\.it/.test(candidate)) {
      outbound = candidate;
      break;
    }
  }

  if (outbound) {
    try {
      const page = await fetchPageText(outbound);
      // Keep the pin's image as a cover fallback if the blog exposes none.
      if (!page.og.image && pinImage) page.og.image = pinImage;
      return page;
    } catch {
      /* destination unreachable — fall back to the pin's own metadata below */
    }
  }

  return {
    jsonLd: '',
    og: { title: pinTitle, description: pinDesc, image: pinImage },
    captionText: `${pinTitle}\n${pinDesc}`,
    bodyText: `${pinTitle}\n${pinDesc}`,
  };
}

// YouTube truncates og:description, but the full video description — where
// creators paste the recipe — lives in the embedded player JSON as
// videoDetails.shortDescription. Pull it from there. Works for watch?v=,
// youtu.be short links and /shorts/. The thumbnail is derived from the video id
// (hqdefault always exists, unlike maxresdefault).
async function fetchYouTube(url) {
  const BROWSER_UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const videoId = youTubeVideoId(url);
  let title = '';
  let description = '';
  let author = '';
  try {
    const res = await safeFetch(url, {
      headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' },
      redirect: 'follow',
      signal: AbortSignal.timeout(15000),
    });
    const html = await res.text();
    const $ = cheerio.load(html);
    title = $('meta[property="og:title"]').attr('content') || '';
    // Robust JSON-string capture (handles escaped quotes) for the full description.
    const dm = html.match(/"shortDescription":"((?:[^"\\]|\\.)*)"/);
    if (dm) {
      try {
        description = JSON.parse(`"${dm[1]}"`);
      } catch {
        /* leave description empty */
      }
    }
    const am = html.match(/"author":"((?:[^"\\]|\\.)*)"/);
    if (am) {
      try {
        author = JSON.parse(`"${am[1]}"`);
      } catch {
        /* ignore */
      }
    }
  } catch {
    /* fall back to whatever we captured */
  }

  const thumb = videoId ? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg` : '';
  const caption = `${title}\n${description}`.trim();
  return {
    jsonLd: '',
    og: { title, description, image: thumb },
    captionText: caption,
    bodyText: caption,
    handle: author ? `@${author.replace(/\s+/g, '')}` : '@channel',
  };
}

async function fetchPageText(url) {
  if (isTikTokUrl(url)) return fetchTikTok(url);
  if (isPinterestUrl(url)) return fetchPinterest(url);
  if (isYouTubeUrl(url)) return fetchYouTube(url);
  const social = isSocialUrl(url);
  const userAgent = social
    ? 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)'
    : 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

  const res = await safeFetch(url, {
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

  // Keep the post's og:image as the default cover (even reels) — the review
  // screen lets the user swap it for a camera/gallery photo if they prefer.

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

  const completion = await aiChat({
    model: 'gpt-5.4-mini',
    response_format: { type: 'json_object' },
    messages: [
      {
        role: 'system',
        content: `You extract structured recipes from web page content. Return valid JSON matching this schema: ${RECIPE_SCHEMA}. Estimate nutrition per serving if not provided, but PREFER any nutrition numbers stated in the text (e.g. "B:" protein, "T:" fat, "W:" carbs in Polish). Keep ingredient and step text in the SAME language as the source. Use realistic aisle categories. For "steps": use the author's OWN wording exactly as written — do NOT rewrite, paraphrase, summarise, expand, add tips, or invent steps; only split into separate strings where the author already separates them. If no method is written in the source, return an empty steps array. The "caption" field, when present, is the author's full post description and is the most reliable source of ingredients and steps — extract from it carefully. IMPORTANT — ingredient sections: captions usually split ingredients into sub-sections, each with its own heading directly above a list of ingredients. A heading can be: a line ending with ":" ("Sauce:"), a line starting with "For the" ("For the chicken"), OR — very common — a SHORT STANDALONE LINE of 1–4 words with no quantity sitting right above ingredient lines (e.g. "Meatballs", "Sauce", "Dressing", "Topping", "Marinade", "To serve"). Treat every such heading as a section and set each following ingredient's "group" to that heading text. Also, when one line bundles several items (e.g. "Seasonings: 1 tsp smoked paprika, 1.5 tsp dried thyme, 1 tsp salt"), split it into separate ingredients that all share that group. If the recipe uses ANY sections, assign EVERY ingredient to a group — give leftover/base items a sensible label like "Main" or "To serve" rather than leaving them blank. Ignore non-ingredient blocks like "Macros"/nutrition lines. If the recipe has NO sub-sections at all, leave "group" as an empty string for every ingredient. IMPORTANT — if the text contains no actual recipe (no ingredients and no method, e.g. it's an unrelated article, a product page, or a broken/empty page), do NOT invent one — return exactly {"title": "", "ingredients": [], "steps": []} and nothing else. For "tags": pick EXACTLY ONE best-fit category from [Quick, Dinner, Breakfast, Lunch, Vegetarian, High-protein]. Quick = under 20 min. Only return one tag.`,
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
    handle: pageContent.handle || parsed.handle || source.handle,
  };
}

// Bump this whenever backend behaviour changes so a deploy can be verified live
// via GET /health (tells old vs new code apart without guessing).
const BUILD_MARKER = 'rc-diagnostics-1';

app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    build: BUILD_MARKER,
    openai: !!openai,
    accountDeletion: !!supabaseAdmin,
    supabaseUrl: !!SUPABASE_URL,
    serviceKey: !!SUPABASE_SERVICE_ROLE_KEY,
    // RevenueCat config — how the server decides who is premium. If revenueCat
    // is false, EVERY user is treated as free (server can't verify), so once
    // their free import credits run out they get a 402 and see the paywall even
    // though the app's own SDK shows them as premium. rcEntitlement must match
    // the entitlement identifier in the RevenueCat dashboard EXACTLY.
    revenueCat: !!RC_SECRET_KEY,
    rcEntitlement: RC_ENTITLEMENT,
    premiumEnforcement: PREMIUM_ENFORCEMENT,
    message: openai ? 'Ready' : 'Running in demo mode — set OPENAI_API_KEY for live extraction',
  });
});

// Authenticated diagnostic: what does the SERVER think about THIS user? Lets us
// tell "client says premium but server says free" apart from a real credit
// issue. Returns the server-side premium verdict + current credit balance.
app.get('/api/whoami', requireAuth, async (req, res) => {
  const premium = await isPremiumUser(req.user.id);
  const credits = await getUserCredits(req.user.id);
  res.json({ userId: req.user.id, premiumOnServer: premium, credits, rcConfigured: !!RC_SECRET_KEY, rcEntitlement: RC_ENTITLEMENT });
});

// Current import-credit balance for the signed-in user (the app shows this in
// the header pill). premium === true means unlimited (credits is null).
app.get('/api/credits', requireAuth, async (req, res) => {
  const premium = await isPremiumUser(req.user.id);
  const credits = premium ? null : await getUserCredits(req.user.id);
  res.json({ credits, premium });
});

app.post('/api/extract-recipe', ...aiGuard, async (req, res) => {
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

    // Freemium gate: block (402) if a free user is out of credits.
    const gate = await checkImportCredits(req, res);
    if (!gate.ok) return;

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
    // Spend a credit only for a real recipe (a "not a recipe" result is free).
    let credits = gate.credits;
    if (!gate.premium && gate.credits !== null && !isEmptyRecipe(recipe)) {
      credits = await spendUserCredit(gate.userId);
    }
    res.json({ recipe, demo: false, credits, premium: gate.premium });
  } catch (err) {
    console.error('extract-recipe error:', err);
    res.status(500).json({
      error: err.message || 'Failed to extract recipe',
    });
  }
});

app.post('/api/extract-recipe-image', bigJson, ...aiGuard, async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!openai) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.json({ recipe: buildMockRecipe('scan://photo'), demo: true });
    }

    // Freemium gate: block (402) if a free user is out of credits.
    const gate = await checkImportCredits(req, res);
    if (!gate.ok) return;

    const completion = await aiChat({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You extract structured recipes from food photos or recipe screenshots. Return valid JSON matching this schema: ${RECIPE_SCHEMA}. IMPORTANT — if the image clearly does NOT contain food, a dish, cooking ingredients, or a written recipe (for example: a person, a selfie, a car, a landscape, an animal, a document, a meme, or any unrelated screenshot), do NOT invent anything — return exactly {"title": "", "ingredients": [], "steps": []} and nothing else. Only when the image genuinely shows food or a recipe should you extract or estimate. If the image shows a finished dish with no text, estimate a reasonable recipe for what you see. If the image shows a recipe card, blog post, or handwritten recipe, extract it faithfully. Keep ingredient and step text in the SAME language visible in the image (default Polish if unclear). For "steps": use the wording exactly as written in the image — do NOT rewrite, paraphrase, summarise, expand, or invent steps; only split where already separated. If no method is written, return an empty steps array. Estimate nutrition if not visible. Use realistic aisle categories. If the recipe splits ingredients into sub-sections — a heading ending with ":", starting with "For the", or a SHORT STANDALONE LINE of 1–4 words with no quantity above a list (e.g. "Meatballs", "Sauce", "Marinade", "Topping") — set each ingredient's "group" to that heading and assign EVERY ingredient to a group (use "Main"/"To serve" for leftover items). Split bundled lines like "Seasonings: a, b, c" into separate ingredients sharing that group. Ignore "Macros"/nutrition blocks. If there are no sub-sections, leave "group" empty for all. For "tags": pick EXACTLY ONE best-fit category from [Quick, Dinner, Breakfast, Lunch, Vegetarian, High-protein]. Quick = under 20 min. Only return one tag.`,
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
    const recipe = {
      ...parsed,
      tint: '#E5E5E3',
      sourceTint: '#161616',
      app: parsed.app || 'Photo',
      handle: parsed.handle || '@scan',
    };
    // Spend a credit only for a real recipe (a "not a recipe" result is free).
    let credits = gate.credits;
    if (!gate.premium && gate.credits !== null && !isEmptyRecipe(recipe)) {
      credits = await spendUserCredit(gate.userId);
    }
    res.json({ recipe, demo: false, credits, premium: gate.premium });
  } catch (err) {
    console.error('extract-recipe-image error:', err);
    res.status(500).json({ error: err.message || 'Failed to extract recipe from image' });
  }
});

app.post('/api/extract-receipt-image', bigJson, ...aiGuard, async (req, res) => {
  try {
    const { imageBase64, mimeType = 'image/jpeg' } = req.body;
    if (!imageBase64 || typeof imageBase64 !== 'string') {
      return res.status(400).json({ error: 'imageBase64 is required' });
    }

    if (!openai) {
      await new Promise((r) => setTimeout(r, 1000));
      return res.json({ receipt: buildMockReceipt(), demo: true });
    }

    const completion = await aiChat({
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

app.post('/api/extract-nutrition-label', bigJson, ...aiGuard, async (req, res) => {
  try {
    // Accept either a single image or several photos of the SAME product label
    // (e.g. a bottle that can't be captured in one shot).
    const { images, imageBase64, mimeType = 'image/jpeg' } = req.body;
    let shots = Array.isArray(images) ? images : [];
    if (!shots.length && typeof imageBase64 === 'string') {
      shots = [{ base64: imageBase64, mimeType }];
    }
    shots = shots
      .filter((s) => s && typeof s.base64 === 'string' && s.base64.length)
      .slice(0, 4);
    if (!shots.length) {
      return res.status(400).json({ error: 'At least one label image is required' });
    }

    if (!openai) {
      await new Promise((r) => setTimeout(r, 1200));
      return res.json({ product: buildMockNutrition(), demo: true });
    }

    const completion = await aiChat({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: `You read nutrition / "Nutrition Facts" / "Wartość odżywcza" labels from photos of a packaged food or drink and return structured data as valid JSON matching this schema: ${NUTRITION_SCHEMA}. The photos may show the SAME product from different angles (e.g. a bottle where one shot can't capture the whole table) — combine all of them into ONE result; do not double-count. Read numbers carefully. If the table gives values per serving but a serving quantity is stated, COMPUTE the per-100 values (and vice-versa: if only per-100 is given plus a serving size, compute per-serving). Energy must be in kcal — if only kJ is shown, convert (1 kcal = 4.184 kJ). Carbs = total carbohydrate, fat = total fat. If a value is genuinely not on the label, use 0. Never invent values that are not supported by the photos.`,
        },
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text:
                shots.length > 1
                  ? `These ${shots.length} photos show the same product's label from different angles. Combine them and extract the nutrition data.`
                  : 'Extract the nutrition data from this product label.',
            },
            ...shots.map((s) => ({
              type: 'image_url',
              image_url: {
                url: `data:${s.mimeType || 'image/jpeg'};base64,${s.base64}`,
                detail: 'high',
              },
            })),
          ],
        },
      ],
      temperature: 0.2,
    });

    const raw = completion.choices[0]?.message?.content;
    if (!raw) throw new Error('Empty response from OpenAI');
    const parsed = JSON.parse(raw);

    const macro = (o) => ({
      kcal: Math.max(0, Math.round(Number(o?.kcal) || 0)),
      p: Math.max(0, Math.round((Number(o?.p) || 0) * 10) / 10),
      c: Math.max(0, Math.round((Number(o?.c) || 0) * 10) / 10),
      f: Math.max(0, Math.round((Number(o?.f) || 0) * 10) / 10),
    });
    const per100 = macro(parsed.per100);
    const servingQuantity = Math.max(0, Number(parsed.servingQuantity) || 0);
    let perServing = macro(parsed.perServing);
    // Backfill per-serving from per-100 if the model left it empty but we know the portion.
    if (!perServing.kcal && !perServing.p && !perServing.c && !perServing.f && servingQuantity > 0) {
      const k = servingQuantity / 100;
      perServing = {
        kcal: Math.round(per100.kcal * k),
        p: Math.round(per100.p * k * 10) / 10,
        c: Math.round(per100.c * k * 10) / 10,
        f: Math.round(per100.f * k * 10) / 10,
      };
    }

    res.json({
      product: {
        name: String(parsed.name || '').trim(),
        brand: String(parsed.brand || '').trim(),
        servingSize: String(parsed.servingSize || '').trim(),
        servingQuantity,
        basis: parsed.basis === '100ml' ? '100ml' : '100g',
        per100,
        perServing,
      },
      demo: false,
    });
  } catch (err) {
    console.error('extract-nutrition-label error:', err);
    res.status(500).json({ error: err.message || 'Failed to read nutrition label' });
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
    const res = await safeFetch(url, { signal: AbortSignal.timeout(10000) });
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

app.post('/api/resize-image', bigJson, requireAuth, async (req, res) => {
  try {
    const { base64, maxWidth = 1080, quality = 70 } = req.body;
    if (!base64 || typeof base64 !== 'string') {
      return res.status(400).json({ error: 'base64 is required' });
    }
    const input = Buffer.from(base64, 'base64');
    const out = await sharp(input)
      .rotate() // respect EXIF orientation
      .resize({ width: maxWidth, withoutEnlargement: true })
      .jpeg({ quality })
      .toBuffer();
    res.json({ base64: out.toString('base64'), mimeType: 'image/jpeg' });
  } catch (err) {
    console.error('resize-image error:', err);
    res.status(500).json({ error: err.message || 'Failed to resize image' });
  }
});

app.post('/api/receipts/export', requireAuth, async (req, res) => {
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

// Store the Apple refresh token (from the native sign-in authorizationCode) so
// we can revoke it later. Called by the app right after a successful Apple login.
app.post('/api/apple/link', async (req, res) => {
  try {
    if (!supabaseAdmin || !appleConfigured) return res.json({ ok: false, skipped: true });
    const { accessToken, authorizationCode } = req.body;
    if (!accessToken || !authorizationCode) {
      return res.status(400).json({ error: 'accessToken and authorizationCode are required' });
    }
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) return res.status(401).json({ error: 'Invalid session' });

    const refreshToken = await appleExchangeCode(authorizationCode);
    if (refreshToken) {
      await supabaseAdmin
        .from('apple_tokens')
        .upsert({ user_id: data.user.id, refresh_token: refreshToken }, { onConflict: 'user_id' });
    }
    res.json({ ok: true });
  } catch (err) {
    console.error('apple/link error:', err);
    res.status(500).json({ error: err.message || 'Failed to link Apple account' });
  }
});

app.post('/api/delete-account', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Account deletion not configured on the server.' });
    }
    const { accessToken } = req.body;
    if (!accessToken || typeof accessToken !== 'string') {
      return res.status(400).json({ error: 'accessToken is required' });
    }

    // Validate the token → resolve the user it belongs to (no impersonation).
    const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
    if (error || !data?.user) {
      return res.status(401).json({ error: 'Invalid session' });
    }
    const userId = data.user.id;

    // Revoke the user's Apple token first (App Store requirement). Never let a
    // revoke failure block the deletion the user asked for.
    if (appleConfigured) {
      try {
        const { data: tok } = await supabaseAdmin
          .from('apple_tokens')
          .select('refresh_token')
          .eq('user_id', userId)
          .maybeSingle();
        if (tok?.refresh_token) await appleRevoke(tok.refresh_token);
        await supabaseAdmin.from('apple_tokens').delete().eq('user_id', userId);
      } catch (e) {
        console.warn('apple revoke failed (continuing delete):', e.message);
      }
    }

    // Remove the user's stored data, then the auth user itself.
    await supabaseAdmin.from('app_state').delete().eq('user_id', userId);
    const { error: delErr } = await supabaseAdmin.auth.admin.deleteUser(userId);
    if (delErr) throw delErr;

    res.json({ ok: true });
  } catch (err) {
    console.error('delete-account error:', err);
    res.status(500).json({ error: err.message || 'Failed to delete account' });
  }
});

app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Image too large. Please use a smaller photo.' });
  }
  console.error(err);
  // Log the detail server-side (above) but don't leak internals to the client.
  res.status(500).json({ error: 'Internal server error' });
});

app.post('/api/enrich-recipe', ...aiGuard, async (req, res) => {
  try {
    const { recipe } = req.body;
    if (!recipe || typeof recipe !== 'object') {
      return res.status(400).json({ error: 'recipe object is required' });
    }

    if (!openai) {
      return res.json({ recipe });
    }

    const prompt = `You are a professional chef and recipe editor. The user has a recipe that may be incomplete — missing ingredient amounts, vague steps, or wrong serving sizes. Your job is to return a fully enriched, complete version.

Current recipe (JSON):
${JSON.stringify(recipe, null, 2)}

Rules:
- Keep the original title, tags, and source info unchanged
- Fill in missing ingredient amounts with realistic values for the given number of servings
- Expand vague steps into clear, actionable instructions (1–2 sentences each)
- Recalculate or estimate kcal, protein (p), carbs (c), fat (f) per serving based on the ingredients
- Keep the same ingredient groups if they exist
- Do NOT add ingredients not implied by the existing list
- Return ONLY valid JSON matching this schema exactly: ${RECIPE_SCHEMA}`;

    const completion = await aiChat({
      model: 'gpt-5.4-mini',
      response_format: { type: 'json_object' },
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
    });

    let enriched;
    try {
      enriched = JSON.parse(completion.choices[0].message.content);
    } catch {
      return res.status(500).json({ error: 'AI returned invalid JSON' });
    }

    // Preserve fields AI shouldn't touch
    enriched.id = recipe.id;
    enriched.imageUrl = recipe.imageUrl;
    enriched.cover = recipe.cover;
    enriched.tint = recipe.tint;
    enriched.sourceTint = recipe.sourceTint;

    res.json({ recipe: enriched });
  } catch (err) {
    console.error('enrich-recipe error:', err);
    res.status(500).json({ error: err.message || 'Failed to enrich recipe' });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YumShare API running on http://0.0.0.0:${PORT}`);
  if (!openai) {
    console.log('⚠️  OPENAI_API_KEY not set — using demo recipe responses');
  }
});
