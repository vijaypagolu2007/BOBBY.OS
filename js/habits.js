import { buildHabits, EXAM_D } from './data.js';
import { dbLoad, dbSave } from './db.js';
import { ck, iso, today, wkDates, wkKey, showToast } from './utils.js';
import { renderHeatmap } from './charts.js';

export let weekOff = 0;

export function setWeekOff(v) { weekOff = v; }

export async function toggle(uid, id, wk, di) {
    const k = ck(id, wk, di);
    const data = await dbLoad(uid, 'habits', {});
    data[k] = ((data[k] || 0) + 1) % 3;
    await dbSave(uid, 'habits', data);
    await renderHabits(uid);
}

export async function markHabitDoneToday(uid, id) {
    const dates = wkDates(0);
    const tStr = today();
    const di = dates.findIndex(d => iso(d) === tStr);
    if (di === -1) return;
    const wk = wkKey(0);
    const k = ck(id, wk, di);
    const data = await dbLoad(uid, 'habits', {});
    if (data[k] !== 1) {
        data[k] = 1;
        await dbSave(uid, 'habits', data);
        await renderHabits(uid);
    }
}

function getHabitVal(data, id, wk, di) { return (data[ck(id, wk, di)] || 0); }

function streak(data, id, wk) {
    let b = 0, c = 0;
    for (let i = 0; i < 7; i++) {
        if (getHabitVal(data, id, wk, i) === 1) {
            c++;
            b = Math.max(b, c);
        } else c = 0;
    }
    return b;
}

function grade(p) {
    if (p >= 95) return { g: 'S', c: '#6c63ff' };
    if (p >= 85) return { g: 'A', c: '#20d68a' };
    if (p >= 70) return { g: 'B', c: '#84cc16' };
    if (p >= 50) return { g: 'C', c: '#ffbe3d' };
    return { g: 'D', c: '#ff5572' };
}

