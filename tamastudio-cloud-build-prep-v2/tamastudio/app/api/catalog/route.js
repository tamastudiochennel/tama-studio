import { admin } from '../../../lib/admin.js';
import { PACKAGES } from '../../../lib/defaults.js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function publicPackages(source) {
  return source.filter((item) => item && (item.active == null || item.active === true)
    && typeof item.name === 'string' && item.name.trim().length > 0 && item.name.length <= 60
    && Number.isSafeInteger(item.price) && item.price > 0 && item.price <= 1_000_000_000
    && Array.isArray(item.features) && item.features.length > 0 && item.features.length <= 30
    && item.features.every((feature) => typeof feature === 'string' && feature.trim().length > 0 && feature.length <= 240))
    .map((item) => ({
      name: item.name.trim(),
      description: typeof item.description === 'string' ? item.description.slice(0, 300) : '',
      price: item.price,
      features: item.features.map((feature) => feature.trim()),
      revisions: Number.isInteger(item.revisions) && item.revisions >= 0 && item.revisions <= 100 ? item.revisions : null,
      estimatedDays: Number.isInteger(item.estimatedDays) && item.estimatedDays >= 1 && item.estimatedDays <= 365 ? item.estimatedDays : null,
      featured: item.featured === true,
      version: Number.isSafeInteger(item.version) && item.version > 0 ? item.version : 1,
    }));
}

export async function GET() {
  try {
    const snap = await admin().db.doc('cms/packages').get();
    const source = snap.exists && Array.isArray(snap.data().items) ? snap.data().items : PACKAGES;
    const items = publicPackages(source);
    return Response.json({ ok: true, items }, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=120, stale-while-revalidate=300' },
    });
  } catch {
    return Response.json({ ok: false, message: 'Katalog belum dapat dimuat.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  }
}
