import { auth, googleProvider } from './firebase.js';
import { signInWithPopup, signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { DB } from './db.js';

export let currentUser = null;

export function initAuth(onUserChange) {
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
    const result = await signInWithPopup(auth, googleProvider);
    return result.user;
}

export async function doLogin(email, pass) {
    const result = await signInWithEmailAndPassword(auth, email, pass);
    return result.user;
}

export async function doRegister(name, email, pass) {
    const result = await createUserWithEmailAndPassword(auth, email, pass);
    await updateProfile(result.user, { displayName: name });
    return result.user;
}

export async function doLogout() {
    await signOut(auth);
    await DB.del('bobbyos:session');
    currentUser = null;
}
