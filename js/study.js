import { dbLoad, dbSave } from './db.js';
import { showToast } from './utils.js';
import { EXAMS } from './exams.js';

let currentUid = null;

export function initStudy(uid) {
    currentUid = uid;
    
    // Extract unique subjects from EXAMS
    const subjects = new Set();
    EXAMS.forEach(ex => {
        ex.papers.forEach(p => subjects.add(p.name));
    });
    const subjectList = Array.from(subjects).sort();

    // Populate selectors
    const populateSelect = (id) => {
        const sel = document.getElementById(id);
        if (!sel) return;
        sel.innerHTML = '<option value="">Select Subject...</option>';
        subjectList.forEach(sub => {
            const opt = document.createElement('option');
            opt.value = sub;
            opt.textContent = sub;
            sel.appendChild(opt);
        });
    };

    populateSelect('formula-subject-sel');
    populateSelect('rev-subject-sel');
    populateSelect('note-subject-sel');

    // 1. Formula Vault
    setupFormulaVault(uid);

    // 2. Revision Checklist
    setupRevisionChecklist(uid);

    // 3. Wrong Answer Log
    setupWrongAnswerLog(uid);

    // 4. Subject Notes
    setupSubjectNotes(uid);
}

async function setupFormulaVault(uid) {
    const sel = document.getElementById('formula-subject-sel');
    const list = document.getElementById('formula-list');
    const titleIn = document.getElementById('formula-title');
    const valIn = document.getElementById('formula-val');
    const addBtn = document.getElementById('add-formula-btn');

    if (!sel || !addBtn) return;

    const renderFormulas = async () => {
        const sub = sel.value;
        list.innerHTML = '';
        if (!sub) return;

        const formulas = await dbLoad(uid, `study:formulas:${sub}`, []);
        formulas.forEach((f, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:8px; display:flex; justify-content:space-between; align-items:center;';
            row.innerHTML = `
                <div style="flex:1;">
                    <div style="font-size:11px; font-weight:700; color:var(--text);">${f.title}</div>
                    <div style="font-size:11px; color:var(--yellow); font-family:var(--mono); margin-top:2px;">${f.val}</div>
                </div>
                <button class="f-del" style="background:none; border:none; color:var(--dim); cursor:pointer; font-size:12px;">✕</button>
            `;
            row.querySelector('.f-del').onclick = async () => {
                formulas.splice(idx, 1);
                await dbSave(uid, `study:formulas:${sub}`, formulas);
                renderFormulas();
            };
            list.appendChild(row);
        });
    };

    sel.onchange = renderFormulas;

    addBtn.onclick = async () => {
        const sub = sel.value;
        const title = titleIn.value.trim();
        const val = valIn.value.trim();
        if (!sub || !title || !val) {
            showToast('Select a subject and fill both fields');
            return;
        }

        const formulas = await dbLoad(uid, `study:formulas:${sub}`, []);
        formulas.push({ title, val });
        await dbSave(uid, `study:formulas:${sub}`, formulas);
        titleIn.value = '';
        valIn.value = '';
        renderFormulas();
        showToast('Formula saved ✨');
    };
}

