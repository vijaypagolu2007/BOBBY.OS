import { dbLoad } from './db.js';
import { wkKey, wkDates, ck, iso, today } from './utils.js';
import { buildHabits, defSlots } from './data.js';

// ─── Context builders ────────────────────────────────────────────────────────

/** Returns today's habit completion as "X/Y (Z%)" */
async function buildHabitSummary(uid) {
    try {
        const habits = await buildHabits(uid);
        const habitData = await dbLoad(uid, 'habits', {});
        const wk = wkKey(0);
        const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6

        let done = 0, total = 0;
        for (const h of habits) {
            if (h.group) continue;
            // Only count habits that apply today
            const isWeekend = todayIndex >= 5;
            if (h.freq === 'wd' && isWeekend) continue;
            if (h.freq === 'we' && !isWeekend) continue;
            total++;
            if (getHabitVal(habitData, h.id, wk, todayIndex) === 1) done++;
        }

        if (total === 0) return 'No habits tracked today';
        const pct = Math.round((done / total) * 100);
        return `${done}/${total} habits done (${pct}%)`;
    } catch {
        return 'Habit data unavailable';
    }
}

function getHabitVal(data, id, wk, di) {
    return data[ck(id, wk, di)] || 0;
}

/** Returns today's schedule as a readable list */
async function buildTodaySchedule(uid) {
    try {
        const todayIndex = (new Date().getDay() + 6) % 7;
        const slots = await dbLoad(uid, `sched:${todayIndex}`, null) || defSlots(todayIndex);
        return slots.map(s => `${s.time} – ${s.label}`).join(' | ');
    } catch {
        return 'Schedule unavailable';
    }
}

/** Returns Codeforces rating/rank if available */
async function buildCPSummary(uid) {
    try {
        const cp = await dbLoad(uid, 'power:cp', null);
        if (!cp) return 'No CP data';
        return `CF rating ${cp.rating} (${cp.rank})${cp.delta !== 0 ? `, last Δ ${cp.delta > 0 ? '+' : ''}${cp.delta}` : ''}`;
    } catch {
        return 'CP data unavailable';
    }
}

// ─── Gemini API call ─────────────────────────────────────────────────────────

const CLOUD_FN_URL = import.meta.env.VITE_GEMINI_PROXY_URL || null;
const DEV_API_KEY  = import.meta.env.VITE_GEMINI_API_KEY   || null;

async function callGemini(prompt) {
    let response;

    if (CLOUD_FN_URL) {
        // Production: call the Cloud Function proxy (key never exposed to client)
        response = await fetch(CLOUD_FN_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ prompt }),
        });
    } else if (DEV_API_KEY) {
        // Dev-only fallback: key is bundled but never shipped to production
        response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${DEV_API_KEY}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, maxOutputTokens: 120 },
                }),
            }
        );
    } else {
        return null; // No key and no proxy → caller uses mock
    }

    if (!response.ok) {
        const errorBody = await response.json().catch(() => null);
        throw new Error(errorBody?.error?.message || `API Error: ${response.status}`);
    }

    return response.json();
}

/** Safely extract text from a Gemini generateContent response. */
function extractAdvice(data) {
    const candidate = data?.candidates?.[0];
    if (!candidate) throw new Error('Gemini returned no candidates (possible safety block).');

    // finishReason other than STOP signals a blocked / incomplete response
    if (candidate.finishReason && candidate.finishReason !== 'STOP') {
        throw new Error(`Gemini response blocked (finishReason: ${candidate.finishReason}).`);
    }

    const text = candidate.content?.parts?.[0]?.text;
    if (!text) throw new Error('Gemini returned an empty response.');
    return text.trim();
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStudyAdvice(uid) {
    // ── Mock mode: no key and no proxy configured ──────────────────────────
    if (!CLOUD_FN_URL && !DEV_API_KEY) {
        const hour = new Date().getHours();
        let suggestion;
        if (hour < 12) {
            suggestion = "Morning peak! Priority: **cp**. Suggesting a 90-min deep focus session.";
        } else if (hour < 18) {
            suggestion = "Afternoon dip. Switch to active recall or lighter tasks like **Subject Revision**.";
        } else {
            suggestion = "Evening wrap-up. Review today's mistakes and plan tomorrow's 3 critical targets.";
        }
        return `[MOCK] "Analyzing schedule... ${suggestion}"\n(Add VITE_GEMINI_API_KEY or VITE_GEMINI_PROXY_URL to .env for real AI)`;
    }

    try {
        // ── Gather richer context in parallel ─────────────────────────────
        const [targets, sleep, habitSummary, schedSummary, cpSummary] = await Promise.all([
            dbLoad(uid, 'power:targets', []),
            dbLoad(uid, 'power:sleep', { actual: 0 }),
            buildHabitSummary(uid),
            buildTodaySchedule(uid),
            buildCPSummary(uid),
        ]);

        const pendingTargets = targets.filter(t => !t.done).map(t => t.text).join(', ') || 'None';
        const doneTargets    = targets.filter(t =>  t.done).map(t => t.text).join(', ') || 'None';

        const prompt = `You are BOBBY.OS, an elite AI study and productivity advisor.
The user is a computer science student preparing for PLACEMENTS.
Here is their current state:
- Time: ${new Date().toLocaleTimeString()}
- Sleep last night: ${sleep.actual}h (target 8.0h)
- Today's habits: ${habitSummary}
- Codeforces: ${cpSummary}
- Today's schedule: ${schedSummary}
- Daily targets pending: ${pendingTargets}
- Daily targets done: ${doneTargets}

Give a VERY short, punchy 1-2 sentence piece of advice targeting their weakest area right now. Under 150 characters. Use **bolding** for key concepts. Be authoritative, no pleasantries — just the advice.`;

        const data   = await callGemini(prompt);
        return extractAdvice(data);
    } catch (error) {
        console.error("Gemini API Error:", error.message);
        return `"AI Advisor unavailable: ${error.message}"`;
    }
}
