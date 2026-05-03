import type { Offer, Product, SiteSettings } from '@/types';
import type { AdminOrder, AdminProductPayload } from '@/types/admin';

const LIVE = 'https://calvac.in';
const isLocal = typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

/* ── Auth token helper ──────────────────────────────────────────────
   The Flask backend at calvac.in checks for a session cookie set by
   its own login page.  The React admin uses Supabase instead.
   We attach the Supabase JWT as Authorization: Bearer so Flask can
   optionally verify it (requires backend support).
   We ALSO send credentials:include so the proxied session cookie
   (rewritten to localhost by vite cookieDomainRewrite) is forwarded.
─────────────────────────────────────────────────────────────────── */
function getSupabaseToken(): string | null {
  try {
    // Supabase stores the session in localStorage under sb-*-auth-token
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i) || '';
      if (key.includes('-auth-token') || key.startsWith('sb-')) {
        const val = JSON.parse(localStorage.getItem(key) || 'null');
        const token = val?.access_token ?? val?.session?.access_token ?? null;
        if (token) return token;
      }
    }
  } catch {}
  return null;
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getSupabaseToken();
  return {
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...(extra ?? {}),
  };
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
  return res.json() as Promise<T>;
}

/* Primary: proxied path (works when deployed, session cookie forwarded).
   Fallback: direct LIVE url with CORS + Supabase JWT.              */
async function fetchAdmin<T>(path: string, init?: RequestInit): Promise<T> {
  const headers = {
    ...authHeaders(),
    ...(init?.headers as Record<string, string> | undefined ?? {}),
  };
  try {
    return await fetchJson<T>(path, { credentials: 'include', ...init, headers });
  } catch (primaryErr) {
    if (!isLocal) throw primaryErr;         // on Vercel, don't double-hit
    try {
      return await fetchJson<T>(`${LIVE}${path}`, {
        credentials: 'include',
        mode: 'cors',
        ...init,
        headers,
      });
    } catch {
      throw primaryErr;                      // surface original error
    }
  }
}

const JSON_H = { 'Content-Type': 'application/json' };

/* ── Orders ── */
export async function fetchAdminOrders(): Promise<AdminOrder[]> {
  return fetchAdmin<AdminOrder[]>('/api/x9k2/orders');
}
export async function updateOrderStatus(orderId: number, status: AdminOrder['status']) {
  return fetchAdmin<{ success: boolean; error?: string }>(
    `/api/orders/${orderId}/status`,
    { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ status }) },
  );
}
export async function updateOrderNotes(orderId: number, notes: string) {
  return fetchAdmin<{ success: boolean; error?: string }>(
    `/api/orders/${orderId}/notes`,
    { method: 'PATCH', headers: JSON_H, body: JSON.stringify({ notes }) },
  );
}

/* ── Products ── */
export async function fetchAdminProducts(): Promise<Product[]> {
  return fetchJson<Product[]>('/api/products');
}
export async function createAdminProduct(payload: AdminProductPayload) {
  return fetchAdmin<{ success?: boolean; product?: Product; error?: string }>(
    '/api/x9k2/products',
    { method: 'POST', headers: JSON_H, body: JSON.stringify(payload) },
  );
}
export async function updateAdminProduct(productId: number, payload: AdminProductPayload) {
  return fetchAdmin<{ success?: boolean; product?: Product; error?: string }>(
    `/api/x9k2/products/${productId}`,
    { method: 'PUT', headers: JSON_H, body: JSON.stringify(payload) },
  );
}
export async function deleteAdminProduct(productId: number) {
  return fetchAdmin<{ success?: boolean; error?: string }>(
    `/api/x9k2/products/${productId}`,
    { method: 'DELETE' },
  );
}

/* ── Settings ── */
export async function fetchAdminSettings(): Promise<Partial<SiteSettings> & Record<string, unknown>> {
  return fetchAdmin<Partial<SiteSettings> & Record<string, unknown>>('/api/x9k2/site-settings');
}
export async function saveAdminSettings(payload: Record<string, unknown>) {
  return fetchAdmin<{ success?: boolean; error?: string }>(
    '/api/x9k2/site-settings',
    { method: 'POST', headers: JSON_H, body: JSON.stringify(payload) },
  );
}

/* ── Offer ── */
export async function fetchAdminOffer(): Promise<Offer> {
  return fetchAdmin<Offer>('/api/offer');
}
export async function saveAdminOffer(payload: Offer) {
  return fetchAdmin<{ success?: boolean; error?: string }>(
    '/api/x9k2/offer',
    { method: 'POST', headers: JSON_H, body: JSON.stringify(payload) },
  );
}
