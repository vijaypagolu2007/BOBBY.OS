import { DAY_N, TYPES, getSlots, setSlots, buildHabits } from './data.js';
import { S } from './db.js';
import { renderHabits } from './habits.js';

export let curDay = 0;
export function setCurDay(v) { curDay = v; }

// Debounce timer to avoid re-rendering on every keypress
let saveTimer = null;
function debouncedSave(uid, slots) {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => syncSave(uid, slots), 500);
}

export async function renderSched(uid) {
    document.querySelectorAll('.day-tab').forEach(t => t.classList.toggle('active', parseInt(t.dataset.day) === curDay));
    const titleEl = document.getElementById('ed-title');
    if (titleEl) titleEl.textContent = DAY_N[curDay];

    const subEl = document.getElementById('ed-sub');
    if (subEl) subEl.textContent = curDay >= 5 ? 'Weekend — fully free' : 'Weekday schedule';

    const list = document.getElementById('slots-list');
    if (!list) return;
    list.innerHTML = '';

    const slots = await getSlots(uid, curDay);

    slots.forEach((s, idx) => {
        const row = document.createElement('div');
        row.className = 'slot-row' + (s.type === 'habit' ? ' is-habit' : '');

        const tIn = document.createElement('input');
        tIn.className = 'slot-input t-input';
        tIn.value = s.time;
        tIn.placeholder = 'e.g. 6:00–7:00 AM';
        // FIX: Use 'change' instead of 'input' to avoid re-render on every keystroke
        tIn.addEventListener('change', () => { slots[idx].time = tIn.value; syncSave(uid, slots); });

        const lIn = document.createElement('input');
        lIn.className = 'slot-input';
        lIn.value = s.label;
        lIn.placeholder = 'Activity name';
        lIn.addEventListener('change', () => { 
            slots[idx].label = lIn.value; 
            if (slots[idx].type === 'habit' && !slots[idx].id) {
                slots[idx].id = lIn.value.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'act';
            }
            syncSave(uid, slots); 
        });

        const sel = document.createElement('select');
        sel.className = 'slot-type';
        TYPES.forEach(t => {
            const o = document.createElement('option');
            o.value = t.v; o.textContent = t.l; o.selected = s.type === t.v;
            sel.appendChild(o);
        });
        sel.addEventListener('change', () => {
            slots[idx].type = sel.value;
            if (sel.value === 'habit' && !slots[idx].id) {
                slots[idx].id = (slots[idx].label || 'habit').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'act';
            }
            row.className = 'slot-row' + (sel.value === 'habit' ? ' is-habit' : '');
            syncSave(uid, slots);
        });

        const del = document.createElement('button');
        del.className = 'del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => { slots.splice(idx, 1); syncSave(uid, slots); renderSched(uid); });

        row.append(tIn, lIn, sel, del);
        list.appendChild(row);
    });

    renderNLPBar(uid, slots);
    await renderSyncPreview(uid);
}

/** Render the NLP "Smart Add" bar below the slot list */
function renderNLPBar(uid, slots) {
    // Avoid duplicate bars
    let wrap = document.getElementById('nlp-add-bar');
    if (wrap) return;

    const container = document.getElementById('slots-list')?.parentElement;
    if (!container) return;

    wrap = document.createElement('div');
    wrap.id = 'nlp-add-bar';
    wrap.className = 'nlp-bar-container';
    wrap.innerHTML = `
        <input id="nlp-input" type="text"
            placeholder="e.g. Gym at 6:00 to 7:00 morning or Read book 9-10 PM"
            style="flex:1; background:var(--surface); border:1px solid var(--border-hi); border-radius:8px; padding:10px 14px; color:var(--text); font-size:12px; outline:none; font-family:var(--mono);">
        <button id="nlp-add-btn" style="background:var(--accent); border:none; border-radius:8px; color:#fff; padding:10px 16px; cursor:pointer; font-size:12px; white-space:nowrap;">✨ Smart Add</button>
    `;
    container.appendChild(wrap);

    const input = wrap.querySelector('#nlp-input');
    const btn = wrap.querySelector('#nlp-add-btn');

    const doAdd = async () => {
        const text = input.value.trim();
        if (!text) { input.focus(); return; }
        const parsed = parseNLP(text);
        slots.push(parsed);
        await syncSave(uid, slots);
        await renderSched(uid);
        // Re-focus the input after re-render
        const newInput = document.getElementById('nlp-input');
        if (newInput) { newInput.value = ''; newInput.focus(); }
    };

    btn.addEventListener('click', doAdd);
    input.addEventListener('keydown', e => { if (e.key === 'Enter') doAdd(); });
}

