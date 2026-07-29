import { initAuth, checkSession, loginWithGoogle, doLogin, doRegister, doLogout, currentUser } from './auth.js';
import { auth } from './firebase.js';
import { dbLoad, dbSave, uKey, listenToUserData, DB, S, preloadAllUserData, clearCache, initSyncIndicator } from './db.js';
import { renderHabits, weekOff, setWeekOff } from './habits.js';
import { renderSched, curDay, setCurDay } from './schedule.js';
import { renderNotes } from './notes.js';
import { wkKey, showToast } from './utils.js';
import { DAY_N, setSlots, defSlots, getSlots } from './data.js';
import { initPowerHub } from './power.js';
import { initDiary } from './diary.js';
import { setupScoreTracker } from './scores.js';

// Phase 3: PWA & Notifications imports
import { registerSW } from 'virtual:pwa-register';
import {
    updateNotificationBadge,
    requestNotificationPermission,
    openNotificationSettings,
    refreshNotificationSchedules,
    checkAndTriggerHabitAlert,
    checkAndTriggerExamAlert,
    loadExamDates,
    triggerTestNotification
} from './notifications.js';

// Initialize PWA Service Worker
if ('serviceWorker' in navigator) {
    registerSW({
        onOfflineReady() {
            showToast('BOBBY.OS is ready to work offline! ⚡');
        },
        onNeedRefresh() {
            if (confirm('New system update available. Reload page?')) {
                location.reload();
            }
        }
    });
}

// Stored Settings Initialization
function loadStoredSettings() {
    // 1. Theme
    const storedTheme = localStorage.getItem('ui:theme') || 'purple';
    document.body.setAttribute('data-theme', storedTheme);
    
    // Update theme customizer button active state
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.classList.toggle('active', btn.dataset.theme === storedTheme);
    });

    // 2. Density UI scaling
    const storedDensity = localStorage.getItem('ui:density') || 'normal';
    if (storedDensity === 'compact') {
        document.body.classList.add('compact-mode');
    } else {
        document.body.classList.remove('compact-mode');
    }
    
    // Update density button active states
    const normalBtn = document.getElementById('btn-density-normal');
    const compactBtn = document.getElementById('btn-density-compact');
    if (normalBtn && compactBtn) {
        normalBtn.classList.toggle('active', storedDensity === 'normal');
        compactBtn.classList.toggle('active', storedDensity === 'compact');
    }

    // 3. Notification toggle checkboxes
    const chk330 = document.getElementById('chk-330-alert');
    if (chk330) chk330.checked = localStorage.getItem('alert:330') !== 'false';

    const chkExam = document.getElementById('chk-exam-alert');
    if (chkExam) chkExam.checked = localStorage.getItem('alert:exam') !== 'false';
}

async function init() {
    loadStoredSettings();
    updateNotificationBadge();
    initSyncIndicator();

    const loading = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');

    // BUG-2 Fix: Never let the loading screen hang more than 4 seconds
    const forceHide = setTimeout(() => {
        if (loading) loading.style.display = 'none';
    }, 4000);

    initAuth(async (user) => {
        clearTimeout(forceHide);
        const dbStatus = document.getElementById('db-status');
        if (dbStatus) {
            dbStatus.textContent = auth.onAuthStateChanged ? 'Connected to Cloud Persistence' : 'Running in Local-Only Mock Mode';
            dbStatus.style.color = auth.onAuthStateChanged ? 'var(--accent)' : '#ffb300';
        }

        if (user) {
            await bootApp(user);
            if (loading) loading.style.display = 'none';
        } else {
            if (loading) loading.style.display = 'none';
            authScreen.classList.add('show');
            document.getElementById('app').style.display = 'none';
        }
    });
    
    setupEventListeners();
}

