import { dbLoad, dbSave } from './db.js';
import { iso, today, showToast } from './utils.js';

export async function initDiary(uid) {
    const saveBtn = document.getElementById('diary-save');
    const moodBtns = document.querySelectorAll('.mood-btn');
    const energyRange = document.getElementById('diary-energy');
    const energyVal = document.getElementById('diary-energy-val');

    if (!saveBtn) return;

    let selectedMood = 3;

    moodBtns.forEach(btn => {
        btn.onclick = () => {
            selectedMood = parseInt(btn.dataset.mood);
            moodBtns.forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
        };
    });

    if (energyRange && energyVal) {
        energyRange.oninput = () => {
            energyVal.textContent = `${energyRange.value}/10`;
        };
    }

    saveBtn.onclick = async () => {
        const wins = document.getElementById('diary-wins').value.trim();
        const challenges = document.getElementById('diary-challenges').value.trim();
        const learned = document.getElementById('diary-learned').value.trim();
        const tomorrow = document.getElementById('diary-tomorrow').value.trim();
        const energy = parseInt(energyRange.value);

        const entry = {
            date: today(),
            mood: selectedMood,
            energy,
            wins,
            challenges,
            learned,
            tomorrow,
            ts: Date.now()
        };

        const history = await dbLoad(uid, 'diary:history', []);
        // Update existing for today or push new
        const existingIdx = history.findIndex(h => h.date === entry.date);
        if (existingIdx !== -1) {
            history[existingIdx] = entry;
        } else {
            history.unshift(entry);
        }

        await dbSave(uid, 'diary:history', history);
        showToast('Diary entry saved 📔');
        renderDiaryHistory(history);
    };

    // Load today's entry if exists
    const history = await dbLoad(uid, 'diary:history', []);
    const todayEntry = history.find(h => h.date === today());
    if (todayEntry) {
        document.getElementById('diary-wins').value = todayEntry.wins || '';
        document.getElementById('diary-challenges').value = todayEntry.challenges || '';
        document.getElementById('diary-learned').value = todayEntry.learned || '';
        document.getElementById('diary-tomorrow').value = todayEntry.tomorrow || '';
        energyRange.value = todayEntry.energy || 7;
        energyVal.textContent = `${energyRange.value}/10`;
        selectedMood = todayEntry.mood || 3;
        const moodBtn = document.querySelector(`.mood-btn[data-mood="${selectedMood}"]`);
        if (moodBtn) moodBtn.classList.add('active');
    }

    renderDiaryHistory(history);
}

function renderDiaryHistory(history) {
    const list = document.getElementById('diary-history');
    if (!list) return;
    list.innerHTML = '';

    if (history.length === 0) {
        list.innerHTML = `<div style="text-align:center; padding:20px; color:var(--dim); font-size:11px;">No past entries yet.</div>`;
        return;
    }

    history.forEach(entry => {
        const card = document.createElement('div');
        card.className = 'diary-card';
        card.style.cssText = 'background:var(--surface); border:1px solid var(--border); border-radius:10px; padding:12px;';
        
        const moodEmoji = ['😫', '😞', '😐', '😊', '🔥'][entry.mood - 1] || '😐';
        const d = new Date(entry.date + 'T00:00:00');
        
        card.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:11px; font-weight:700; color:var(--accent);">${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', weekday: 'short' })}</span>
                <span style="font-size:14px;">${moodEmoji}</span>
            </div>
            <div style="font-size:11px; color:var(--text); line-height:1.4; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">
                ${entry.wins ? '✅ ' + entry.wins : 'No notes recorded.'}
            </div>
            <div style="margin-top:6px; display:flex; gap:4px;">
                <div style="height:2px; flex:1; background:var(--border); border-radius:2px;">
                    <div style="height:100%; width:${entry.energy * 10}%; background:var(--accent); border-radius:2px;"></div>
                </div>
            </div>
        `;
        list.appendChild(card);
    });
}