/**
 * NLP parser: converts natural language to a slot object.
 * Examples:
 *   "Gym at 6 to 7 AM"
 *   "Read book 9:00-10:00 PM"
 *   "Morning run 5:30 to 6 AM"
 */
function parseNLP(text) {
    // Time range patterns
    const rangePatterns = [
        /(\d{1,2}(?::\d{2})?)\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm|morning|evening|night|noon)?/i,
        /at\s+(\d{1,2}(?::\d{2})?)\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm|morning|evening|night|noon)?/i,
    ];

    let time = '';
    let label = text;

    for (const pattern of rangePatterns) {
        const m = text.match(pattern);
        if (m) {
            let [full, start, end, period] = m;
            period = period || '';

            // Resolve AM/PM from context words
            const periodLC = period.toLowerCase();
            const suffix = ['evening', 'night', 'pm'].includes(periodLC) ? 'PM'
                : ['morning', 'am'].includes(periodLC) ? 'AM'
                : text.toLowerCase().includes('morning') || text.toLowerCase().includes('am') ? 'AM'
                : text.toLowerCase().includes('evening') || text.toLowerCase().includes('night') || text.toLowerCase().includes('pm') ? 'PM'
                : 'AM';

            const fmtTime = (t) => {
                if (!t.includes(':')) t += ':00';
                return t;
            };

            time = `${fmtTime(start)}–${fmtTime(end)} ${suffix}`;
            // Remove the time portion from label
            label = text.replace(full, '').replace(/\bat\b/i, '').replace(/\s+/g, ' ').trim();
            break;
        }
    }

    // Determine type from keywords
    const lc = label.toLowerCase();
    let type = 'habit';
    if (/sleep|rest|nap/.test(lc)) type = 'sleep';
    else if (/break|lunch|dinner|eat|food/.test(lc)) type = 'break';
    else if (/college|class|lecture|lab/.test(lc)) type = 'college';
    else if (/free|relax|leisure/.test(lc)) type = 'free';

    // Auto-generate a simple id from the label
    const id = label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'custom';

    return { time, label: label || 'New Activity', type, id };
}

export async function syncSave(uid, slots) {
    S['sched:' + curDay] = slots;
    await setSlots(uid, curDay, slots);
    await renderSyncPreview(uid);
    // Sync habits page in background
    renderHabits(uid).catch(() => {});
}

export async function renderSyncPreview(uid) {
    const H = await buildHabits(uid);
    const wrap = document.getElementById('sync-wrap');
    if (!wrap) return;
    wrap.innerHTML = '';

    H.filter(h => !h.group).forEach(h => {
        const card = document.createElement('div'); card.className = 'sync-card';
        const tgC = h.freq === 'wd' ? 'rgba(108,99,255,0.13)' : h.freq === 'we' ? 'rgba(255,190,61,0.13)' : 'rgba(32,214,138,0.1)';
        const tgX = h.freq === 'wd' ? '#6c63ff' : h.freq === 'we' ? '#ffbe3d' : '#20d68a';
        const tgL = h.freq === 'wd' ? 'Mon–Fri' : h.freq === 'we' ? 'Weekends' : 'Every day';
        card.innerHTML = `<div class="sc-icon">${h.icon}</div><div class="sc-name">${h.name}</div><div class="sc-time">${h.time}</div><span class="sc-freq" style="background:${tgC};color:${tgX}">${tgL}</span>`;
        wrap.appendChild(card);
    });
}
