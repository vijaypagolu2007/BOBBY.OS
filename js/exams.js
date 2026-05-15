import { dbLoad, dbSave } from './db.js';
import { iso, today, showToast } from './utils.js';

export const EXAMS = [
    { date: '2026-05-05', day: 'Tuesday', num: '05', month: 'May', papers: [{ code: 'EM-4', name: 'Engineering Mathematics IV', slot: 'S1', time: '9:00–10:00 AM' }, { code: 'ALC', name: 'Automata & Language Theory', slot: 'S2', time: '10:00–11:00 AM' }] },
    { date: '2026-05-06', day: 'Wednesday', num: '06', month: 'May', papers: [{ code: 'DAA', name: 'Design & Analysis of Algorithms', slot: 'S1', time: '9:00–10:00 AM' }, { code: 'OS', name: 'Operating Systems', slot: 'S2', time: '11:00–12:00 PM' }] },
    { date: '2026-05-07', day: 'Thursday', num: '07', month: 'May', papers: [{ code: 'MEA', name: 'Managerial Economics & Accountancy', slot: 'S1', time: '11:00–12:00 PM' }, { code: 'SS', name: 'Signals & Systems', slot: 'S2', time: '12:00–1:00 PM' }] },
    { date: '2026-05-08', day: 'Friday', num: '08', month: 'May', papers: [{ code: 'DAR', name: 'Data Analytics using R', slot: 'S1', time: '9:00–10:00 AM' }] },
];

