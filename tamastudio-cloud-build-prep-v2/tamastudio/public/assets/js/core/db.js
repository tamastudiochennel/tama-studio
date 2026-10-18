import { app } from './firebase.js';
import { getFirestore, doc, getDoc, collection, getDocs, query, where, limit } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
export const db = getFirestore(app);
export { doc, getDoc, collection, getDocs, query, where, limit };
