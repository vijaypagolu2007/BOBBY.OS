import { dbLoad, dbSave } from './db.js';
import { iso, today, showToast } from './utils.js';

export let EXAMS = [];

export const PRESET_PLANS = {};

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
    if (EXAMS.length === 0) {
        const saved = await dbLoad(uid, 'exams:list', []);
        if (saved.length > 0) EXAMS = saved;
    }

    const t = today();
    const now = new Date();
    
    const FD = EXAMS.length > 0 ? EXAMS[0].date : t;
    const LD = EXAMS.length > 0 ? EXAMS[EXAMS.length - 1].date : t;
    const TOTAL = EXAMS.length > 0 ? EXAMS.reduce((acc, curr) => acc + curr.papers.length, 0) : 0;

    const cdDays = document.getElementById('cd-days');
    const cdLbl = document.getElementById('cd-lbl');
    if (!cdDays || !cdLbl) return;

    if (TOTAL === 0) {
        cdDays.textContent = '-'; cdLbl.textContent = 'No exams scheduled';
    } else if (t > LD) { 
        cdDays.textContent = '🎉'; cdLbl.textContent = 'Exams done!'; 
    } else if (t >= FD) { 
        const r = EXAMS.filter(e => e.date >= t).length; 
        cdDays.textContent = r; cdLbl.textContent = r === 1 ? 'day left' : 'days left'; 
    } else { 
        const diff = Math.round((new Date(FD + 'T00:00:00') - new Date(t + 'T00:00:00')) / 864e5); 
        cdDays.textContent = diff <= 0 ? '0' : diff; cdLbl.textContent = diff <= 1 ? 'day to go' : 'days to go'; 
    }

    let dp = 0; EXAMS.forEach(ex => ex.papers.forEach((p, pi) => { const eH = p.slot === 'S1' ? 10 : 13; if (now > new Date(ex.date + 'T' + eH + ':00:00')) dp++; }));
    
    const fillEl = document.getElementById('epb-fill');
    if (fillEl) fillEl.style.width = TOTAL === 0 ? '0%' : `${Math.round(dp / TOTAL * 100)}%`;
    
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
    setupCT2Tracker(uid);
}

export function getExamCountdown() {
    if (EXAMS.length === 0) return null;
    const t = today();
    const now = new Date();
    
    // Find the next upcoming exam date (not past)
    const upcoming = EXAMS.find(e => e.date >= t);
    if (!upcoming) return { done: true };

    const firstDate = new Date(upcoming.date + 'T00:00:00');
    const todayDate = new Date(t + 'T00:00:00');
    const diffMs = firstDate - todayDate;
    const diffDays = Math.floor(diffMs / 864e5);
    
    // Progress calculation
    const totalPapers = EXAMS.reduce((acc, curr) => acc + curr.papers.length, 0);
    let donePapers = 0;
    EXAMS.forEach(ex => ex.papers.forEach(p => {
        const h = p.slot === 'S1' ? 12 : 16;
        if (new Date() > new Date(ex.date + 'T' + h + ':00:00')) donePapers++;
    }));

    return {
        days: diffDays,
        hours: 23 - now.getHours(),
        mins: 59 - now.getMinutes(),
        intensity: totalPapers === 0 ? 0 : Math.round((donePapers / totalPapers) * 100),
        total: totalPapers,
        done: donePapers
    };
}

export async function renderPlanForDate(uid) {
    const t = today();
    const pd = getPlanDate();
    const navDate = new Date(pd + 'T00:00:00');
    const isToday = pd === t;
    const navDateEl = document.getElementById('plan-nav-date');
    if (navDateEl) navDateEl.textContent = isToday ? 'Today' : navDate.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });

    const ex = EXAMS.find(e => e.date === pd);
    const title = ex ? `${ex.day} — ${ex.papers.map(p => p.code).join(' + ')}` : `Plan for ${navDate.toLocaleDateString('en-IN', { weekday: 'long' })}`;
    
    const planTitleEl = document.getElementById('plan-title');
    if (planTitleEl) planTitleEl.textContent = title;
    
    const planDateEl = document.getElementById('plan-date');
    if (planDateEl) planDateEl.textContent = navDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' });
    
    const planLblEl = document.getElementById('plan-lbl');
    if (planLblEl) planLblEl.textContent = isToday ? "Today's Plan" : 'Plan for ' + navDate.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    const customRows = await getCustomPlanRows(uid, pd);
    const rows = document.getElementById('plan-rows');
    if (!rows) return;
    rows.innerHTML = '';

    if (customRows.length === 0) {
        rows.innerHTML = `<div class="plan-empty"><strong>📋</strong>No study plan for this day.<br>Sync with AI above or add tasks below.</div>`;
    }

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

