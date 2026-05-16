import { dbLoad, dbSave, S } from './db.js';

// ══════════════════════════════════════════════════════
//  DATA & MODELS
// ══════════════════════════════════════════════════════

export const DAY_N = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
export const TYPES = [
    { v: 'habit', l: 'EVERYDAY (Habit)' },
    { v: 'college', l: 'MON - FRI (College)' },
    { v: 'weekend', l: 'SAT - SUN (Weekend)' },
    { v: 'sleep', l: 'SLEEP' },
    { v: 'break', l: 'BREAK' }
];

export const EXAM_D = new Set();

export const META = {
    cp: { icon: '⌨️', color: '#6c63ff', bg: 'rgba(108,99,255,0.13)' },
    fit: { icon: '💪', color: '#f472b6', bg: 'rgba(244,114,182,0.11)' },
    vocab: { icon: '📖', color: '#34d399', bg: 'rgba(52,211,153,0.10)' },
    subrev: { icon: '📝', color: '#fb923c', bg: 'rgba(251,146,60,0.10)' },
    plan: { icon: '🎯', color: '#22d3ee', bg: 'rgba(34,211,238,0.09)' },
    project: { icon: '🛠️', color: '#38bdf8', bg: 'rgba(56,189,248,0.10)' },
    oss: { icon: '🚀', color: '#ffbe3d', bg: 'rgba(255,190,61,0.10)' },
    course: { icon: '🎯', color: '#a78bfa', bg: 'rgba(167,139,250,0.10)' },
    dsa: { icon: '📐', color: '#818cf8', bg: 'rgba(129,140,248,0.11)' },
};

const WD = [
    { time: '3:30–6:00 AM', label: 'Competitive Programming', type: 'habit', id: 'cp' },
    { time: '6:00–6:40 AM', label: 'Fitness + Run', type: 'habit', id: 'fit' },
    { time: '6:40–7:00 AM', label: 'College Prep', type: 'break', id: '' },
    { time: '7:00–7:30 AM', label: 'Commute to College', type: 'college', id: '' },
    { time: '7:30–9:00 AM', label: 'Read Book + Vocab', type: 'habit', id: 'vocab' },
    { time: '9:00 AM–4:00 PM', label: 'College', type: 'college', id: '' },
    { time: '4:00–7:30 PM', label: 'Subjective Revision', type: 'habit', id: 'subrev' },
    { time: '7:30–8:30 PM', label: 'Lunch', type: 'break', id: '' },
    { time: '8:30–9:30 PM', label: 'Planning + Targets', type: 'habit', id: 'plan' },
    { time: '9:30 PM–3:30 AM', label: 'Sleep', type: 'sleep', id: '' },
];
const WE = [
    { time: '3:30–6:00 AM', label: 'Competitive Programming', type: 'habit', id: 'cp' },
    { time: '6:00–6:40 AM', label: 'Fitness + Run', type: 'habit', id: 'fit' },
    { time: '6:40–9:00 AM', label: 'Free / Rest', type: 'weekend', id: '' },
    { time: '9:00 AM–1:00 PM', label: 'Dev', type: 'habit', id: 'project' },
    { time: '1:00–2:00 PM', label: 'Lunch + Break', type: 'break', id: '' },
    { time: '2:00–5:00 PM', label: 'GitHub Profile Build', type: 'habit', id: 'oss' },
    { time: '5:00–7:30 PM', label: 'Codeforces & Leetcode', type: 'habit', id: 'course' },
    { time: '8:30–9:30 PM', label: 'Planning + Targets', type: 'habit', id: 'plan' },
    { time: '9:30 PM–3:30 AM', label: 'Sleep', type: 'sleep', id: '' },
];

export function getMeta(id) { return META[id] || { icon: '📌', color: '#6c63ff', bg: 'rgba(108,99,255,0.12)' }; }
export function defSlots(d) { return (d < 5 ? WD : WE).map(s => ({ ...s })); }

export async function setSlots(uid, d, arr) { await dbSave(uid, `sched:${d}`, arr); }

export async function getSlots(uid, d) {
    const cacheKey = 'sched:' + d;
    if (S[cacheKey] !== undefined && S[cacheKey] !== null) return S[cacheKey];
    const fromDB = await dbLoad(uid, cacheKey);
    const result = fromDB || defSlots(d);
    S[cacheKey] = result;
    return result;
}

export async function buildHabits(uid) {
    const seen = new Set(), habits = [];
    const ORDER = ['cp', 'dsa', 'fit', 'vocab', 'subrev', 'plan', 'project', 'oss', 'course'];
    
    // Pre-load all 7 days slots to avoid O(N^2) awaits
    const allSlots = await Promise.all(
        Array.from({ length: 7 }, (_, d) => getSlots(uid, d))
    );

    for (let d = 0; d < 7; d++) {
        const slots = allSlots[d];
        slots.filter(s => s.id).forEach(s => {
            if (!seen.has(s.id)) {
                seen.add(s.id);
                habits.push({ id: s.id, _time: s.time, _label: s.label, _day: d });
            }
        });
    }
    const full = habits.map(h => {
        let inWD = false, inWE = false;
        for (let dd = 0; dd < 7; dd++) { 
            const sl = allSlots[dd];
            if (sl.some(ss => ss.id === h.id)) { 
                if (dd < 5) inWD = true; else inWE = true; 
            } 
        }
        const freq = inWD && inWE ? 'all' : inWD ? 'wd' : 'we';
        const m = getMeta(h.id);
        return {
            id: h.id, icon: m.icon, name: h._label, time: h._time, freq, color: m.color, bg: m.bg,
            tag: freq, tagLabel: freq === 'wd' ? 'mon–fri' : freq === 'we' ? 'weekends' : 'every day'
        };
    });
    const sorted = ORDER.map(id => full.find(h => h.id === id)).filter(Boolean);
    const rest = full.filter(h => !ORDER.includes(h.id));
    const all = [...sorted, ...rest];
    const wdH = all.filter(h => h.freq !== 'we');
    const weH = all.filter(h => h.freq === 'we');
    const result = [];
    if (wdH.length) { result.push({ group: true, label: 'Weekday Habits · Mon–Fri', color: '#6c63ff' }); result.push(...wdH); }
    if (weH.length) { result.push({ group: true, label: 'Weekend · Sat & Sun', color: '#ffbe3d' }); result.push(...weH); }
    return result;
}
