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

/** Clear cache on logout */
export function clearCache() {
    S = {};
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
            try {
                const userRef = uDoc(uid);
                if (userRef) {
                    await setDoc(userRef, { [k]: v }, { merge: true });
                    showSyncIndicator('saved');
                } else {
                    showSyncIndicator('offline');
                }
            } catch (e) {
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
        // Don't return yet, we might want to check cloud if we are online
        // But for speed, let's return and let the listener update if needed
    }

    // 2. Try Cloud if UID exists and local was missing/stale
    if (uid) {
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
    if (state === 'saving') el.textContent = 'saving...';
    else if (state === 'error') el.textContent = '⚠ sync error';
    else if (state === 'offline') el.textContent = 'local only';
    else el.textContent = '✓ synced';
    
    clearTimeout(syncTimer);
    if (state === 'saved') syncTimer = setTimeout(() => el.classList.add('hidden'), 2000);
}
