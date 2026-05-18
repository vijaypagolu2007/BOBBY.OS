import { dbLoad, dbSave, uKey } from './db.js';
import { showToast } from './utils.js';
import { getExamCountdown } from './exams.js';
import { markHabitDoneToday } from './habits.js';
import { buildHabits } from './data.js';

let pomodoroInterval;
let timeLeft = 25 * 60;
let isRunning = false;

export function initPowerHub(uid) {
    setupPomodoro(uid);
    setupCountdown();
    setupTargets(uid);
    setupNightShift(uid);
    setupCPTracker(uid);
    setupAI(uid);
}

async function setupPomodoro(uid) {
    const display = document.getElementById('p-timer');
    const startBtn = document.getElementById('p-start');
    const resetBtn = document.getElementById('p-reset');
    const habitSelect = document.getElementById('p-habit-select');
    const durationSel = document.getElementById('p-duration');

    if (!display || !startBtn || !resetBtn) return;

    if (habitSelect) {
        const habits = await buildHabits(uid);
        habits.forEach(h => {
            if (!h.group) {
                const opt = document.createElement('option');
                opt.value = h.id;
                opt.textContent = `${h.icon} ${h.name}`;
                habitSelect.appendChild(opt);
            }
        });
    }

    // Load saved duration preference
    const savedMins = await dbLoad(uid, 'power:pomo_duration', 25);
    timeLeft = savedMins * 60;
    if (durationSel) durationSel.value = String(savedMins);

    if (durationSel) {
        durationSel.addEventListener('change', async () => {
            const mins = parseInt(durationSel.value);
            timeLeft = mins * 60;
            if (isRunning) {
                clearInterval(pomodoroInterval);
                isRunning = false;
                if (startBtn) startBtn.textContent = 'Start Session';
            }
            await dbSave(uid, 'power:pomo_duration', mins);
            updateDisplay();
        });
    }

    function updateDisplay() {
        const m = Math.floor(timeLeft / 60);
        const s = timeLeft % 60;
        display.textContent = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }

    updateDisplay();

    startBtn.onclick = () => {
        if (isRunning) {
            clearInterval(pomodoroInterval);
            startBtn.textContent = 'Start Session';
            isRunning = false;
        } else {
            isRunning = true;
            startBtn.textContent = 'Pause';
            pomodoroInterval = setInterval(async () => {
                timeLeft--;
                updateDisplay();
                if (timeLeft <= 0) {
                    clearInterval(pomodoroInterval);
                    showToast('Focus Session Complete! 🧘');
                    if (habitSelect && habitSelect.value) {
                        await markHabitDoneToday(uid, habitSelect.value);
                        showToast('Habit automatically logged 📈');
                    }
                    resetPomodoro();
                }
            }, 1000);
        }
    };

    resetBtn.onclick = resetPomodoro;

    function resetPomodoro() {
        clearInterval(pomodoroInterval);
        const mins = durationSel ? parseInt(durationSel.value) : 25;
        timeLeft = mins * 60;
        isRunning = false;
        startBtn.textContent = 'Start Session';
        updateDisplay();
    }
}

function setupCountdown() {
    // Import EXAMS dynamically to get real data
    import('./exams.js').then(({ EXAMS }) => {
        updateCountdown(EXAMS);
        setInterval(() => updateCountdown(EXAMS), 60000);
    }).catch(() => {});
}

