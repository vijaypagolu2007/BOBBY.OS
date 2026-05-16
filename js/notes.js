import { dbLoad, dbSave } from './db.js';
import { showToast } from './utils.js';

const MOOD_EMOJI = { 1: '😫', 2: '😞', 3: '😐', 4: '😊', 5: '🔥' };

// Module-level state — persist across renders
let selectedMood = 3;
let diaryUid = null;       // Store uid so save button always has access
let listenerAttached = false;

export async function renderNotes(uid) {
    diaryUid = uid; // Always update uid
    const todayStr = new Date().toISOString().split('T')[0];

    // Update header date
    const dateEl = document.getElementById('diary-date');
    if (dateEl) {
        dateEl.textContent = new Date().toLocaleDateString('en-IN', {
            weekday: 'long', day: 'numeric', month: 'long'
        });
    }

    // Attach save button listener ONCE
    if (!listenerAttached) {
        const saveBtn = document.getElementById('diary-save');
        if (saveBtn) {
            saveBtn.addEventListener('click', () => {
                const currentDate = document.getElementById('diary-date')?.dataset.date || todayStr;
                saveDiaryEntry(diaryUid, currentDate);
            });
            listenerAttached = true;
        }
    }

    // Store today's date on the date element so save always uses correct date
    if (dateEl) dateEl.dataset.date = todayStr;

    // Energy slider live update — attach once
    const energyEl = document.getElementById('diary-energy');
    if (energyEl && !energyEl.dataset.listenerSet) {
        energyEl.addEventListener('input', () => updateEnergyDisplay(parseInt(energyEl.value)));
        energyEl.dataset.listenerSet = 'true';
    }

    // Load today's entry if it exists
    const todayEntry = await dbLoad(uid, `diary:${todayStr}`, null);
    if (todayEntry) {
        selectedMood = todayEntry.mood || 3;
        setFieldValue('diary-wins', todayEntry.wins || '');
        setFieldValue('diary-challenges', todayEntry.challenges || '');
        setFieldValue('diary-learned', todayEntry.learned || '');
        setFieldValue('diary-tomorrow', todayEntry.tomorrow || '');
        if (energyEl) {
            energyEl.value = todayEntry.energy || 7;
            updateEnergyDisplay(todayEntry.energy || 7);
        }
    } else {
        // Reset form for a fresh day
        selectedMood = 3;
        setFieldValue('diary-wins', '');
        setFieldValue('diary-challenges', '');
        setFieldValue('diary-learned', '');
        setFieldValue('diary-tomorrow', '');
        if (energyEl) { energyEl.value = 7; updateEnergyDisplay(7); }
    }

    setupMoodPicker(selectedMood);
    await renderDiaryHistory(uid);
}

function setFieldValue(id, value) {
    const el = document.getElementById(id);
    if (el) el.value = value;
}

function setupMoodPicker(current) {
    selectedMood = current;
    document.querySelectorAll('.mood-btn').forEach(btn => {
        const mood = parseInt(btn.dataset.mood);
        const isSelected = mood === selectedMood;
        btn.style.cssText = `font-size:20px; background:none; border:none; cursor:pointer; padding:4px;
            border-radius:6px; opacity:${isSelected ? '1' : '0.35'};
            transform:${isSelected ? 'scale(1.25)' : 'scale(1)'}; transition:all 0.15s;`;
        btn.onclick = () => { selectedMood = mood; setupMoodPicker(mood); };
    });
}

function updateEnergyDisplay(val) {
    const el = document.getElementById('diary-energy-val');
    if (el) el.textContent = `${val}/10`;
}

