import { dbLoad } from './db.js';
import { wkKey, ck } from './utils.js';
import { buildHabits, defSlots } from './data.js';
import { app, auth } from './firebase.js';
import { getAI, getGenerativeModel, GoogleAIBackend, ThinkingLevel } from 'firebase/ai';
import { extractAdvice } from './ai-format.js';

// ─── Context builders ────────────────────────────────────────────────────────

/** Returns today's habit completion as "X/Y (Z%)" */
async function buildHabitSummary(uid) {
  try {
    const habits = await buildHabits(uid);
    const habitData = await dbLoad(uid, 'habits', {});
    const wk = wkKey(0);
    const todayIndex = (new Date().getDay() + 6) % 7; // Mon=0 … Sun=6

    let done = 0,
      total = 0;
    for (const h of habits) {
      if (h.group) continue;
      const isWeekend = todayIndex >= 5;
      if (h.freq === 'wd' && isWeekend) continue;
      if (h.freq === 'we' && !isWeekend) continue;
      total++;
      if ((habitData[ck(h.id, wk, todayIndex)] || 0) === 1) done++;
    }

    if (total === 0) return 'No habits tracked today';
    const pct = Math.round((done / total) * 100);
    return `${done}/${total} habits done (${pct}%)`;
  } catch {
    return 'Habit data unavailable';
  }
}

/** Returns today's schedule as a readable list */
async function buildTodaySchedule(uid) {
  try {
    const todayIndex = (new Date().getDay() + 6) % 7;
    const slots = (await dbLoad(uid, `sched:${todayIndex}`, null)) || defSlots(todayIndex);
    return slots.map((s) => `${s.time} – ${s.label}`).join(' | ');
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

// ─── Gemini via Firebase AI Logic ────────────────────────────────────────────
// Runs on the free Spark plan: no Cloud Functions, no billing, and the Gemini key
// never ships in the bundle. App Check (see firebase.js) guards against abuse.

const AI_MODEL = 'gemini-3.5-flash-lite';
const RATE_LIMIT_MS = 30_000; // one request per 30s per browser
const RATE_KEY = 'bobbyos:ai:lastCall';

let model = null;
function getModel() {
  if (!model) {
    const ai = getAI(app, { backend: new GoogleAIBackend() });
    model = getGenerativeModel(ai, {
      model: AI_MODEL,
      // Thinking tokens count against maxOutputTokens, so keep thinking minimal
      // and leave headroom; the prompt itself still asks for <150 characters.
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 512,
        thinkingConfig: { thinkingLevel: ThinkingLevel.MINIMAL },
      },
    });
  }
  return model;
}

/** Returns seconds left before another request is allowed, or 0. */
function rateLimitWait() {
  const last = Number(localStorage.getItem(RATE_KEY) || 0);
  const left = RATE_LIMIT_MS - (Date.now() - last);
  return left > 0 ? Math.ceil(left / 1000) : 0;
}

function buildPrompt(ctx) {
  const { time, sleepHours, habitSummary, cpSummary, schedSummary, pendingTargets, doneTargets } =
    ctx;
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

// ─── Public API ───────────────────────────────────────────────────────────────

export async function getStudyAdvice(uid) {
  // ── Mock mode: Firebase not configured (local-only / E2E) ──────────────
  if (!app) {
    const hour = new Date().getHours();
    let suggestion;
    if (hour < 12) {
      suggestion = 'Morning peak! Priority: **cp**. Suggesting a 90-min deep focus session.';
    } else if (hour < 18) {
      suggestion =
        'Afternoon dip. Switch to active recall or lighter tasks like **Subject Revision**.';
    } else {
      suggestion =
        "Evening wrap-up. Review today's mistakes and plan tomorrow's 3 critical targets.";
    }
    return `[MOCK] Analyzing schedule... ${suggestion}`;
  }

  if (!auth?.currentUser) return 'Sign in to get AI advice.';

  const wait = rateLimitWait();
  if (wait) return `⏳ Wait ${wait}s before the next AI request.`;

  try {
    const [targets, sleep, habitSummary, schedSummary, cpSummary] = await Promise.all([
      dbLoad(uid, 'power:targets', []),
      dbLoad(uid, 'power:sleep', { actual: 0 }),
      buildHabitSummary(uid),
      buildTodaySchedule(uid),
      buildCPSummary(uid),
    ]);

    const pendingTargets =
      targets
        .filter((t) => !t.done)
        .map((t) => t.text)
        .join(', ') || 'None';
    const doneTargets =
      targets
        .filter((t) => t.done)
        .map((t) => t.text)
        .join(', ') || 'None';

    const prompt = buildPrompt({
      time: new Date().toLocaleTimeString(),
      sleepHours: sleep.actual,
      habitSummary,
      cpSummary,
      schedSummary,
      pendingTargets,
      doneTargets,
    });

    localStorage.setItem(RATE_KEY, String(Date.now()));
    const result = await getModel().generateContent(prompt);
    // Same response shape as the REST API, so the shared parser applies.
    return extractAdvice({ candidates: result.response.candidates });
  } catch (error) {
    console.error('Gemini API Error:', error.message);
    return `AI Advisor unavailable: ${error.message}`;
  }
}