async function setupRevisionChecklist(uid) {
    const sel = document.getElementById('rev-subject-sel');
    const list = document.getElementById('rev-list');
    const topicIn = document.getElementById('rev-topic');
    const addBtn = document.getElementById('add-rev-btn');

    if (!sel || !addBtn) return;

    const renderRev = async () => {
        const sub = sel.value;
        list.innerHTML = '';
        if (!sub) return;

        const revs = await dbLoad(uid, `study:rev:${sub}`, []);
        revs.forEach((r, idx) => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex; justify-content:space-between; align-items:center; font-size:12px; color:var(--text);';
            row.style.opacity = r.done ? '0.5' : '1';
            row.innerHTML = `
                <div style="display:flex; align-items:center; gap:8px;">
                    <input type="checkbox" class="r-chk" ${r.done ? 'checked' : ''} style="accent-color:var(--green); cursor:pointer;">
                    <span style="text-decoration:${r.done ? 'line-through' : 'none'};">${r.topic}</span>
                </div>
                <button class="r-del" style="background:none; border:none; color:var(--dim); cursor:pointer; font-size:12px;">✕</button>
            `;
            
            row.querySelector('.r-chk').onchange = async (e) => {
                r.done = e.target.checked;
                await dbSave(uid, `study:rev:${sub}`, revs);
                renderRev();
            };

            row.querySelector('.r-del').onclick = async () => {
                revs.splice(idx, 1);
                await dbSave(uid, `study:rev:${sub}`, revs);
                renderRev();
            };
            
            list.appendChild(row);
        });
    };

    sel.onchange = renderRev;

    addBtn.onclick = async () => {
        const sub = sel.value;
        const topic = topicIn.value.trim();
        if (!sub || !topic) return;

        const revs = await dbLoad(uid, `study:rev:${sub}`, []);
        revs.push({ topic, done: false });
        await dbSave(uid, `study:rev:${sub}`, revs);
        topicIn.value = '';
        renderRev();
    };
}

async function setupWrongAnswerLog(uid) {
    const tbody = document.getElementById('wa-tbody');
    const probIn = document.getElementById('wa-prob');
    const descIn = document.getElementById('wa-desc');
    const addBtn = document.getElementById('add-wa-btn');

    if (!tbody || !addBtn) return;

    const renderWA = async () => {
        tbody.innerHTML = '';
        const logs = await dbLoad(uid, 'study:wa', []);
        
        if (logs.length === 0) {
            tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:12px; color:var(--dim); font-size:11px;">No mistakes logged yet. Keep solving!</td></tr>';
            return;
        }

        logs.forEach((log, idx) => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td style="padding:8px; font-weight:700; color:var(--text); font-size:11px;">${log.prob}</td>
                <td style="padding:8px; color:var(--dim); font-size:11px;">${log.desc}</td>
                <td style="padding:8px; text-align:center; font-size:10px; color:var(--dim);">${log.date}</td>
                <td style="padding:8px; text-align:center;"><button class="wa-del" style="background:none; border:none; color:var(--red); cursor:pointer;">✕</button></td>
            `;
            tr.querySelector('.wa-del').onclick = async () => {
                logs.splice(idx, 1);
                await dbSave(uid, 'study:wa', logs);
                renderWA();
            };
            tbody.appendChild(tr);
        });
    };

    renderWA();

    addBtn.onclick = async () => {
        const prob = probIn.value.trim();
        const desc = descIn.value.trim();
        if (!prob || !desc) return;

        const logs = await dbLoad(uid, 'study:wa', []);
        logs.unshift({ prob, desc, date: new Date().toLocaleDateString('default', { month: 'short', day: 'numeric' }) });
        await dbSave(uid, 'study:wa', logs);
        
        probIn.value = '';
        descIn.value = '';
        renderWA();
        showToast('Mistake logged 🧠');
    };
}

async function setupSubjectNotes(uid) {
    const sel = document.getElementById('note-subject-sel');
    const editor = document.getElementById('note-editor');
    const saveBtn = document.getElementById('save-note-btn');

    if (!sel || !editor || !saveBtn) return;

    sel.onchange = async () => {
        const sub = sel.value;
        if (!sub) {
            editor.value = '';
            editor.disabled = true;
            return;
        }
        editor.disabled = false;
        editor.value = 'Loading...';
        const notes = await dbLoad(uid, `study:notes:${sub}`, '');
        editor.value = notes;
    };

    saveBtn.onclick = async () => {
        const sub = sel.value;
        if (!sub) return;
        await dbSave(uid, `study:notes:${sub}`, editor.value);
        
        const oldText = saveBtn.textContent;
        saveBtn.textContent = 'Saved ✓';
        saveBtn.style.background = '#20d68a';
        setTimeout(() => {
            saveBtn.textContent = oldText;
            saveBtn.style.background = '';
        }, 1500);
    };
}
