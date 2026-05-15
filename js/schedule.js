import { DAY_N, TYPES, getSlots, setSlots, buildHabits } from './data.js';
import { S } from './db.js';
import { renderHabits } from './habits.js';

export let curDay = 0;

export function setCurDay(v) { curDay = v; }

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
        tIn.placeholder = 'e.g. 3:30–6:00 AM';
        tIn.addEventListener('input', () => { slots[idx].time = tIn.value; syncSave(uid, slots); });
        
        const lIn = document.createElement('input');
        lIn.className = 'slot-input';
        lIn.value = s.label;
        lIn.placeholder = 'Activity name';
        lIn.addEventListener('input', () => { slots[idx].label = lIn.value; syncSave(uid, slots); });
        
        const sel = document.createElement('select');
        sel.className = 'slot-type';
        TYPES.forEach(t => { const o = document.createElement('option'); o.value = t.v; o.textContent = t.l; o.selected = s.type === t.v; sel.appendChild(o); });
        sel.addEventListener('change', () => { slots[idx].type = sel.value; row.className = 'slot-row' + (sel.value === 'habit' ? ' is-habit' : ''); syncSave(uid, slots); });
        
        const del = document.createElement('button');
        del.className = 'del-btn';
        del.textContent = '×';
        del.addEventListener('click', () => { slots.splice(idx, 1); syncSave(uid, slots); renderSched(uid); });
        
        row.append(tIn, lIn, sel, del);
        list.appendChild(row);
    });
    await renderSyncPreview(uid);
}

export async function syncSave(uid, slots) {
    S['sched:' + curDay] = slots;
    await setSlots(uid, curDay, slots);
    await renderSyncPreview(uid);
    await renderHabits(uid);
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
