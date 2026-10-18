import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

let cache;
export function admin() {
  if (!cache) {
    const projectId = (process.env.FIREBASE_PROJECT_ID || '').trim();
    const clientEmail = (process.env.FIREBASE_CLIENT_EMAIL || '').trim();
    const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n').trim();
    if (!projectId || !clientEmail || !privateKey) {
      throw new Error('Firebase Admin belum dikonfigurasi. Isi FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, dan FIREBASE_PRIVATE_KEY pada environment server.');
    }
    if (!privateKey.includes('-----BEGIN PRIVATE KEY-----') || !privateKey.includes('-----END PRIVATE KEY-----')) {
      throw new Error('FIREBASE_PRIVATE_KEY tidak memiliki format PEM yang valid.');
    }
    const app = getApps()[0] || initializeApp({
      credential: cert({ projectId, clientEmail, privateKey }),
    });
    cache = { auth: getAuth(app), db: getFirestore(app) };
  }
  return cache;
}