export function setupAITimetable(uid) {
    const btn = document.getElementById('ai-refine-btn');
    const timetableInput = document.getElementById('ai-timetable-input');
    const syllabusInput = document.getElementById('ai-syllabus-input');
    const fileInput = document.getElementById('ai-timetable-upload');

    if (!btn) return;

    if (fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file && timetableInput) {
                timetableInput.placeholder = `📎 File attached: ${file.name}\n\nOptionally add extra notes here...`;
                showToast(`Attached: ${file.name}`);
            }
        });
    }

    btn.onclick = async () => {
        const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
        const hasFile = fileInput && fileInput.files.length > 0;
        const ttText = timetableInput?.value.trim() || '';
        const sylText = syllabusInput?.value.trim() || '';

        if (!hasFile && !ttText && !sylText) {
            showToast('Please provide a timetable or syllabus!');
            return;
        }
        if (!apiKey) {
            showToast('No VITE_GEMINI_API_KEY set in .env!');
            return;
        }

        btn.textContent = '⏳ Analyzing with Gemini AI...';
        btn.disabled = true;

        try {
            let requestBody;
            const combinedContext = `USER_INSTRUCTIONS/TIMETABLE:\n${ttText}\n\nSYLLABUS_PORTIONS:\n${sylText}`;

            if (hasFile) {
                const file = fileInput.files[0];
                const base64Data = await fileToBase64(file);
                const mimeType = file.type || 'image/jpeg';
                requestBody = buildVisionRequest(base64Data, mimeType, combinedContext);
            } else {
                requestBody = buildTextRequest(combinedContext);
            }

            const fetchWithRetry = async (retries = 2) => {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 45000);
                try {
                    const response = await fetch(
                        `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
                        {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(requestBody),
                            signal: controller.signal
                        }
                    );
                    clearTimeout(timeoutId);
                    if (response.status === 429 && retries > 0) {
                        showToast(`Quota hit. Retrying in 10s...`);
                        await new Promise(r => setTimeout(r, 10000));
                        return fetchWithRetry(retries - 1);
                    }
                    return response;
                } catch (e) {
                    clearTimeout(timeoutId);
                    if (e.name === 'AbortError' && retries > 0) return fetchWithRetry(retries - 1);
                    throw e;
                }
            };

            const response = await fetchWithRetry();

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error?.message || `API Error ${response.status}`);
            }

            const data = await response.json();
            const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
            const parsed = extractJsonFromText(rawText);

            if (!parsed) {
                showToast('AI could not parse data. Ensure image is clear.');
                return;
            }

            if (Array.isArray(parsed.exams) && parsed.exams.length > 0) {
                EXAMS = parsed.exams.map(ex => {
                    const d = new Date(ex.date + 'T00:00:00');
                    return {
                        date: ex.date,
                        day: d.toLocaleDateString('en-IN', { weekday: 'long' }),
                        num: d.getDate().toString().padStart(2, '0'),
                        month: d.toLocaleString('default', { month: 'short' }),
                        papers: (ex.papers || []).map(p => ({
                            code: p.code || 'EXAM',
                            name: p.name || 'Subject',
                            slot: p.slot || 'S1',
                            time: p.time || '10:00–12:00'
                        }))
                    };
                }).sort((a, b) => a.date.localeCompare(b.date));
                await dbSave(uid, 'exams:list', EXAMS);
            }

            if (Array.isArray(parsed.plans)) {
                for (const p of parsed.plans) {
                    if (p.date && Array.isArray(p.tasks)) {
                        const rows = p.tasks.map(t => ({
                            t: t.time || '—',
                            d: t.desc || t.task || 'Study session',
                            tag: t.tag || 'rev'
                        }));
                        await saveCustomPlanRows(uid, p.date, rows);
                    }
                }
            } else if (sylText && parsed.exams && parsed.exams.length === 0) {
                showToast('Timetable dates not found, but syllabus plan generated!');
            }

            await renderExam(uid);
            showToast(`✅ Dashboard updated!`);

            if (timetableInput) timetableInput.value = '';
            if (syllabusInput) syllabusInput.value = '';
            if (fileInput) fileInput.value = '';

        } catch (err) {
            console.error('AI Sync Error:', err);
            showToast(`Error: ${err.message}`);
        } finally {
            btn.textContent = '✨ Refine Exam Dashboard';
            btn.disabled = false;
        }
    };
}

function fileToBase64(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result.split(',')[1]);
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}

function buildVisionRequest(base64Data, mimeType, extraText) {
    const prompt = buildExtractionPrompt(extraText);
    return {
        contents: [{
            parts: [
                { text: prompt },
                { inline_data: { mime_type: mimeType, data: base64Data } }
            ]
        }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 3000 }
    };
}

function buildTextRequest(text) {
    const prompt = buildExtractionPrompt(text);
    return {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 3000 }
    };
}

function buildExtractionPrompt(extraContext) {
    const todayStr = today();
    const currentYear = new Date().getFullYear();
    return `You are BOBBY.OS, an elite academic scheduler.
Your goal is to extract exam dates AND generate a detailed study plan.

IMPORTANT: FOLLOW USER INSTRUCTIONS FIRST.
User Instructions / Timetable Info:
${extraContext}

Return ONLY valid JSON:
{
  "exams": [
    {
      "date": "YYYY-MM-DD",
      "papers": [
        { "code": "SUBJ_CODE", "name": "Subject Name", "slot": "S1/S2", "time": "HH:MM–HH:MM" }
      ]
    }
  ],
  "plans": [
    {
      "date": "YYYY-MM-DD",
      "tasks": [
        { "time": "08:00 AM", "desc": "Step-by-step revision task", "tag": "rev" }
      ]
    }
  ]
}

SPECIFIC RULES:
1. If the user says "ONLY INCLUDE CSE", filter the timetable to ONLY include CSE subjects.
2. If syllabus is provided but no dates found, generate a 3-day plan starting from TODAY (${todayStr}).
3. "tag" must be: "rev", "exam", "cp", "rest", "plan", or "custom".
4. For "OS LAB", tasks should be like "Practice shell programming", "Review filter commands".
5. Use ${currentYear} for the year.`;
}

function extractJsonFromText(text) {
    try {
        return JSON.parse(text);
    } catch {
        const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (match) {
            try { return JSON.parse(match[1].trim()); } catch { }
        }
        const start = text.indexOf('{');
        const end = text.lastIndexOf('}');
        if (start !== -1 && end !== -1) {
            try { return JSON.parse(text.slice(start, end + 1)); } catch { }
        }
        return null;
    }
}

async function setupCT2Tracker(uid) {
    const tbody = document.getElementById('ct2-tbody');
    const addBtn = document.getElementById('add-ct2-btn');
    if (!tbody || !addBtn) return;

    // We only attach the event listener once, avoiding duplicates if setupCT2Tracker is called multiple times.
    if (!addBtn.dataset.init) {
        addBtn.dataset.init = '1';
        addBtn.onclick = async () => {
            const scores = await dbLoad(uid, 'exam:ct_scores', []);
            scores.push({ sub: 'New Subject', ct1: 0, ct2: 0, see: 0 });
            await dbSave(uid, 'exam:ct_scores', scores);
            renderCT2Tracker(uid);
        };
    }
    
    renderCT2Tracker(uid);
}

async function renderCT2Tracker(uid) {
    const tbody = document.getElementById('ct2-tbody');
    if (!tbody) return;
    
    const scores = await dbLoad(uid, 'exam:ct_scores', []);
    tbody.innerHTML = '';
    
    if (scores.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; padding:12px; color:var(--dim); font-size:11px;">No grades added yet.</td></tr>';
        return;
    }

    scores.forEach((s, idx) => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="padding:8px;">
                <input type="text" class="ct-input" value="${s.sub}" data-idx="${idx}" data-field="sub" style="width:100px; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:4px; font-size:11px; border-radius:4px;">
            </td>
            <td style="padding:8px; text-align:center;">
                <input type="number" class="ct-input" value="${s.ct1}" data-idx="${idx}" data-field="ct1" style="width:50px; text-align:center; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:4px; font-size:11px; border-radius:4px;">
            </td>
            <td style="padding:8px; text-align:center;">
                <input type="number" class="ct-input" value="${s.ct2}" data-idx="${idx}" data-field="ct2" style="width:50px; text-align:center; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:4px; font-size:11px; border-radius:4px;">
            </td>
            <td style="padding:8px; text-align:center;">
                <input type="number" class="ct-input" value="${s.see}" data-idx="${idx}" data-field="see" style="width:50px; text-align:center; background:var(--bg); border:1px solid var(--border); color:var(--text); padding:4px; font-size:11px; border-radius:4px;">
            </td>
            <td style="padding:8px; text-align:center;">
                <button class="ct-del" data-idx="${idx}" style="background:none; border:none; color:var(--red); cursor:pointer;">✕</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    // Add listeners
    tbody.querySelectorAll('.ct-input').forEach(inp => {
        inp.addEventListener('change', async (e) => {
            const el = e.target;
            const idx = parseInt(el.dataset.idx);
            const field = el.dataset.field;
            let val = el.value;
            if (field !== 'sub') val = parseFloat(val) || 0;
            
            const currentScores = await dbLoad(uid, 'exam:ct_scores', []);
            if (currentScores[idx]) {
                currentScores[idx][field] = val;
                await dbSave(uid, 'exam:ct_scores', currentScores);
            }
        });
    });

    tbody.querySelectorAll('.ct-del').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const idx = parseInt(e.target.dataset.idx);
            const currentScores = await dbLoad(uid, 'exam:ct_scores', []);
            currentScores.splice(idx, 1);
            await dbSave(uid, 'exam:ct_scores', currentScores);
            renderCT2Tracker(uid);
        });
    });
}
