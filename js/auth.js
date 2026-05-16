import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { DB } from './db.js';

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
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
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
