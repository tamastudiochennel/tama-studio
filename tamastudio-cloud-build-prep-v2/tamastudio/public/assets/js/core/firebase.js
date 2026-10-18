import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import { firebaseConfig, APP_CHECK_KEY } from '../config.js';

export const app = initializeApp(firebaseConfig);
if (APP_CHECK_KEY) {
  const { initializeAppCheck, ReCaptchaEnterpriseProvider } = await import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-check.js');
  initializeAppCheck(app, { provider: new ReCaptchaEnterpriseProvider(APP_CHECK_KEY), isTokenAutoRefreshEnabled: true });
}