async function bootApp(user) {
    document.getElementById('auth-screen').classList.remove('show');
    document.getElementById('app').style.display = 'block';

    const name = user.name || user.displayName || (user.email ? user.email.split('@')[0] : 'User');
    document.getElementById('u-name').textContent = name;
    document.getElementById('u-avatar').textContent = name[0].toUpperCase();
    
    const uidEl = document.getElementById('u-uid');
    const isLive = !!auth.onAuthStateChanged;
    if (uidEl) {
        uidEl.textContent = `UID: ${user.uid.slice(0, 8)}... (${isLive ? 'LIVE' : 'MOCK'})`;
    }

    // Preload all user data in the background to prevent boot hangs or blocking event listeners
    preloadAllUserData(user.uid).catch(err => console.error("BOBBY.OS: Preload background error:", err));
    await loadExamDates(user.uid);

    // Configure Account Diagnostic Modal fields on boot
    const diagUid = document.getElementById('diag-uid');
    const diagEmail = document.getElementById('diag-email');
    const diagProvider = document.getElementById('diag-provider');
    const diagDbMode = document.getElementById('diag-db-mode');
    const diagSync = document.getElementById('diag-sync');
    
    if (diagUid) diagUid.textContent = user.uid;
    if (diagEmail) diagEmail.textContent = user.email || 'N/A (Local Mock)';
    if (diagProvider) {
        let provider = 'Email/Password';
        const firebaseUser = auth.currentUser;
        if (firebaseUser && firebaseUser.providerData && firebaseUser.providerData.length > 0) {
            const provId = firebaseUser.providerData[0].providerId;
            if (provId === 'google.com') provider = 'Google Sign-In 🌐';
            else if (provId === 'password') provider = 'Email/Password 📧';
            else provider = provId;
        } else if (!isLive) {
            provider = 'Mock Local Session';
        }
        diagProvider.textContent = provider;
    }
    if (diagDbMode) {
        diagDbMode.textContent = isLive ? 'Cloud Firestore (LIVE)' : 'Local Storage Only (MOCK)';
        diagDbMode.style.color = isLive ? 'var(--green)' : 'var(--red)';
    }
    if (diagSync) {
        diagSync.textContent = navigator.onLine ? 'Connected & Listening 🟢' : 'Offline Mode 🔴';
        diagSync.style.color = navigator.onLine ? 'var(--green)' : 'var(--red)';
    }

    // Diagnostic Modal Event Listeners
    const userTagBtn = document.getElementById('auth-user-tag-btn');
    const uAvatarBtn = document.getElementById('u-avatar');
    const diagModal = document.getElementById('diag-modal');
    const diagClose = document.getElementById('diag-close');
    const diagLogoutBtn = document.getElementById('diag-logout-btn');
    const forceSyncBtn = document.getElementById('diag-force-sync');

    const openDiagnostics = () => {
        const currentLive = !!auth.onAuthStateChanged;
        if (diagSync) {
            diagSync.textContent = navigator.onLine ? 'Connected & Listening 🟢' : 'Offline Mode 🔴';
            diagSync.style.color = navigator.onLine ? 'var(--green)' : 'var(--red)';
        }
        if (diagDbMode) {
            diagDbMode.textContent = currentLive ? 'Cloud Firestore (LIVE)' : 'Local Storage Only (MOCK)';
            diagDbMode.style.color = currentLive ? 'var(--green)' : 'var(--red)';
        }
        if (diagModal) diagModal.style.display = 'flex';
    };

    if (userTagBtn) {
        userTagBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDiagnostics();
        });
    }

    if (uAvatarBtn) {
        uAvatarBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            openDiagnostics();
        });
    }

    if (diagClose && diagModal) {
        diagClose.addEventListener('click', () => {
            diagModal.style.display = 'none';
        });
    }

    if (diagModal) {
        diagModal.addEventListener('click', (e) => {
            if (e.target === diagModal) {
                diagModal.style.display = 'none';
            }
        });
    }

    if (diagLogoutBtn) {
        diagLogoutBtn.addEventListener('click', async () => {
            await doLogout();
            location.reload();
        });
    }

    if (forceSyncBtn) {
        forceSyncBtn.addEventListener('click', async () => {
            forceSyncBtn.textContent = 'Syncing... 🔄';
            forceSyncBtn.disabled = true;
            try {
                clearCache();
                await preloadAllUserData(user.uid);
                
                const activeTab = ['habit', 'power', 'sched', 'notes'].find(id => {
                    const el = document.getElementById(`tab-${id}`);
                    return el && el.classList.contains('active');
                }) || 'habit';
                
                if (activeTab === 'sched') renderSched(user.uid);
                if (activeTab === 'habit') {
                    renderHabits(user.uid);
                    setupScoreTracker(user.uid);
                }

                if (activeTab === 'power') initPowerHub(user.uid);
                if (activeTab === 'study') initStudy(user.uid);
                if (activeTab === 'notes') initDiary(user.uid);
                
                showToast('Database Force-Synced successfully! ⚡');
            } catch (err) {
                console.error("Force sync failed:", err);
                showToast('Force Sync failed ❌');
            } finally {
                forceSyncBtn.textContent = 'Force Sync 🔄';
                forceSyncBtn.disabled = false;
            }
        });
    }
    
    document.getElementById('top-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    // Sync customizer preferences from cloud on boot
    const cloudTheme = await dbLoad(user.uid, 'ui:theme', 'purple');
    if (cloudTheme && cloudTheme !== localStorage.getItem('ui:theme')) {
        localStorage.setItem('ui:theme', cloudTheme);
        document.body.setAttribute('data-theme', cloudTheme);
        document.querySelectorAll('.theme-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.theme === cloudTheme);
        });
    }

    const cloudDensity = await dbLoad(user.uid, 'ui:density', 'normal');
    if (cloudDensity && cloudDensity !== localStorage.getItem('ui:density')) {
        localStorage.setItem('ui:density', cloudDensity);
        if (cloudDensity === 'compact') {
            document.body.classList.add('compact-mode');
        } else {
            document.body.classList.remove('compact-mode');
        }
        const normalBtn = document.getElementById('btn-density-normal');
        const compactBtn = document.getElementById('btn-density-compact');
        if (normalBtn && compactBtn) {
            normalBtn.classList.toggle('active', cloudDensity === 'normal');
            compactBtn.classList.toggle('active', cloudDensity === 'compact');
        }
    }

    // Real-time listener for data sync
    listenToUserData(user.uid, async (data) => {
        if (data['exams:list']) {
            await loadExamDates(user.uid);
        }

        // Look up the actually active DOM tab to ensure we sync what the user is currently viewing
        const activeTab = ['habit', 'power', 'sched', 'notes'].find(id => {
            const el = document.getElementById(`tab-${id}`);
            return el && el.classList.contains('active');
        }) || 'habit';

        if (activeTab === 'sched') renderSched(user.uid);
        if (activeTab === 'habit') {
            renderHabits(user.uid);
            setupScoreTracker(user.uid);
        }

        if (activeTab === 'power') initPowerHub(user.uid);
        if (activeTab === 'study') initStudy(user.uid);
        if (activeTab === 'notes') initDiary(user.uid);

        // Also sync theme & density live!
        if (data['ui:theme'] && data['ui:theme'] !== localStorage.getItem('ui:theme')) {
            const theme = data['ui:theme'];
            localStorage.setItem('ui:theme', theme);
            document.body.setAttribute('data-theme', theme);
            document.querySelectorAll('.theme-btn').forEach(btn => {
                btn.classList.toggle('active', btn.dataset.theme === theme);
            });
        }
        if (data['ui:density'] && data['ui:density'] !== localStorage.getItem('ui:density')) {
            const density = data['ui:density'];
            localStorage.setItem('ui:density', density);
            if (density === 'compact') {
                document.body.classList.add('compact-mode');
            } else {
                document.body.classList.remove('compact-mode');
            }
            const normalBtn = document.getElementById('btn-density-normal');
            const compactBtn = document.getElementById('btn-density-compact');
            if (normalBtn && compactBtn) {
                normalBtn.classList.toggle('active', density === 'normal');
                compactBtn.classList.toggle('active', density === 'compact');
            }
        }
    });

    const tab = await dbLoad(user.uid, 'ui:tab', 'habit');
    switchTab(tab);

    await updateNotificationBadge();
    await refreshNotificationSchedules();
    

    // Initial check for reminders on page boot
    setTimeout(() => {
        checkAndTriggerHabitAlert(user.uid);
        checkAndTriggerExamAlert(user.uid);
    }, 3000);

    // Run active background reminders interval check every 60s
    setInterval(() => {
        checkAndTriggerHabitAlert(user.uid);
        checkAndTriggerExamAlert(user.uid);
    }, 60000);
}

