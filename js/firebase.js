import { initializeApp } from "firebase/app";
import { getAuth, GoogleAuthProvider } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID
};

let app, auth, db, googleProvider;

if (firebaseConfig.apiKey && firebaseConfig.apiKey !== 'your_api_key') {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    
    // Enable offline persistence for instantaneous local loading (great for mobile/flaky laptop networks)
    if (typeof window !== 'undefined') {
        enableIndexedDbPersistence(db).catch((err) => {
            if (err.code === 'failed-precondition') {
                console.warn("BOBBY.OS: Offline persistence failed (multiple tabs open).");
            } else if (err.code === 'unimplemented') {
                console.warn("BOBBY.OS: Offline persistence not supported by this browser.");
            }
        });
    }
    
    googleProvider = new GoogleAuthProvider();
    console.log("BOBBY.OS: Cloud Persistence Active.");
} else {
    console.warn("BOBBY.OS: No Firebase API Key found. Running in Local-Only Mock Mode.");
    // Mock implementations to prevent crashes
    auth = { 
        currentUser: null,
        signOut: async () => { auth.currentUser = null; console.log('Mock Logout'); }
    };
    db = {}; 
    googleProvider = {};
}

export { auth, db, googleProvider };