async function saveDiaryEntry(uid, dateStr) {
    if (!uid) { showToast('Not logged in — please refresh.'); return; }

    const energyVal = parseInt(document.getElementById('diary-energy')?.value || 7);
    const entry = {
        date: dateStr,
        mood: selectedMood,
        energy: energyVal,
        wins:       document.getElementById('diary-wins')?.value.trim()       || '',
        challenges: document.getElementById('diary-challenges')?.value.trim() || '',
        learned:    document.getElementById('diary-learned')?.value.trim()    || '',
        tomorrow:   document.getElementById('diary-tomorrow')?.value.trim()   || '',
        savedAt: Date.now()
    };

    // Save the entry itself
    await dbSave(uid, `diary:${dateStr}`, entry);

    // Update the diary index (list of dates, newest first)
    const index = await dbLoad(uid, 'diary:index', []);
    if (!index.includes(dateStr)) {
        index.unshift(dateStr);
        await dbSave(uid, 'diary:index', index);
    }

    // Visual confirmation
    const btn = document.getElementById('diary-save');
    if (btn) {
        btn.textContent = '✓ Saved!';
        btn.style.background = '#20d68a';
        setTimeout(() => {
            btn.textContent = 'Save Entry 📓';
            btn.style.background = '';
        }, 1800);
    }

    showToast('Diary entry saved 📓');
    await renderDiaryHistory(uid);
}

async function renderDiaryHistory(uid) {
    const historyEl = document.getElementById('diary-history');
    if (!historyEl) return;

    const index = await dbLoad(uid, 'diary:index', []);
    historyEl.innerHTML = '';

    if (!index || index.length === 0) {
        historyEl.innerHTML = `<div style="color:var(--dim); font-size:12px; padding:16px 0; line-height:1.6;">
            No entries yet.<br>Write your first diary entry and hit <strong>Save Entry</strong>!
        </div>`;
        return;
    }

    const todayStr = new Date().toISOString().split('T')[0];
    const recent = index.slice(0, 30);

    for (const dateStr of recent) {
        const entry = await dbLoad(uid, `diary:${dateStr}`, null);
        if (!entry) continue;

        const d = new Date(dateStr + 'T00:00:00');
        const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
        const isToday = dateStr === todayStr;

        const card = document.createElement('div');
        card.style.cssText = `background:var(--surface); border:1px solid ${isToday ? 'var(--accent)' : 'var(--border)'}; 
            border-radius:10px; padding:12px; cursor:pointer; transition:all 0.15s;`;
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:6px;">
                <span style="font-size:12px; font-weight:600; color:${isToday ? 'var(--accent)' : 'var(--text)'};">
                    ${isToday ? '📌 Today' : label}
                </span>
                <span style="font-size:18px;">${MOOD_EMOJI[entry.mood] || '😐'}</span>
            </div>
            <div style="display:flex; gap:6px; margin-bottom:6px;">
                <span style="font-size:10px; background:rgba(108,99,255,0.15); color:var(--accent); padding:2px 6px; border-radius:4px;">⚡ ${entry.energy || '--'}/10</span>
            </div>
            ${entry.wins ? `<div style="font-size:11px; color:var(--dim); line-height:1.4; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">✅ ${entry.wins}</div>` : '<div style="font-size:11px; color:var(--dim);">No wins recorded</div>'}
        `;
        card.onmouseenter = () => { card.style.borderColor = 'var(--accent)'; card.style.transform = 'translateY(-1px)'; };
        card.onmouseleave = () => { card.style.borderColor = isToday ? 'var(--accent)' : 'var(--border)'; card.style.transform = ''; };
        card.onclick = () => expandEntry(entry, dateStr);

        historyEl.appendChild(card);
    }
}

function expandEntry(entry, dateStr) {
    const d = new Date(dateStr + 'T00:00:00');
    const label = d.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    const todayStr = new Date().toISOString().split('T')[0];

    const dateEl = document.getElementById('diary-date');
    if (dateEl) {
        dateEl.textContent = label;
        dateEl.dataset.date = dateStr; // Save button will save to this date
    }

    selectedMood = entry.mood || 3;
    setupMoodPicker(selectedMood);
    setFieldValue('diary-wins', entry.wins || '');
    setFieldValue('diary-challenges', entry.challenges || '');
    setFieldValue('diary-learned', entry.learned || '');
    setFieldValue('diary-tomorrow', entry.tomorrow || '');

    const energyEl = document.getElementById('diary-energy');
    if (energyEl) { energyEl.value = entry.energy || 7; updateEnergyDisplay(entry.energy || 7); }

    // Scroll to top of notes panel
    document.getElementById('panel-notes')?.scrollIntoView({ behavior: 'smooth' });
}