function updateCountdown(EXAMS) {
    const daysEl = document.getElementById('p-days');
    const hoursEl = document.getElementById('p-hours');
    const minsEl = document.getElementById('p-mins');
    const fillEl = document.querySelector('.p-intensity-fill');
    const noteEl = document.querySelector('.p-card-note');
    
    if (!daysEl) return;

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];

    // Find next upcoming exam
    const upcoming = EXAMS.filter(e => e.date >= todayStr).sort((a, b) => a.date.localeCompare(b.date))[0];

    if (!upcoming) {
        daysEl.textContent = EXAMS.length > 0 ? '✓' : '--';
        if (noteEl) noteEl.textContent = EXAMS.length > 0 ? 'All exams done!' : 'No exams scheduled';
        if (fillEl) fillEl.style.width = EXAMS.length > 0 ? '100%' : '0%';
        return;
    }

    const examTime = new Date(upcoming.date + 'T09:00:00');
    const diff = examTime - now;
    
    const days = Math.max(0, Math.floor(diff / 864e5));
    const hours = Math.max(0, Math.floor((diff % 864e5) / 36e5));
    const mins = Math.max(0, Math.floor((diff % 36e5) / 6e4));

    daysEl.textContent = days;
    if (hoursEl) hoursEl.textContent = String(hours).padStart(2, '0');
    if (minsEl) minsEl.textContent = String(mins).padStart(2, '0');

    // Progress Calculation
    const total = EXAMS.reduce((acc, ex) => acc + ex.papers.length, 0);
    let done = 0;
    EXAMS.forEach(ex => ex.papers.forEach(p => {
        const h = p.slot === 'S1' ? 12 : 16;
        if (now > new Date(ex.date + 'T' + h + ':00:00')) done++;
    }));

    const intensity = total === 0 ? 0 : Math.round((done / total) * 100);
    if (fillEl) fillEl.style.width = `${intensity}%`;
    
    if (noteEl) {
        const load = intensity > 70 ? 'Extreme' : intensity > 40 ? 'High' : 'Moderate';
        noteEl.innerHTML = `Cognitive Load: <strong style="color:var(--text)">${load}</strong> (${done}/${total} papers)`;
    }
}

async function setupTargets(uid) {
    const list = document.querySelector('.p-target-list');
    if (!list) return;

    const targets = await dbLoad(uid, 'power:targets', [
        { id: '1', text: 'Solve 3 CP Problems', done: false },
        { id: '2', text: 'Refactor Auth Module', done: false },
        { id: '3', text: 'Leg Day Workout', done: false }
    ]);

    renderTargets(uid, targets);
}

function renderTargets(uid, targets) {
    const list = document.querySelector('.p-target-list');
    if (!list) return;
    list.innerHTML = '';

    targets.forEach((t, index) => {
        const li = document.createElement('li');
        li.style.opacity = t.done ? '0.5' : '1';
        li.style.textDecoration = t.done ? 'line-through' : 'none';
        li.style.display = 'flex';
        li.style.justifyContent = 'space-between';
        
        const leftWrap = document.createElement('div');
        leftWrap.style.display = 'flex';
        leftWrap.style.alignItems = 'center';
        leftWrap.style.gap = '12px';

        const chk = document.createElement('div');
        chk.className = `p-chk${t.done ? ' checked' : ''}`;
        if (t.done) {
            chk.style.background = 'var(--accent)';
            chk.style.borderColor = 'var(--accent)';
        }

        chk.onclick = async () => {
            t.done = !t.done;
            await dbSave(uid, 'power:targets', targets);
            renderTargets(uid, targets);
            if (t.done) showToast('Target Acquired 🎯');
        };

        const span = document.createElement('span');
        span.textContent = t.text;
        
        leftWrap.append(chk, span);

        const delBtn = document.createElement('button');
        delBtn.innerHTML = '✕';
        delBtn.style.background = 'none';
        delBtn.style.border = 'none';
        delBtn.style.color = 'var(--dim)';
        delBtn.style.cursor = 'pointer';
        delBtn.style.fontSize = '12px';
        delBtn.style.padding = '0 5px';
        delBtn.style.opacity = '0.5';
        delBtn.onmouseover = () => { delBtn.style.color = '#ff5572'; delBtn.style.opacity = '1'; };
        delBtn.onmouseout = () => { delBtn.style.color = 'var(--dim)'; delBtn.style.opacity = '0.5'; };
        delBtn.onclick = async () => {
            targets.splice(index, 1);
            await dbSave(uid, 'power:targets', targets);
            renderTargets(uid, targets);
        };

        li.append(leftWrap, delBtn);
        list.appendChild(li);
    });

    // Add "Add Target" input if not present
    if (!document.getElementById('p-target-add-wrap')) {
        const wrap = document.createElement('div');
        wrap.id = 'p-target-add-wrap';
        wrap.className = 'p-add-row';
        wrap.innerHTML = `
            <input type="text" id="p-target-input" placeholder="Add new target...">
            <button id="p-target-add-btn">+</button>
        `;
        list.parentElement.appendChild(wrap);

        document.getElementById('p-target-add-btn').onclick = () => addTarget(uid, targets);
        document.getElementById('p-target-input').onkeydown = (e) => {
            if (e.key === 'Enter') addTarget(uid, targets);
        };
    }
}