export const PRESET_PLANS = {
    '2026-05-02': [{ t: '3:30–6:00 AM', d: 'CP — last free morning before CT2 prep', tag: 'cp' }, { t: '4:00–5:45 PM', d: 'DAR — R programming, data models, visualization', tag: 'rev' }, { t: '5:45–7:30 PM', d: 'SS — Fourier, Laplace, Z-transform, convolution', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Plan the weekend. List weak topics.', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP', tag: 'rest' }],
    '2026-05-03': [{ t: '3:30–5:30 AM', d: 'MEA — economics concepts, cost theory', tag: 'rev' }, { t: '5:30–7:30 AM', d: 'DAA — greedy, DP, graph algos, complexity', tag: 'rev' }, { t: '9:00–11:00 AM', d: 'OS — scheduling, memory, paging, deadlocks', tag: 'rev' }, { t: '2:00–4:00 PM', d: 'DAA — second pass: PYQs', tag: 'rev' }, { t: '4:00–5:30 PM', d: 'OS — second pass: weak areas', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Plan Sunday. List EM-4 + ALC weak topics.', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP', tag: 'rest' }],
    '2026-05-04': [{ t: '3:30–5:30 AM', d: 'EM-4 — integrals, DEs, series, transforms', tag: 'rev' }, { t: '5:30–7:30 AM', d: 'ALC — NFA→DFA, CFG, PDA, pumping lemma', tag: 'rev' }, { t: '9:00–11:00 AM', d: 'EM-4 — second pass: PYQs, formula sheet', tag: 'rev' }, { t: '11 AM–1:00 PM', d: 'ALC — second pass: closure properties', tag: 'rev' }, { t: '2:00–4:00 PM', d: 'SS + DAR — rapid formula sweep', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Final plan. Pack notes. Tue: EM-4 (9AM) + ALC (10AM).', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP — wake 3:30 AM. CT2 starts tomorrow.', tag: 'rest', warn: true }],
    '2026-05-05': [{ t: '3:30–5:00 AM', d: 'EM-4 — final: formulae, integrals', tag: 'rev' }, { t: '5:00–6:00 AM', d: 'ALC — quick scan: NFA, CFG, pumping lemma', tag: 'rev' }, { t: '9:00–10:00 AM', d: '📝 CT2: EM-4', tag: 'exam', warn: true }, { t: '10:00–11:00 AM', d: '📝 CT2: ALC', tag: 'exam', warn: true }, { t: '11 AM–2:00 PM', d: 'REST — two back-to-back done. Nap.', tag: 'rest' }, { t: '4:00–6:00 PM', d: 'DAA revision — greedy, DP, graphs', tag: 'rev' }, { t: '6:00–7:30 PM', d: 'OS revision — scheduling, memory', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Plan Wed: DAA (9AM) + OS (11AM).', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP', tag: 'rest' }],
    '2026-05-06': [{ t: '3:30–5:00 AM', d: 'DAA — final: recurrences, Master theorem', tag: 'rev' }, { t: '5:00–6:00 AM', d: 'OS — quick scan: process sync, paging', tag: 'rev' }, { t: '9:00–10:00 AM', d: '📝 CT2: DAA', tag: 'exam', warn: true }, { t: '11:00 AM–12:00 PM', d: '📝 CT2: OS', tag: 'exam', warn: true }, { t: '12:00–2:00 PM', d: 'REST', tag: 'rest' }, { t: '4:00–6:00 PM', d: 'MEA revision — economics, accounting', tag: 'rev' }, { t: '6:00–7:30 PM', d: 'SS revision — Fourier, Laplace', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Plan Thu: MEA (11AM) + SS (12PM).', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP', tag: 'rest' }],
    '2026-05-07': [{ t: '3:30–5:00 AM', d: 'MEA — final: theories, accounting statements', tag: 'rev' }, { t: '5:00–6:00 AM', d: 'SS — transform pairs, stability', tag: 'rev' }, { t: '11:00 AM–12:00 PM', d: '📝 CT2: MEA', tag: 'exam', warn: true }, { t: '12:00–1:00 PM', d: '📝 CT2: SS', tag: 'exam', warn: true }, { t: '2:00–4:00 PM', d: 'REST', tag: 'rest' }, { t: '4:00–7:30 PM', d: 'DAR — R programming, models, visualization', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Final plan. Fri: DAR (9AM). Last test.', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP — last CT2 test tomorrow', tag: 'rest' }],
    '2026-05-08': [{ t: '3:30–5:30 AM', d: 'DAR — final: R syntax, data models', tag: 'rev' }, { t: '9:00–10:00 AM', d: '📝 CT2: DAR — LAST ONE!', tag: 'exam', warn: true }, { t: '10:00 AM onwards', d: '🎉 CT2 DONE! Marks submission: 14th May.', tag: 'rest' }, { t: 'From 9 May', d: 'Resume CP at 3:30 AM. SEE on 15 Jun.', tag: 'cp' }],
    '__post__': [{ t: '3:30–6:00 AM', d: 'CP / DSA — back to grind', tag: 'cp' }, { t: '4:00–7:30 PM', d: 'Subjective revision + SEE prep', tag: 'rev' }, { t: '8:30–9:30 PM', d: 'Planning + Targets', tag: 'plan' }, { t: '9:30 PM →', d: 'SLEEP', tag: 'rest' }],
};

export const PC = { rev: 'ptag-rev', exam: 'ptag-exam', cp: 'ptag-cp', rest: 'ptag-rest', plan: 'ptag-plan', custom: 'ptag-custom' };
export const PL = { rev: 'Revision', exam: 'CT2', cp: 'CP', rest: 'Rest', plan: 'Plan', custom: 'Custom' };

export let planDayOffset = 0;

export function setPlanDayOffset(v) { planDayOffset = v; }

export function getPlanDate() {
    const d = new Date();
    d.setDate(d.getDate() + planDayOffset);
    return iso(d);
}

export async function getCustomPlanRows(uid, dateStr) {
    return await dbLoad(uid, `examplan:${dateStr}`, []);
}
export async function saveCustomPlanRows(uid, dateStr, rows) {
    await dbSave(uid, `examplan:${dateStr}`, rows);
}

