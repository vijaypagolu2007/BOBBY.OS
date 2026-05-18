import { initAuth, checkSession, loginWithGoogle, doLogin, doRegister, doLogout, currentUser } from './auth.js';
import { auth } from './firebase.js';
import { dbLoad, dbSave, uKey, listenToUserData, DB, S } from './db.js';
import { renderHabits, weekOff, setWeekOff } from './habits.js';
import { renderSched, curDay, setCurDay } from './schedule.js';
import { renderExam, planDayOffset, setPlanDayOffset, addPlanRow, renderPlanForDate, setupAITimetable } from './exams.js';
import { renderNotes } from './notes.js';
import { wkKey, showToast } from './utils.js';
import { DAY_N, setSlots, defSlots, getSlots } from './data.js';
import { initPowerHub } from './power.js';
import { initDiary } from './diary.js';
import { initStudy } from './study.js';

async function init() {
    updateTheme();
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
    document.getElementById('top-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    // Real-time listener for data sync
    listenToUserData(user.uid, (data) => {
        const tab = data['ui:tab'] || 'habit';
        // Only re-render if we are in the same tab or it's a first load
        // This prevents flickering if needed, but for now we'll just refresh
        if (tab === 'sched') renderSched(user.uid);
        if (tab === 'habit') renderHabits(user.uid);
        if (tab === 'exam') renderExam(user.uid);
        if (tab === 'power') initPowerHub(user.uid);
        if (tab === 'study') initStudy(user.uid);
    });

    const tab = await dbLoad(user.uid, 'ui:tab', 'habit');
    switchTab(tab);
    
    // Initialize one-time UI modules
    setupAITimetable(user.uid);
}

function switchTab(t) {
    const uid = currentUser?.uid;
    ['habit', 'power', 'sched', 'exam', 'study', 'notes'].forEach(id => {
        const panel = document.getElementById(`panel-${id}`);
        const tab = document.getElementById(`tab-${id}`);
        if (panel) panel.classList.toggle('active', id === t);
        if (tab) tab.classList.toggle('active', id === t);
    });
    document.body.className = t === 'sched' ? 'sched-mode' : t === 'exam' ? 'exam-mode' : '';
    // BUG-5 Fix: Fire-and-forget — never block tab switching on a DB save
    if (uid) dbSave(uid, 'ui:tab', t).catch(() => {});
    
    if (t === 'sched' && uid) renderSched(uid);
    if (t === 'habit' && uid) renderHabits(uid);
    if (t === 'exam' && uid) renderExam(uid);
    if (t === 'power' && uid) initPowerHub(uid);
    if (t === 'study' && uid) initStudy(uid);
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

    document.getElementById('logout').addEventListener('click', async () => {
        await doLogout();
        location.reload();
    });

    // Enter key for auth
    document.getElementById('l-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('l-btn').click(); });
    document.getElementById('r-pass').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('r-btn').click(); });

    // Main Tabs
    document.getElementById('tab-habit').addEventListener('click', () => switchTab('habit'));
    document.getElementById('tab-power').addEventListener('click', () => switchTab('power'));
    document.getElementById('tab-sched').addEventListener('click', () => switchTab('sched'));
    document.getElementById('tab-exam').addEventListener('click', () => switchTab('exam'));
    document.getElementById('tab-study').addEventListener('click', () => switchTab('study'));
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

    // Schedule Panel
    document.querySelectorAll('.day-tab').forEach(tab => {
        tab.addEventListener('click', () => { 
            setCurDay(parseInt(tab.dataset.day)); 
            if (currentUser) renderSched(currentUser.uid); 
        });
    });
    
    document.getElementById('add-slot').addEventListener('click', async () => {
        if (!currentUser) return;
        const slots = await getSlots(currentUser.uid, curDay);
        // Generate a unique ID so it syncs to habits page
        const id = 'act-' + Math.random().toString(36).substr(2, 5);
        slots.push({ time: '', label: 'New Activity', type: 'habit', id });
        await setSlots(currentUser.uid, curDay, slots); 
        renderSched(currentUser.uid);
        renderHabits(currentUser.uid); // Trigger habit sync immediately
    });
    
    document.getElementById('sched-save').addEventListener('click', () => { 
        if (currentUser) {
            renderHabits(currentUser.uid); 
            showToast('Habit table refreshed ✓');
        }
    });
    
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

    // Exam Panel
    document.getElementById('plan-prev').addEventListener('click', () => { 
        setPlanDayOffset(planDayOffset - 1); 
        if (currentUser) renderPlanForDate(currentUser.uid); 
    });
    document.getElementById('plan-next').addEventListener('click', () => { 
        setPlanDayOffset(planDayOffset + 1); 
        if (currentUser) renderPlanForDate(currentUser.uid); 
    });
    document.getElementById('np-add').addEventListener('click', () => {
        if (currentUser) addPlanRow(currentUser.uid);
    });
    document.getElementById('np-desc').addEventListener('keydown', e => { 
        if (e.key === 'Enter' && currentUser) addPlanRow(currentUser.uid); 
    });
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