async function addTarget(uid, targets) {
    const input = document.getElementById('p-target-input');
    const text = input.value.trim();
    if (!text) return;

    targets.push({ id: Date.now().toString(), text, done: false });
    await dbSave(uid, 'power:targets', targets);
    input.value = '';
    renderTargets(uid, targets);
    showToast('New objective set 🚀');
}

async function setupNightShift(uid) {
    const actualEl = document.getElementById('p-sleep-actual');
    const effEl = document.getElementById('p-sleep-eff');
    const inputEl = document.getElementById('p-sleep-input');
    const addBtn = document.getElementById('p-sleep-add-btn');
    if (!actualEl || !inputEl || !addBtn) return;

    // Load sleep data
    const sleepData = await dbLoad(uid, 'power:sleep', { actual: 0 });
    
    const updateSleepUI = (actual) => {
        actualEl.textContent = actual > 0 ? `${actual.toFixed(1)}h` : '--h';
        if (actual > 0) {
            const eff = Math.min(100, Math.round((actual / 8.0) * 100));
            effEl.textContent = `Efficiency: ${eff}%`;
            effEl.style.color = eff >= 85 ? '#20d68a' : eff >= 70 ? '#ffbe3d' : '#ff5572';
        } else {
            effEl.textContent = `Efficiency: --%`;
            effEl.style.color = 'var(--dim)';
        }
    };

    updateSleepUI(sleepData.actual);

    addBtn.onclick = async () => {
        const val = parseFloat(inputEl.value);
        if (isNaN(val) || val <= 0 || val > 24) return;
        
        sleepData.actual = val;
        await dbSave(uid, 'power:sleep', sleepData);
        updateSleepUI(val);
        inputEl.value = '';
        showToast('Sleep log updated 🌙');
    };
}

function setupAI(uid) {
    const btn = document.getElementById('ai-refresh');
    const msg = document.getElementById('ai-suggestion');
    if (!btn || !msg) return;

    btn.onclick = async () => {
        btn.textContent = 'Analyzing...';
        btn.style.opacity = '0.7';
        btn.disabled = true;

        try {
            const advice = await getStudyAdvice(uid);
            msg.innerHTML = `"${advice}"`;
        } catch (e) {
            msg.innerHTML = `"Error generating insights."`;
        } finally {
            btn.textContent = 'Optimize Schedule';
            btn.style.opacity = '1';
            btn.disabled = false;
        }
    };
}

