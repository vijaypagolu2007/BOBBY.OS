import { db } from './firebase.js';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot } from "firebase/firestore";

// ══════════════════════════════════════════════════════
//  DATABASE LAYER — Firestore (persistent, cross-device)
// ══════════════════════════════════════════════════════

export const DB = {
    async get(key) {
        try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : null; } catch { return null; }
    },
    async set(key, val) {
        try { localStorage.setItem(key, JSON.stringify(val)); } catch { }
    },
    async del(key) {
        try { localStorage.removeItem(key); } catch { }
    }
};

export function uKey(uid, k) { 
    return uid ? `bobbyos:${uid}:${k}` : `bobbyos:guest:${k}`; 
}

export let S = {}; // In-memory cache

let preloadedPromise = null;

export async function preloadAllUserData(uid) {
    if (!uid) return;
    if (preloadedPromise) return preloadedPromise;

    preloadedPromise = (async () => {
        const userRef = uDoc(uid);
        if (!userRef) return;

        showSyncIndicator('saving');

        // Safety timeout to prevent boot hangs when offline or on poor network
        const timeoutPromise = new Promise((resolve) => {
            setTimeout(() => {
                console.warn("BOBBY.OS: Preload timed out. Proceeding with local fallback.");
                showSyncIndicator('offline');
                resolve(null);
            }, 2500);
        });

        const fetchPromise = (async () => {
            try {
                const snap = await getDoc(userRef);
                return snap;
            } catch (e) {
                console.error("BOBBY.OS: Cloud preload fetch error:", e);
                return null;
            }
        })();

        const snap = await Promise.race([fetchPromise, timeoutPromise]);

        if (snap && snap.exists()) {
            const data = snap.data();
            Object.assign(S, data);

            // Sync all fetched keys to LocalStorage in bulk
            for (const k in data) {
                await DB.set(uKey(uid, k), data[k]);
            }
            showSyncIndicator('saved');
        } else {
            // Preload timed out or failed; reset the promise to allow resilient fallback fetches
            preloadedPromise = null;
        }
    })();

    return preloadedPromise;
}

/** Clear cache on logout */
export function clearCache() {
    S = {};
    preloadedPromise = null;
}

// User-specific Firestore helper
export function uDoc(uid) { 
    if (!db || Object.keys(db).length === 0) return null;
    return doc(db, "users", uid); 
}

export async function dbSave(uid, k, v) {
    const key = uKey(uid, k);
    S[k] = v;
    await DB.set(key, v); // Instant local save (awaited for safety)
    
    if (uid) {
        // Fire-and-forget cloud sync to prevent UI blocking
        (async () => {
            showSyncIndicator('saving');
            
            // Graceful timeout: If the cloud write takes more than 3 seconds (offline/slow network),
            // temporarily show 'local only' so the UI doesn't get stuck on 'syncing...'
            const offlineTimer = setTimeout(() => {
                showSyncIndicator('offline');
            }, 3000);

            try {
                const userRef = uDoc(uid);
                if (userRef) {
                    await setDoc(userRef, { [k]: v }, { merge: true });
                    clearTimeout(offlineTimer);
                    showSyncIndicator('saved');
                } else {
                    clearTimeout(offlineTimer);
                    showSyncIndicator('offline');
                }
            } catch (e) {
                clearTimeout(offlineTimer);
                console.error("Cloud save failed:", e);
                showSyncIndicator('error');
            }
        })();
    }
}

export async function dbLoad(uid, k, def = null) {
    if (S[k] !== undefined && S[k] !== null) return S[k];
    
    const key = uKey(uid, k);
    
    // 1. Try LocalStorage (Fastest)
    const local = await DB.get(key);
    if (local !== null) {
        S[k] = local;
        return local;
    }

    // 2. Try Cloud if UID exists, local was missing/stale, and we haven't started preloading yet.
    // If preloading has started, we rely completely on S and LocalStorage to avoid blocking UI with sequential getDoc calls.
    if (uid && !preloadedPromise) {
        try {
            const userRef = uDoc(uid);
            if (userRef) {
                const snap = await getDoc(userRef);
                if (snap.exists()) {
                    const data = snap.data();
                    if (data[k] !== undefined) {
                        S[k] = data[k];
                        await DB.set(key, data[k]);
                        return data[k];
                    }
                }
            }
        } catch (e) {
            console.error("Cloud load error:", e);
        }
    }

    return (S[k] !== undefined && S[k] !== null) ? S[k] : def;
}

// Setup real-time listener for user data
export function listenToUserData(uid, onUpdate) {
    if (!uid) return;
    const userRef = uDoc(uid);
    if (!userRef) return;
    return onSnapshot(userRef, (doc) => {
        if (doc.exists()) {
            const data = doc.data();
            Object.assign(S, data);
            
            // Sync all keys to LocalStorage
            for (const k in data) {
                DB.set(uKey(uid, k), data[k]);
            }
            
            if (onUpdate) onUpdate(data);
        }
    });
}

let syncTimer;
export function showSyncIndicator(state) {
    const el = document.getElementById('sync-ind');
    if (!el) return;
    el.className = `sync-indicator ${state}`;
    if (state === 'saving') el.textContent = 'syncing...';
    else if (state === 'error') el.textContent = '⚠ sync error';
    else if (state === 'offline') el.textContent = 'local only';
    else el.textContent = '✓ synced';
    
    clearTimeout(syncTimer);
    if (state === 'saved') syncTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}