export async function renderExam(uid) {
    const t = today();
    const now = new Date();
    const FD = '2026-05-05', LD = '2026-05-08', TOTAL = 7;

    const cdDays = document.getElementById('cd-days');
    const cdLbl = document.getElementById('cd-lbl');
    if (!cdDays || !cdLbl) return;

    if (t > LD) { cdDays.textContent = '🎉'; cdLbl.textContent = 'CT2 done!'; }
    else if (t >= FD) { const r = EXAMS.filter(e => e.date >= t).length; cdDays.textContent = r; cdLbl.textContent = r === 1 ? 'day left' : 'days left'; }
    else { const diff = Math.round((new Date(FD + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5); cdDays.textContent = diff <= 0 ? '0' : diff; cdLbl.textContent = diff <= 1 ? 'day to go' : 'days to go'; }

    let dp = 0; EXAMS.forEach(ex => ex.papers.forEach((p, pi) => { const eH = p.slot === 'S1' ? 10 : 13; if (now > new Date(ex.date + 'T' + eH + ':00:00')) dp++; }));
    
    const fillEl = document.getElementById('epb-fill');
    if (fillEl) fillEl.style.width = `${Math.round(dp / TOTAL * 100)}%`;
    
    const epbLabel = document.getElementById('epb-label');
    if (epbLabel) epbLabel.textContent = `${dp} / ${TOTAL} done`;
    
    const badgeEl = document.getElementById('exam-badge');
    if (badgeEl) badgeEl.textContent = Math.max(0, TOTAL - dp);

    const grid = document.getElementById('days-grid'); 
    if (!grid) return;
    grid.innerHTML = '';
    EXAMS.forEach(ex => {
        const past = ex.date < t, isT = ex.date === t, allDone = past || (isT && now.getHours() >= 14);
        const card = document.createElement('div'); card.className = `ecard${isT ? ' etoday' : ''}${past ? ' epast' : ''}`;
        let h = `<div class="ecard-hdr"><div class="day-big${isT ? ' red' : ''}">${ex.num}</div><div class="ecard-meta"><div class="ecard-day">${ex.day}</div><div class="ecard-date">${ex.month} 2026</div></div><div class="ecnt">${ex.papers.length} paper${ex.papers.length > 1 ? 's' : ''}</div></div>`;
        if (isT) h += `<div class="today-pill">TODAY</div>`;
        h += `<div class="exams-list">`;
        ex.papers.forEach((p, pi) => { h += `<div class="exam-row ${pi === 0 ? 'es1' : 'es2'}"><span class="eslot ${pi === 0 ? 'sr' : 'sa'}">${p.time.split('–')[0]}</span><div class="exam-detail"><div class="ecode">${p.code}</div><div class="ename">${p.name}</div></div><div class="etime">${p.time}</div></div>`; });
        h += `</div>`; if (allDone) h += `<div class="done-bar"><span>✓ DONE</span></div>`;
        card.innerHTML = h; grid.appendChild(card);
    });

    await renderPlanForDate(uid);
}

export async function renderPlanForDate(uid) {
    const t = today();
    const FD = '2026-05-05', LD = '2026-05-08';
    const pd = getPlanDate();

    const navDate = new Date(pd + 'T00:00:00');
    const isToday = pd === t;
    const navDateEl = document.getElementById('plan-nav-date');
    if (navDateEl) navDateEl.textContent = isToday ? 'Today' : navDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    const PLAN_TITLES = {
        '2026-05-02': 'Friday — Begin CT2 Prep',
        '2026-05-03': 'Saturday — Full Day Revision',
        '2026-05-04': 'Sunday — Final Pass Before CT2',
        '__post__': 'Post-CT2 — Back to Grind',
    };

    let presetKey = pd;
    if (!PRESET_PLANS[pd]) {
        if (pd > LD) presetKey = '__post__';
        else {
            const allDates = Object.keys(PRESET_PLANS).filter(k => k !== '__post__').sort();
            const past = [...allDates].reverse().find(d => d <= pd);
            const future = allDates.find(d => d > pd);
            presetKey = past || future || FD;
        }
    }

    const ex = EXAMS.find(e => e.date === pd);
    const title = ex ? `${ex.day} — ${ex.papers.map(p => p.code).join(' + ')}` : (PLAN_TITLES[presetKey] || `Plan for ${navDate.toLocaleDateString('en-IN', { weekday: 'long' })}`);
    
    const planTitleEl = document.getElementById('plan-title');
    if (planTitleEl) planTitleEl.textContent = title;
    
    const planDateEl = document.getElementById('plan-date');
    if (planDateEl) planDateEl.textContent = pd === '__post__' ? 'Post-exam mode' : navDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    
    const planLblEl = document.getElementById('plan-lbl');
    if (planLblEl) planLblEl.textContent = isToday ? "Today's Plan" : 'Plan for ' + navDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    const presetRows = PRESET_PLANS[presetKey] || [];
    const customRows = await getCustomPlanRows(uid, pd);
    const rows = document.getElementById('plan-rows');
    if (!rows) return;
    rows.innerHTML = '';

    if (presetRows.length === 0 && customRows.length === 0) {
        rows.innerHTML = `<div class="plan-empty"><strong>📋</strong>No preset plan for this day.<br>Add your own tasks below.</div>`;
    }

    presetRows.forEach(p => {
        const d = document.createElement('div');
        d.className = `plan-row${p.warn ? ' warn' : ''}`;
        d.innerHTML = `<span class="ptime">${p.t}</span><span class="pdesc">${p.d}<span class="ptag ${PC[p.tag] || 'ptag-rev'}">${PL[p.tag] || p.tag}</span></span><span></span><span></span>`;
        rows.appendChild(d);
    });

    customRows.forEach((p, idx) => {
        const d = document.createElement('div');
        d.className = 'plan-row custom-row';
        const timeIn = document.createElement('input'); timeIn.className = 'plan-input pi-time'; timeIn.value = p.t; timeIn.placeholder = 'Time';
        timeIn.addEventListener('change', async () => { customRows[idx].t = timeIn.value; await saveCustomPlanRows(uid, pd, customRows); });
        const descIn = document.createElement('input'); descIn.className = 'plan-input'; descIn.value = p.d; descIn.placeholder = 'Task description';
        descIn.addEventListener('change', async () => { customRows[idx].d = descIn.value; await saveCustomPlanRows(uid, pd, customRows); });
        const tagSel = document.createElement('select'); tagSel.className = 'plan-tag-sel';
        ['custom', 'rev', 'exam', 'cp', 'rest', 'plan'].forEach(tv => { const o = document.createElement('option'); o.value = tv; o.textContent = PL[tv] || tv; if (tv === p.tag) o.selected = true; tagSel.appendChild(o); });
        tagSel.addEventListener('change', async () => { customRows[idx].tag = tagSel.value; await saveCustomPlanRows(uid, pd, customRows); await renderPlanForDate(uid); });
        const delBtn = document.createElement('button'); delBtn.className = 'plan-del'; delBtn.innerHTML = '×';
        delBtn.addEventListener('click', async () => { customRows.splice(idx, 1); await saveCustomPlanRows(uid, pd, customRows); await renderPlanForDate(uid); });
        d.append(timeIn, descIn, tagSel, delBtn); rows.appendChild(d);
    });
}

export async function addPlanRow(uid) {
    const pd = getPlanDate();
    const timeIn = document.getElementById('np-time');
    const descIn = document.getElementById('np-desc');
    const tagIn = document.getElementById('np-tag');
    if (!descIn) return;
    
    const time = timeIn.value.trim();
    const desc = descIn.value.trim();
    const tag = tagIn.value;
    if (!desc) { descIn.focus(); return; }
    const customRows = await getCustomPlanRows(uid, pd);
    customRows.push({ t: time || '—', d: desc, tag, custom: true });
    await saveCustomPlanRows(uid, pd, customRows);
    timeIn.value = '';
    descIn.value = '';
    tagIn.value = 'custom';
    await renderPlanForDate(uid);
    showToast('Plan added ✓');
}