function setupCPTracker(uid) {
    const ratingEl = document.getElementById('cp-rating');
    const rankEl = document.getElementById('cp-rank');
    const maxEl = document.getElementById('cp-max');
    const btn = document.getElementById('cp-refresh');

    if (!ratingEl || !btn) return;

    const fetchCP = async () => {
        btn.textContent = 'Fetching...';
        try {
            const handleData = await dbLoad(uid, 'power:cf_handle', { handle: 'Vijaypagolu96' });
            const handle = (handleData.handle || 'Vijaypagolu96').trim();
            if (!handle) return;

            const safeHandle = encodeURIComponent(handle);
            
            const fetchWithProxy = async (url) => {
                // 1. Try corsproxy.io (Very reliable)
                try {
                    const res = await fetch(`https://corsproxy.io/?${encodeURIComponent(url)}`);
                    if (res.ok) return await res.json();
                } catch (e) { console.warn('CORS Proxy failed'); }

                // 2. Try AllOrigins
                try {
                    const res = await fetch(`https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`);
                    if (res.ok) return await res.json();
                } catch (e) { console.warn('AllOrigins failed'); }

                throw new Error('Connection failed');
            };

            const infoData = await fetchWithProxy(`https://codeforces.com/api/user.info?handles=${safeHandle}`);

            if (infoData.status !== 'OK') throw new Error(infoData.comment || `User "${handle}" not found on Codeforces`);
            const info = infoData.result[0];

            // Optional: Try to get delta from rating history
            let delta = 0;
            try {
                const rData = await fetchWithProxy(`https://codeforces.com/api/user.rating?handle=${safeHandle}`);
                if (rData && rData.status === 'OK' && rData.result.length > 0) {
                    const last = rData.result[rData.result.length - 1];
                    delta = last.newRating - last.oldRating;
                    // Save rating history for Progress Charts
                    await dbSave(uid, 'power:cpData', rData.result);
                }
            } catch (re) { console.warn('Rating history fetch failed', re); }

            const stats = {
                rating: info.rating || 0,
                rank: info.rank || 'Unrated',
                maxRating: info.maxRating || 0,
                delta,
                handle,
                ts: Date.now()
            };

            await dbSave(uid, 'power:cp', stats);
            updateUI(stats);
            showToast(`Synced ${handle} 📊`);
        } catch (e) {
            console.error('CP Error:', e);
            showToast(`CP Error: ${e.message}`);
        } finally {
            btn.textContent = 'Refresh API';
        }
    };

    const updateUI = (stats) => {
        const ratingEl = document.getElementById('cp-rating');
        const rankEl = document.getElementById('cp-rank');
        const maxEl = document.getElementById('cp-max');
        const handleEl = document.getElementById('cp-handle-display');
        
        if (!ratingEl) return;

        if (handleEl) handleEl.textContent = stats.handle || 'Vijaypagolu96';

        const deltaStr = stats.delta !== undefined 
            ? `<span style="font-size:14px; margin-left:8px; color:${stats.delta >= 0 ? '#20d68a' : '#ff5572'}">${stats.delta >= 0 ? '+' : ''}${stats.delta}</span>`
            : '';
            
        ratingEl.innerHTML = `${stats.rating || '--'}${deltaStr}`;
        
        if (rankEl) {
            rankEl.textContent = stats.rating
                ? String(stats.rank).charAt(0).toUpperCase() + String(stats.rank).slice(1)
                : 'Unrated';
        }
        if (maxEl) maxEl.textContent = stats.maxRating || '--';

        // Official Codeforces Rank Colors
        let color = '#ccc'; // Newbie (Gray/Default)
        const r = stats.rating || 0;
        if (r >= 2400) color = '#ff0000'; // Grandmaster+ (Red)
        else if (r >= 2100) color = '#ff8c00'; // Master (Orange)
        else if (r >= 1900) color = '#aa00aa'; // Candidate Master (Purple)
        else if (r >= 1600) color = '#0000ff'; // Expert (Blue)
        else if (r >= 1400) color = '#03a89e'; // Specialist (Cyan)
        else if (r >= 1200) color = '#008000'; // Pupil (Green)
        else color = '#808080'; // Newbie (Gray)
        
        ratingEl.style.color = color;
    };

    // Setup handle edit
    setupHandleEdit(uid, fetchCP);
    btn.onclick = fetchCP;

    // Initial load from cache (no hardcoded fallback)
    dbLoad(uid, 'power:cp', null).then(d => { if (d) updateUI(d); });
}

/** Sets up the handle input and save button for Codeforces stats */
async function setupHandleEdit(uid, onSave) {
    const input = document.getElementById('cf-handle-input');
    const saveBtn = document.getElementById('cf-handle-save');
    if (!input || !saveBtn) return;

    const saved = await dbLoad(uid, 'power:cf_handle', { handle: 'Vijaypagolu96' });
    if (saved.handle) input.value = saved.handle;

    saveBtn.onclick = async () => {
        const handle = input.value.trim();
        if (!handle) return;
        await dbSave(uid, 'power:cf_handle', { handle });
        await dbSave(uid, 'power:cp', null); // Clear cache
        showToast(`Handle set to ${handle} ✓`);
        onSave();
    };
}
