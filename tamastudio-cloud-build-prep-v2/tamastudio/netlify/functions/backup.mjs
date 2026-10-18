import { getStore } from '@netlify/blobs';
import { FieldPath } from 'firebase-admin/firestore';
import { admin } from '../../lib/admin.js';

const COLLECTIONS = ['users', 'orders', 'testimonials', 'cms', 'ids', 'stats'];
const PAGE_SIZE = 500;

async function exportCollection(db, name) {
  const rows = [];
  let cursor = null;
  while (true) {
    let query = db.collection(name)
      .orderBy(FieldPath.documentId())
      .limit(PAGE_SIZE);
    if (cursor) query = query.startAfter(cursor);
    const page = await query.get();
    if (page.empty) break;
    for (const doc of page.docs) rows.push({ id: doc.id, ...doc.data() });
    cursor = page.docs[page.docs.length - 1];
    if (page.size < PAGE_SIZE) break;
  }
  return rows;
}

export default async () => {
  const { db } = admin();
  const generatedAt = new Date().toISOString();
  const out = {
    _meta: {
      format: 'tamastudio-backup-v1',
      generatedAt,
      collections: COLLECTIONS,
      note: 'Snapshot ekspor bertahap; bukti transfer pada payment_proofs tidak disertakan.',
    },
  };
  for (const name of COLLECTIONS) out[name] = await exportCollection(db, name);

  const key = 'backup-' + generatedAt.slice(0, 10) + '.json';
  const store = getStore('backups');
  await store.set(key, JSON.stringify(out));

  // Keep the latest 14 daily backups, and never delete unrelated blobs in this store.
  const keys = (await store.list()).blobs
    .map((blob) => blob.key)
    .filter((blobKey) => /^backup-\d{4}-\d{2}-\d{2}\.json$/.test(blobKey))
    .sort();
  await Promise.all(keys.slice(0, Math.max(0, keys.length - 14)).map((oldKey) => store.delete(oldKey)));
  return new Response('Backup completed', { status: 200 });
};

export const config = { schedule: '@daily' };
