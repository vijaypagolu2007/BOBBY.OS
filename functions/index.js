const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { initializeApp, getApps } = require('firebase-admin/app');
const { getAuth } = require('firebase-admin/auth');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');

// Initialise Firebase Admin once (safe to call multiple times)
if (!getApps().length) initializeApp();

// Store the Gemini key as a Firebase Secret — set with:
//   firebase functions:secrets:set GEMINI_API_KEY
const GEMINI_API_KEY = defineSecret('GEMINI_API_KEY');

const GEMINI_ENDPOINT =
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

const GENERATION_CONFIG = { temperature: 0.7, maxOutputTokens: 120 };

// ─── Auth helper ─────────────────────────────────────────────────────────────

/** Verifies Bearer token from the Authorization header. Returns decoded uid or throws. */
async function verifyAuth(req) {
    const authHeader = req.headers.authorization || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
    if (!idToken) throw Object.assign(new Error('Missing auth token'), { status: 401 });
    try {
        const decoded = await getAuth().verifyIdToken(idToken);
        return decoded.uid;
    } catch {
        throw Object.assign(new Error('Invalid auth token'), { status: 401 });
    }
}

// ─── Rate-limit helper ───────────────────────────────────────────────────────

const RATE_LIMIT_WINDOW_MS = 30_000; // 30 seconds per user

/**
 * Simple Firestore-backed rate limiter.
 * Throws if the uid has made a request within the last RATE_LIMIT_WINDOW_MS.
 */
async function checkRateLimit(uid) {
    const db = getFirestore();
    const ref = db.collection('gemini_rate_limits').doc(uid);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const now = Date.now();
        const last = snap.exists ? (snap.data().lastCall || 0) : 0;

        if (now - last < RATE_LIMIT_WINDOW_MS) {
            const waitSecs = Math.ceil((RATE_LIMIT_WINDOW_MS - (now - last)) / 1000);
            throw Object.assign(
                new Error(`Rate limit: wait ${waitSecs}s before next AI request.`),
                { status: 429 }
            );
        }

        tx.set(ref, { lastCall: now }, { merge: true });
    });
}

// ─── Server-side prompt builder ──────────────────────────────────────────────

/**
 * Builds the Gemini prompt entirely server-side from validated data fields.
 * The client sends structured data; the server controls the prompt template.
 */
function buildPrompt(ctx) {
    const { time, sleepHours, habitSummary, cpSummary, schedSummary, pendingTargets, doneTargets } = ctx;

    return `You are BOBBY.OS, an elite AI study and productivity advisor.
The user is a computer science student preparing for PLACEMENTS.
Here is their current state:
- Time: ${time}
- Sleep last night: ${sleepHours}h (target 8.0h)
- Today's habits: ${habitSummary}
- Codeforces: ${cpSummary}
- Today's schedule: ${schedSummary}
- Daily targets pending: ${pendingTargets}
- Daily targets done: ${doneTargets}

Give a VERY short, punchy 1-2 sentence piece of advice targeting their weakest area right now. Under 150 characters. Use **bolding** for key concepts. Be authoritative, no pleasantries — just the advice.`;
}

// ─── Cloud Function ───────────────────────────────────────────────────────────

exports.geminiProxy = onRequest(
    { secrets: [GEMINI_API_KEY], cors: true },
    async (req, res) => {
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method not allowed' });
            return;
        }

        // 1. Authenticate — reject unauthenticated callers
        let uid;
        try {
            uid = await verifyAuth(req);
        } catch (err) {
            res.status(err.status || 401).json({ error: err.message });
            return;
        }

        // 2. Rate-limit — max 1 call per 30s per user
        try {
            await checkRateLimit(uid);
        } catch (err) {
            res.status(err.status || 429).json({ error: err.message });
            return;
        }

        // 3. Validate the incoming context fields (client sends data, not a raw prompt)
        const ctx = req.body;
        const requiredFields = ['time', 'sleepHours', 'habitSummary', 'cpSummary', 'schedSummary', 'pendingTargets', 'doneTargets'];
        for (const field of requiredFields) {
            if (ctx[field] === undefined || ctx[field] === null) {
                res.status(400).json({ error: `Missing required field: ${field}` });
                return;
            }
        }

        // 4. Build prompt server-side and call Gemini
        try {
            const prompt = buildPrompt(ctx);

            const upstream = await fetch(
                `${GEMINI_ENDPOINT}?key=${GEMINI_API_KEY.value()}`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        contents: [{ parts: [{ text: prompt }] }],
                        generationConfig: GENERATION_CONFIG,
                    }),
                }
            );

            const data = await upstream.json();

            if (!upstream.ok) {
                const message = data?.error?.message || `Gemini API error ${upstream.status}`;
                res.status(upstream.status).json({ error: message });
                return;
            }

            res.status(200).json(data);
        } catch (err) {
            console.error('geminiProxy error:', err);
            res.status(500).json({ error: 'Proxy internal error.' });
        }
    }
);
