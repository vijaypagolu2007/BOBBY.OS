import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from 'firebase/app-check';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

let app, auth, db, googleProvider;
const useMockAuth = import.meta.env.VITE_E2E_MOCK_AUTH === 'true';

if (!useMockAuth && firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key') {
  app = initializeApp(firebaseConfig);

  // App Check (reCAPTCHA Enterprise / Fraud Defense, free up to 10k assessments/month) protects Firebase AI Logic (Gemini) from abuse.
  // Local dev: a debug token is printed in the console; register it in
  // Firebase console > App Check > Apps > Manage debug tokens.
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY;
  if (typeof window !== 'undefined' && recaptchaKey) {
    if (import.meta.env.DEV) {
      // Use a token generated in the console (VITE_APPCHECK_DEBUG_TOKEN), or let the SDK
      // create one and print it to the console. Dev builds only; never ship it.
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_DEBUG_TOKEN || true;
    } else if (import.meta.env.MODE === 'android' && import.meta.env.VITE_APPCHECK_ANDROID_TOKEN) {
      // App Check rejects reCAPTCHA tokens from the Android WebView (401), and Play
      // Integrity needs a paid Play Console account. Android builds (`npm run android`,
      // env from the gitignored .env.android) use a registered debug token instead.
      // Never set this for the web build. Revoke it in the console if the APK leaks.
      self.FIREBASE_APPCHECK_DEBUG_TOKEN = import.meta.env.VITE_APPCHECK_ANDROID_TOKEN;
    }
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(recaptchaKey),
      isTokenAutoRefreshEnabled: true,
    });
  }
  auth = getAuth(app);
  db = getFirestore(app);

  // Enable offline persistence for instantaneous local loading (great for mobile/flaky laptop networks)
  if (typeof window !== 'undefined') {
    enableIndexedDbPersistence(db).catch((err) => {
      if (err.code === 'failed-precondition') {
        console.warn('BOBBY.OS: Offline persistence failed (multiple tabs open).');
      } else if (err.code === 'unimplemented') {
        console.warn('BOBBY.OS: Offline persistence not supported by this browser.');
      }
    });
  }

  googleProvider = new GoogleAuthProvider();
  console.log('BOBBY.OS: Cloud Persistence Active.');
} else {
  console.warn('BOBBY.OS: No Firebase API Key found. Running in Local-Only Mock Mode.');
  // Mock implementations to prevent crashes
  auth = {
    currentUser: null,
    signOut: async () => {
      auth.currentUser = null;
      console.log('Mock Logout');
    },
  };
  db = {};
  googleProvider = {};
}

export { app, auth, db, googleProvider };
