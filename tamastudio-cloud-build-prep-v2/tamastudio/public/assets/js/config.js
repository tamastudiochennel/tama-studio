export const SITE = {
  name: 'TS | TAMA STUDIO',
  waDisplay: '0882-0023-40869',
  waNumber: '62882002340869',
  email: 'tamastudiochennel@gmail.com',
};
export const wa = (text) => `https://wa.me/${SITE.waNumber}?text=${encodeURIComponent(text)}`;
export const firebaseConfig = {
  apiKey: 'AIzaSyDTICqFxzA0NRguZsgZg0qZn5hel3bp1AE',
  authDomain: 'tama-studio-store.firebaseapp.com',
  databaseURL: 'https://tama-studio-store-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'tama-studio-store',
  storageBucket: 'tama-studio-store.firebasestorage.app',
  messagingSenderId: '188712433495',
  appId: '1:188712433495:web:a48db391758bd716b7f012',
  measurementId: 'G-QQ1Q2YSP3X',
};
export const APP_CHECK_KEY = '';
