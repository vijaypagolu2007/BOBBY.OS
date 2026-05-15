import { initAuth, checkSession, loginWithGoogle, doLogin, doRegister, doLogout, currentUser } from './auth.js';
import { dbLoad, dbSave, uKey, listenToUserData, DB, S } from './db.js';
import { renderHabits, weekOff, setWeekOff } from './habits.js';
import { renderSched, curDay, setCurDay } from './schedule.js';
import { renderExam, planDayOffset, setPlanDayOffset, addPlanRow, renderPlanForDate } from './exams.js';
import { wkKey, showToast } from './utils.js';
import { DAY_N, setSlots, defSlots, getSlots } from './data.js';

async function init() {
    updateTheme();
    const loading = document.getElementById('loading-screen');
    const authScreen = document.getElementById('auth-screen');

    initAuth(async (user) => {
        if (user) {
            await bootApp(user);
            loading.style.display = 'none';
        } else {
            loading.style.display = 'none';
            authScreen.classList.add('show');
            document.getElementById('app').style.display = 'none';
        }
    });
    
    setupEventListeners();
}

async function bootApp(user) {
    document.getElementById('auth-screen').classList.remove('show');
    document.getElementById('app').style.display = 'block';
    document.getElementById('u-name').textContent = user.name;
    document.getElementById('u-avatar').textContent = user.name[0].toUpperCase();
    document.getElementById('top-date').textContent = new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'short' });

    // Real-time listener for data sync
    listenToUserData(user.uid, (data) => {
        const tab = data['ui:tab'] || 'habit';
        // Only re-render if we are in the same tab or it's a first load
        // This prevents flickering if needed, but for now we'll just refresh
        if (tab === 'sched') renderSched(user.uid);
        if (tab === 'habit') renderHabits(user.uid);
        if (tab === 'exam') renderExam(user.uid);
    });

    const tab = await dbLoad(user.uid, 'ui:tab', 'habit');
    switchTab(tab);
}

function switchTab(t) {
    const uid = currentUser?.uid;
    ['habit', 'sched', 'exam'].forEach(id => {
        const panel = document.getElementById(`panel-${id}`);
        const tab = document.getElementById(`tab-${id}`);
        if (panel) panel.classList.toggle('active', id === t);
        if (tab) tab.classList.toggle('active', id === t);
    });
    document.body.className = t === 'sched' ? 'sched-mode' : t === 'exam' ? 'exam-mode' : '';
    if (uid) dbSave(uid, 'ui:tab', t);
    
    if (t === 'sched' && uid) renderSched(uid);
    if (t === 'habit' && uid) renderHabits(uid);
    if (t === 'exam' && uid) renderExam(uid);
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
    document.getElementById('tab-sched').addEventListener('click', () => switchTab('sched'));
    document.getElementById('tab-exam').addEventListener('click', () => switchTab('exam'));

    // Habit Panel
    document.getElementById('prev').addEventListener('click', () => { 
        setWeekOff(weekOff - 1); 
        if (currentUser) renderHabits(currentUser.uid); 
    });
    document.getElementById('next').addEventListener('click', () => { 
        setWeekOff(weekOff + 1); 
        if (currentUser) renderHabits(currentUser.uid); 
    });
    
    document.querySelectorAll('#r-rating .r-btn').forEach(b => {
        b.addEventListener('click', async () => {
            if (!currentUser) return;
            const wk = wkKey(weekOff);
            const rv = await dbLoad(currentUser.uid, `review:${wk}`, {});
            rv.rating = parseInt(b.dataset.v);
            await dbSave(currentUser.uid, `review:${wk}`, rv);
            renderHabits(currentUser.uid);
        });
    });
    
    document.getElementById('save-r').addEventListener('click', async () => {
        if (!currentUser) return;
        const wk = wkKey(weekOff);
        const rv = await dbLoad(currentUser.uid, `review:${wk}`, {});
        ['r1', 'r2', 'r3', 'r4'].forEach(id => { rv[id] = document.getElementById(id).value; });
        await dbSave(currentUser.uid, `review:${wk}`, rv);
        showToast('Review saved ✓');
    });

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
        slots.push({ time: '', label: 'New Activity', type: 'free', id: '' });
        await setSlots(currentUser.uid, curDay, slots); 
        renderSched(currentUser.uid);
    });
    
    document.getElementById('sched-save').addEventListener('click', () => { 
        if (currentUser) renderHabits(currentUser.uid); 
        showToast('Saved & synced ✓'); 
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
