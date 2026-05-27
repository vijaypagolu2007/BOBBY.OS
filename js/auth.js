import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, GoogleAuthProvider, signInWithCredential } from "firebase/auth";
import { DB } from './db.js';
import { Capacitor } from '@capacitor/core';
import { FirebaseAuthentication } from '@capacitor-firebase/authentication';

export let currentUser = null;

const isMock = !auth.onAuthStateChanged;

// BUG-4 Fix: Human-readable Firebase auth error messages
const FIREBASE_AUTH_ERRORS = {
    'auth/email-already-in-use': 'This email is already registered. Please log in instead.',
    'auth/weak-password': 'Password must be at least 6 characters.',
    'auth/invalid-email': 'Please enter a valid email address.',
    'auth/wrong-password': 'Incorrect password. Please try again.',
    'auth/user-not-found': 'No account found with this email.',
    'auth/too-many-requests': 'Too many attempts. Please wait a moment and try again.',
    'auth/network-request-failed': 'Network error. Check your connection.',
};

export function initAuth(onUserChange) {
    if (isMock) {
        // In mock mode, check LocalStorage for a fake session
        DB.get('bobbyos:session').then(session => {
            currentUser = session;
            if (onUserChange) onUserChange(currentUser);
        });
        return;
    }

    onAuthStateChanged(auth, async (user) => {
        if (user) {
            currentUser = {
                uid: user.uid,
                email: user.email,
                name: user.displayName || user.email.split('@')[0],
                photoURL: user.photoURL
            };
            await DB.set('bobbyos:session', currentUser);
        } else {
            currentUser = null;
            await DB.del('bobbyos:session');
        }
        if (onUserChange) onUserChange(currentUser);
    });
}

export async function checkSession() {
    const session = await DB.get('bobbyos:session');
    if (session) currentUser = session;
    return session;
}

export async function loginWithGoogle() {
    if (isMock) {
        return await doMockLogin('Mock User', 'mock@example.com');
    }
    
    // Check if running on a native platform (Android or iOS)
    if (Capacitor.isNativePlatform()) {
        try {
            console.log("BOBBY.OS: Triggering Native Google Sign-In...");
            const nativeResult = await FirebaseAuthentication.signInWithGoogle();
            
            const idToken = nativeResult.credential?.idToken;
            if (!idToken) {
                throw new Error("No credential/idToken returned from native Google login.");
            }
            
            // Sign in to the Firebase Web/JS SDK using the native credential
            const credential = GoogleAuthProvider.credential(idToken);
            const result = await signInWithCredential(auth, credential);
            return result.user;
        } catch (e) {
            console.error("BOBBY.OS: Native Google Sign-In failed:", e);
            throw new Error(e.message || "Native Google Sign-In failed.");
        }
    }
    
    // Fallback to standard web flow if on localhost / standard Web browser
    try {
        const result = await signInWithPopup(auth, googleProvider);
        return result.user;
    } catch (e) {
        console.error("Google Auth Error:", e);
        const errorMsg = (e.message || "").toLowerCase();
        
        // Storage partitioning or sessionStorage access failures
        if (errorMsg.includes("missing initial state") || errorMsg.includes("sessionstorage") || e.code === "auth/web-storage-unsupported") {
            throw new Error(
                "Unable to sign in: Browser storage or third-party cookies are partitioned/blocked. " +
                "Please enable 'Cross-Site Tracking' or 'Third-Party Cookies' in your browser settings, or use Email login."
            );
        }
        
        // Popup blocked by browser settings
        if (e.code === "auth/popup-blocked") {
            throw new Error(
                "Google Sign-In popup was blocked by your browser. Please allow popups for this site and try again."
            );
        }
        
        // Popup closed before completing flow
        if (e.code === "auth/popup-closed-by-user") {
            throw new Error("Sign-in popup was closed before completion. Please try again.");
        }
        
        throw new Error(FIREBASE_AUTH_ERRORS[e.code] || e.message);
    }
}

export async function doLogin(email, pass) {
    if (isMock) {
        return await doMockLogin(email.split('@')[0], email);
    }
    try {
        const result = await signInWithEmailAndPassword(auth, email, pass);
        return result.user;
    } catch (e) {
        throw new Error(FIREBASE_AUTH_ERRORS[e.code] || e.message);
    }
}

export async function doRegister(name, email, pass) {
    if (isMock) {
        return await doMockLogin(name, email);
    }
    try {
        const result = await createUserWithEmailAndPassword(auth, email, pass);
        await updateProfile(result.user, { displayName: name });
        return result.user;
    } catch (e) {
        throw new Error(FIREBASE_AUTH_ERRORS[e.code] || e.message);
    }
}

async function doMockLogin(name, email) {
    currentUser = {
        uid: 'mock-user-' + Math.random().toString(36).substr(2, 9),
        email: email,
        name: name,
        photoURL: null
    };
    await DB.set('bobbyos:session', currentUser);
    return currentUser;
}

export async function doLogout() {
    if (!isMock) await signOut(auth);
    await DB.del('bobbyos:session');
    currentUser = null;
}