function switchTab(t) {
    const uid = currentUser?.uid;
    ['habit', 'power', 'sched', 'notes'].forEach(id => {
        const panel = document.getElementById(`panel-${id}`);
        const tab = document.getElementById(`tab-${id}`);
        if (panel) panel.classList.toggle('active', id === t);
        if (tab) tab.classList.toggle('active', id === t);
    });
    document.body.className = t === 'sched' ? 'sched-mode' : '';
    // BUG-5 Fix: Fire-and-forget — never block tab switching on a DB save
    if (uid) dbSave(uid, 'ui:tab', t).catch(() => {});
    
    if (t === 'sched' && uid) renderSched(uid);
    if (t === 'habit' && uid) {
        renderHabits(uid);
        setupScoreTracker(uid);
    }
    if (t === 'power' && uid) initPowerHub(uid);
    if (t === 'notes' && uid) initDiary(uid);
}

function setupEventListeners() {
    // Auth Tabs
    document.getElementById('at-login').addEventListener('click', () => showAuthTab('login'));
    document.getElementById('at-register').addEventListener('click', () => showAuthTab('register'));

    // Login
    document.getElementById('l-btn').addEventListener('click', async () => {
        const email = document.getElementById('l-email').value;
        const pass = document.getElementById('l-pass').value;
        const err = document.getElementById('l-err');
        try {
            const user = await doLogin(email, pass);
            await bootApp(user);
        } catch (e) { err.textContent = e.message; }
    });

    // Register
    document.getElementById('r-btn').addEventListener('click', async () => {
        const name = document.getElementById('r-name').value;
        const email = document.getElementById('r-email').value;
        const pass = document.getElementById('r-pass').value;
        const err = document.getElementById('r-err');
        try {
            const user = await doRegister(name, email, pass);
            await bootApp(user);
        } catch (e) { err.textContent = e.message; }
    });

    // Google Login
    document.getElementById('g-btn').addEventListener('click', async () => {
        const err = document.getElementById('l-err');
        try {
            await loginWithGoogle();
        } catch (e) { err.textContent = e.message; }
    });



    // Enter key for auth
    document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('l-btn').click(); });
    document.getElementById('r-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('r-btn').click(); });

    // Main Tabs
    document.getElementById('tab-habit').addEventListener('click', () => switchTab('habit'));
    document.getElementById('tab-power').addEventListener('click', () => switchTab('power'));
    document.getElementById('tab-sched').addEventListener('click', () => switchTab('sched'));
    document.getElementById('tab-notes').addEventListener('click', () => switchTab('notes'));

    // Habit Panel
    document.getElementById('prev').addEventListener('click', () => { 
        setWeekOff(weekOff - 1); 
        if (currentUser) renderHabits(currentUser.uid); 
    });
    document.getElementById('next').addEventListener('click', () => { 
        setWeekOff(weekOff + 1); 
        if (currentUser) renderHabits(currentUser.uid); 
    });
    
    // Weekly Rating listeners removed since section is gone.
    // Diary replaces this functionality.
    
    // save-r listener removed since section is gone.

    // Schedule Panel — day selector buttons
    document.querySelectorAll('.sched-day-btn').forEach(btn => {
        btn.addEventListener('click', () => { 
            setCurDay(parseInt(btn.dataset.day)); 
            if (currentUser) renderSched(currentUser.uid); 
        });
    });
    
    document.getElementById('add-slot').addEventListener('click', async () => {
        if (!currentUser) return;
        const slots = await getSlots(currentUser.uid, curDay);
        const id = 'act-' + Math.random().toString(36).substr(2, 5);
        slots.push({ time: '', label: 'New Activity', type: 'habit', id });
        await setSlots(currentUser.uid, curDay, slots); 
        renderSched(currentUser.uid);
        renderHabits(currentUser.uid);
    });

    // Smart NLP Add
    const nlpInput = document.getElementById('nlp-input');
    const nlpBtn = document.getElementById('nlp-add-btn');
    // NLP logic lives in schedule.js via renderSched — wire up here for module access
    if (nlpBtn && nlpInput) {
        const doNlpAdd = async () => {
            const text = nlpInput.value.trim();
            if (!text || !currentUser) return;
            // Simple parse inline (mirrors schedule.js parseNLP)
            const rangePatterns = [
                /(\d{1,2}(?::\d{2})?)\s*(?:to|-|–)\s*(\d{1,2}(?::\d{2})?)\s*(am|pm|morning|evening|night|noon)?/i,
            ];
            let time = '', label = text;
            for (const pat of rangePatterns) {
                const m = text.match(pat);
                if (m) {
                    const [full, start, end, period = ''] = m;
                    const lc = period.toLowerCase();
                    const sfx = ['evening','night','pm'].includes(lc) ? 'PM' :
                        text.toLowerCase().includes('evening') || text.toLowerCase().includes('pm') ? 'PM' : 'AM';
                    const fmt = t => t.includes(':') ? t : t + ':00';
                    time = `${fmt(start)}–${fmt(end)} ${sfx}`;
                    label = text.replace(full, '').replace(/\bat\b/i, '').replace(/\s+/g, ' ').trim();
                    break;
                }
            }
            const lc2 = label.toLowerCase();
            let type = 'everyday';
            if (/college|class|lecture|lab/.test(lc2)) type = 'college';
            else if (/weekend|sat|sun/.test(lc2)) type = 'weekend';
            else if (/holiday|off|rest day/.test(lc2)) type = 'holiday';
            const id2 = label.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 8) || 'custom';
            const slots = await getSlots(currentUser.uid, curDay);
            slots.push({ time, label: label || 'New Activity', type, id: id2 });
            await setSlots(currentUser.uid, curDay, slots);
            nlpInput.value = '';
            await renderSched(currentUser.uid);
            await renderHabits(currentUser.uid);
        };
        nlpBtn.addEventListener('click', doNlpAdd);
        nlpInput.addEventListener('keydown', e => { if (e.key === 'Enter') doNlpAdd(); });
    }
    
    document.getElementById('reset-sched').addEventListener('click', async () => {
        if (!currentUser) return;
        if (!confirm(`Reset ${DAY_N[curDay]} to defaults?`)) return;
        const defaults = defSlots(curDay);
        S['sched:' + curDay] = defaults;
        await setSlots(currentUser.uid, curDay, defaults);
        await renderSched(currentUser.uid);
        await renderHabits(currentUser.uid);
        showToast('Reset to defaults ✓');
    });

    // Premium Customizer Theme Buttons
    document.querySelectorAll('.theme-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const theme = btn.dataset.theme;
            document.querySelectorAll('.theme-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            document.body.setAttribute('data-theme', theme);
            localStorage.setItem('ui:theme', theme);
            showToast(`Theme changed: ${btn.title} ✓`);
            if (currentUser) dbSave(currentUser.uid, 'ui:theme', theme).catch(() => {});
        });
    });

    // Premium Customizer UI Density
    const normalBtn = document.getElementById('btn-density-normal');
    const compactBtn = document.getElementById('btn-density-compact');
    if (normalBtn && compactBtn) {
        normalBtn.addEventListener('click', () => {
            normalBtn.classList.add('active');
            compactBtn.classList.remove('active');
            document.body.classList.remove('compact-mode');
            localStorage.setItem('ui:density', 'normal');
            if (currentUser) dbSave(currentUser.uid, 'ui:density', 'normal').catch(() => {});
            showToast('Density: Standard Layout ✓');
        });
        compactBtn.addEventListener('click', () => {
            normalBtn.classList.remove('active');
            compactBtn.classList.add('active');
            document.body.classList.add('compact-mode');
            localStorage.setItem('ui:density', 'compact');
            if (currentUser) dbSave(currentUser.uid, 'ui:density', 'compact').catch(() => {});
            showToast('Density: High-density Compact Mode ✓');
        });
    }

    // Intelligent Notifications Checkboxes & Controls
    const chk330 = document.getElementById('chk-330-alert');
    if (chk330) {
        chk330.addEventListener('change', async () => {
            localStorage.setItem('alert:330', chk330.checked);
            showToast(`3:30 AM alerts ${chk330.checked ? 'active 🔔' : 'disabled'}`);
            await refreshNotificationSchedules();
        });
    }

    const chkExam = document.getElementById('chk-exam-alert');
    if (chkExam) {
        chkExam.addEventListener('change', async () => {
            localStorage.setItem('alert:exam', chkExam.checked);
            showToast(`Exam-day alerts ${chkExam.checked ? 'active 📝' : 'disabled'}`);
            await refreshNotificationSchedules();
        });
    }

    const enableNotiBtn = document.getElementById('btn-enable-noti');
    const testNotiBtn = document.getElementById('btn-test-noti');
    if (enableNotiBtn) {
        enableNotiBtn.addEventListener('click', async () => {
            const badge = document.getElementById('noti-status');
            if (badge?.textContent === 'DENIED') {
                const opened = await openNotificationSettings();
                if (!opened) {
                    showToast('Enable notifications in Android Settings > Apps > BOBBY.OS > Notifications');
                }
                return;
            }
            await requestNotificationPermission();
        });
    }
    if (testNotiBtn) {
        testNotiBtn.addEventListener('click', () => {
            if (currentUser) {
                triggerTestNotification(currentUser.uid);
            } else {
                showToast('Please log in first!');
            }
        });
    }
}

function showAuthTab(t) {
    document.getElementById('form-login').style.display = t === 'login' ? 'block' : 'none';
    document.getElementById('form-register').style.display = t === 'register' ? 'block' : 'none';
    document.getElementById('at-login').classList.toggle('active', t === 'login');
    document.getElementById('at-register').classList.toggle('active', t === 'register');
    document.getElementById('l-err').textContent = '';
    document.getElementById('r-err').textContent = '';
}

function updateTheme() {
    const h = new Date().getHours();
    let theme = 'night';
    if (h >= 5 && h < 12) theme = 'morning';
    else if (h >= 12 && h < 18) theme = 'afternoon';
    document.body.setAttribute('data-theme', theme);
}

window.addEventListener('DOMContentLoaded', init);
