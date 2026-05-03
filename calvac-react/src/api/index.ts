import type { Product, SiteSettings, Offer } from '@/types';

const BASE = '';

/* ─── TTL constants ───────────────────────────────────────────────────
   Products   : 6hr  — updated 1-2×/week, fresh enough for daily visits
   Settings   : 12hr — site config rarely changes mid-day
   Search     : 1hr  — balance freshness with API call reduction
   Offer      : 30min— ribbon text can change for flash sales
   Single prod: 6hr  — same rhythm as product list
────────────────────────────────────────────────────────────────────── */
const PRODUCTS_TTL = 12 * 60 * 60 * 1000;   // 12 hours
const SETTINGS_TTL = 12 * 60 * 60 * 1000;   // 12 hours
const SEARCH_TTL   = 1  * 60 * 60 * 1000;   // 1 hour
const OFFER_TTL    = 5  * 60 * 60 * 1000;   // 5 hours
const PRODUCT_TTL  = 8  * 60 * 60 * 1000;   // 8 hours (single product)

/* ─── ImageKit helpers ───────────────────────────────────────────── */
function ikResize(url: string, width: number, quality: number): string {
  if (!url || !url.includes('ik.imagekit.io')) return url;
  const base = url.split('?')[0];
  return `${base}?tr=w-${width},q-${quality},f-webp,c-at_max,pr-true`;
}

export function ikSrcSet(url: string, quality = 75): string {
  if (!url || !url.includes('ik.imagekit.io')) return '';
  const base = url.split('?')[0];
  return [320, 480, 640, 800, 1080, 1280]
    .map(w => `${base}?tr=w-${w},q-${quality},f-webp,c-at_max,pr-true ${w}w`)
    .join(', ');
}

/* ─── Security: only allow safe image URLs ───────────────────────── */
function fixImage(img: string | undefined): string {
  if (!img) return '';
  if (img.startsWith('http')) return ikResize(img, 400, 75);
  if (img.startsWith('/static/')) return img;
  return '';
}

function fixProducts(list: Product[]): Product[] {
  if (!Array.isArray(list)) return [];
  return list.map(p => ({
    ...p,
    name:   String(p.name  || '').slice(0, 200),
    brand:  String(p.brand || '').slice(0, 100),
    price:  Math.max(0, Number(p.price) || 0),
    image:  fixImage(p.image),
    colors: (p.colors || []).map(c => ({ ...c, image: fixImage(c.image) })),
  }));
}

/* ─── Safe localStorage helpers ─────────────────────────────────── */
function lsGet(key: string): { ts: number; data: unknown } | null {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (typeof parsed?.ts !== 'number' || !parsed.data) return null;
    return parsed;
  } catch { return null; }
}

function lsSet(key: string, data: unknown): void {
  try { localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data })); } catch {}
}

function lsDel(key: string): void {
  try { localStorage.removeItem(key); } catch {}
}

/* ─── Products (6hr cache) ───────────────────────────────────────── */
let _productsPromise: Promise<Product[]> | null = null;

export async function fetchProducts(): Promise<Product[]> {
  if (_productsPromise) return _productsPromise;

  const cached = lsGet('calvac_products_v2');
  if (cached && Date.now() - cached.ts < PRODUCTS_TTL) {
    _productsPromise = Promise.resolve(fixProducts(cached.data as Product[]));
    return _productsPromise;
  }

  _productsPromise = fetch(`${BASE}/api/products`)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then((data: Product[]) => {
      lsSet('calvac_products_v2', data);
      return fixProducts(data);
    })
    .catch(e => { _productsPromise = null; throw e; });

  return _productsPromise;
}

export function clearProductsCache(): void {
  _productsPromise = null;
  lsDel('calvac_products_v2');
}

/* ─── Site settings (12hr cache) ────────────────────────────────── */
let _settingsPromise: Promise<SiteSettings> | null = null;

const DEFAULT_SETTINGS: SiteSettings = {
  primary_color: '#2B9FD8', hero_font: 'default',
  model_path: '/static/sneaker.glb', model_scale: 3.0, model_y: 0.8, model_speed: 0.006,
  size_unit: 'uk', show_new_arrivals: true, show_categories: true,
  cat_boots: true, cat_crocs: true, cat_girls: true, cat_sale: true,
  cat_under1000: true, cat_under1500: true, cat_under2500: true,
  cat_new: true, cat_premium: true, cat_all: true,
};

export async function fetchSiteSettings(): Promise<SiteSettings> {
  if (_settingsPromise) return _settingsPromise;

  const cached = lsGet('calvac_settings_v2');
  if (cached && Date.now() - cached.ts < SETTINGS_TTL) {
    _settingsPromise = Promise.resolve({ ...DEFAULT_SETTINGS, ...(cached.data as Partial<SiteSettings>) });
    return _settingsPromise;
  }

  _settingsPromise = fetch(`${BASE}/api/site-settings`)
    .then(r => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); })
    .then((data: Partial<SiteSettings>) => {
      lsSet('calvac_settings_v2', data);
      return { ...DEFAULT_SETTINGS, ...data };
    })
    .catch(() => DEFAULT_SETTINGS);

  return _settingsPromise;
}

/* ─── Offer ribbon (30min cache) ─────────────────────────────────── */
export async function fetchOffer(): Promise<Offer> {
  const cached = lsGet('calvac_offer_v1');
  if (cached && Date.now() - cached.ts < OFFER_TTL) {
    return cached.data as Offer;
  }
  try {
    const r = await fetch(`${BASE}/api/offer`);
    if (!r.ok) throw new Error(`${r.status}`);
    const data: Offer = await r.json();
    lsSet('calvac_offer_v1', data);
    return data;
  } catch {
    return { active: false, text: '', bg_color: '#FF6B35', text_color: '#ffffff', show_logo: true };
  }
}

/* ─── Single product (6hr cache, keyed by ID) ───────────────────── */
export async function fetchProduct(id: number): Promise<Product> {
  if (!Number.isInteger(id) || id <= 0) throw new Error('Invalid product ID');

  const cacheKey = `calvac_product_${id}`;
  const cached = lsGet(cacheKey);
  if (cached && Date.now() - cached.ts < PRODUCT_TTL) {
    return cached.data as Product;
  }

  const r = await fetch(`${BASE}/api/products/${id}`);
  if (!r.ok) throw new Error('Not found');
  const p: Product = await r.json();
  const fixed = fixProducts([p])[0];
  lsSet(cacheKey, fixed);
  return fixed;
}

/* ─── Search (1hr cache, keyed by query) ────────────────────────── */
export async function searchProducts(q: string): Promise<Product[]> {
  const safe = q.replace(/<[^>]*>/g, '').slice(0, 100).trim();
  if (!safe) return [];

  const cacheKey = `calvac_search_${safe.toLowerCase()}`;
  const cached = lsGet(cacheKey);
  if (cached && Date.now() - cached.ts < SEARCH_TTL) {
    return cached.data as Product[];
  }

  try {
    const r = await fetch(`${BASE}/api/search?q=${encodeURIComponent(safe)}`);
    if (!r.ok) throw new Error(`${r.status}`);
    const data: Product[] = await r.json();
    const fixed = fixProducts(data);
    lsSet(cacheKey, fixed);
    return fixed;
  } catch {
    return [];
  }
}

/* ─── Create order (no cache, always fresh) ─────────────────────── */
export async function createOrder(payload: {
  address: object; items: object[]; total: number;
}): Promise<void> {
  try {
    await fetch(`${BASE}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
  } catch {}
}

export { ikResize };
