import { admin } from './admin.js';

export async function cmsItems(name, fallback) {
  try {
    const s = await admin().db.doc('cms/' + name).get();
    const items = s.exists && s.data().items;
    const source = Array.isArray(items) ? items : fallback;
    // The public catalog must never expose packages deliberately unpublished by an admin.
    return name === 'packages' ? source.filter((item) => item && item.active !== false) : source;
  } catch (e) {
    // A failed private catalog read must not display prices that cannot be ordered server-side.
    return name === 'packages' ? [] : fallback;
  }
}

export async function approvedTestimonials() {
  try {
    const s = await admin().db.collection('testimonials').where('status', '==', 'approved').limit(30).get();
    return s.docs.map((d) => d.data());
  } catch (e) {
    return [];
  }
}