export async function renderHabits(uid) {
    await renderHeatmap(uid);
    const H = await buildHabits(uid);
    const habitData = await dbLoad(uid, 'habits', {});
    const wk = wkKey(weekOff);
    const dates = wkDates(weekOff);
    const tStr = today();
    const fmt = d => `${d.toLocaleString('default', { month: 'short' })} ${d.getDate()}`;
    
    const rangeEl = document.getElementById('wk-range');
    if (rangeEl) rangeEl.textContent = `Week of ${fmt(dates[0])} – ${fmt(dates[6])}`;

    ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].forEach((n, i) => {
        const th = document.getElementById(`h${i}`);
        if (!th) return;
        const isT = iso(dates[i]) === tStr, isE = EXAM_D.has(iso(dates[i]));
        th.innerHTML = `<span style="${isT ? 'color:#6c63ff;font-weight:700' : isE ? 'color:#ff4466' : ''}">${n}<br><span style="font-size:8px;opacity:0.5">${dates[i].getDate()}</span>${isE ? '<br><span style="font-size:7px;color:#ff4466">📝</span>' : ''}</span>`;
    });

    const tbody = document.getElementById('tbody'); 
    if (!tbody) return;
    tbody.innerHTML = ''; let best = 0;
    
    H.forEach(h => {
        if (h.group) {
            const tr = document.createElement('tr');
            tr.className = 'group-row';
            const td = document.createElement('td');
            td.colSpan = 11;
            td.innerHTML = `<span class="gdot" style="background:${h.color}"></span>${h.label}`;
            tr.appendChild(td);
            tbody.appendChild(tr);
            return;
        }
        const tr = document.createElement('tr');
        tr.className = 'habit-row';
        const ti = document.createElement('td');
        ti.innerHTML = `<div class="habit-cell"><div class="hicon" style="background:${h.bg};color:${h.color}">${h.icon}</div><div><div class="hname">${h.name}</div><div class="htime">${h.time}</div><span class="htag tag-${h.tag}">${h.tagLabel}</span></div></div>`;
        tr.appendChild(ti);

        for (let i = 0; i < 7; i++) {
            const td = document.createElement('td');
            const isWE = i >= 5; td.className = 'dc' + (isWE ? ' we-col' : '');
            const avail = h.freq === 'all' || (h.freq === 'wd' && !isWE) || (h.freq === 'we' && isWE);
            const btn = document.createElement('button');
            const val = getHabitVal(habitData, h.id, wk, i);
            const isED = EXAM_D.has(iso(dates[i]));
            if (!avail) { btn.className = 'chk na'; btn.innerHTML = '·'; }
            else {
                btn.className = `chk${val === 1 ? ' done' : val === 2 ? ' skip' : ''}${isED && val === 0 ? ' exam-day' : ''}`;
                btn.innerHTML = val === 1 ? '✓' : val === 2 ? '✕' : '';
                btn.addEventListener('click', () => toggle(uid, h.id, wk, i));
            }
            td.appendChild(btn); tr.appendChild(td);
        }
        const s = streak(habitData, h.id, wk); best = Math.max(best, s);
        const ts = document.createElement('td'); ts.className = 'sc';
        ts.innerHTML = `<span class="strk${s >= 3 ? ' fire' : ''}">${s}${s >= 3 ? '🔥' : ''}</span>`;
        tr.appendChild(ts);

        const slots = h.freq === 'wd' ? 5 : h.freq === 'we' ? 2 : 7;
        let done = 0; for (let i = 0; i < 7; i++) if (getHabitVal(habitData, h.id, wk, i) === 1) done++;
        const pct = Math.round(done / slots * 100);
        const bc = pct >= 85 ? '#20d68a' : pct >= 60 ? '#6c63ff' : '#ffbe3d';
        const tp = document.createElement('td'); tp.className = 'pc';
        tp.innerHTML = `<div class="pct-wrap"><div class="pct-bg"><div class="pct-fill" style="width:${pct}%;background:${bc}"></div></div><span class="pct-n">${pct}%</span></div>`;
        tr.appendChild(tp); tbody.appendChild(tr);
    });

    const hArr = H.filter(h => !h.group);
    let tot = 0, done = 0;
    hArr.forEach(h => {
        const s = h.freq === 'wd' ? 5 : h.freq === 'we' ? 2 : 7;
        tot += s;
        for (let i = 0; i < 7; i++) if (getHabitVal(habitData, h.id, wk, i) === 1) done++;
    });
    const pct = tot ? Math.round(done / tot * 100) : 0;
    const { g, c } = grade(pct);
    
    const gradeEl = document.getElementById('s-grade');
    if (gradeEl) {
        gradeEl.textContent = `${g} (${pct})`;
        gradeEl.style.color = c;
    }
    const doneEl = document.getElementById('s-done');
    if (doneEl) doneEl.textContent = `${done}/${tot}`;
    
    const streakEl = document.getElementById('s-streak');
    if (streakEl) streakEl.textContent = `${best}${best >= 3 ? '🔥' : ''}`;
    
    const pctEl = document.getElementById('s-pct');
    if (pctEl) pctEl.textContent = `${pct}%`;

    // Weekly review (r1-r4 elements removed from HTML — guard null)
    const rv = await dbLoad(uid, `review:${wk}`, {});
    const saveRBtn = document.getElementById('save-r');
    if (saveRBtn) saveRBtn.onclick = () => saveReview(uid, wk);
    ['r1', 'r2', 'r3', 'r4'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = rv[id] || '';
    });
    const rRating = document.querySelectorAll('#r-rating .r-btn');
    if (rRating.length) {
        rRating.forEach(b => b.classList.toggle('on', parseInt(b.dataset.v) === rv.rating));
    }
}

async function saveReview(uid, wk) {
    const data = {
        r1: document.getElementById('r1')?.value || '',
        r2: document.getElementById('r2')?.value || '',
        r3: document.getElementById('r3')?.value || '',
        r4: document.getElementById('r4')?.value || '',
        rating: parseInt(document.querySelector('#r-rating .r-btn.on')?.dataset.v || 0)
    };
    await dbSave(uid, `review:${wk}`, data);
    
    // Also append to a master "notes" log
    const notesLog = await dbLoad(uid, 'notes:log', []);
    const entryExists = notesLog.find(n => n.wk === wk);
    if (!entryExists) {
        notesLog.unshift({ wk, date: today(), data });
    } else {
        entryExists.data = data;
        entryExists.date = today();
    }
    await dbSave(uid, 'notes:log', notesLog);
    
    showToast('Weekly Reflection Saved 📖');
}

// Only attach rating button listeners if the elements exist
const rBtns = document.querySelectorAll('#r-rating .r-btn');
if (rBtns.length) {
    rBtns.forEach(b => {
        b.addEventListener('click', (e) => {
            document.querySelectorAll('#r-rating .r-btn').forEach(btn => btn.classList.remove('on'));
            e.target.classList.add('on');
        });
    });
}
