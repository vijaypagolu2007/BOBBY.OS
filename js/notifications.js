import { buildHabits, EXAM_D } from './data.js';
import { dbLoad } from './db.js';
import { ck, iso, today, wkDates, wkKey, showToast } from './utils.js';
import { EXAMS } from './exams.js';

// ══════════════════════════════════════════════════════
//  INTELLIGENT NOTIFICATIONS MODULE
// ══════════════════════════════════════════════════════

export function updateNotificationBadge() {
    const badge = document.getElementById('noti-status');
    const enableBtn = document.getElementById('btn-enable-noti');
    if (!badge) return;

    if (!('Notification' in window)) {
        badge.textContent = 'UNSUPPORTED';
        badge.style.background = 'var(--red-lo)';
        badge.style.color = 'var(--red)';
        if (enableBtn) enableBtn.disabled = true;
        return;
    }

    const state = Notification.permission;
    if (state === 'granted') {
        badge.textContent = 'GRANTED';
        badge.style.background = 'var(--green-lo)';
        badge.style.color = 'var(--green)';
        if (enableBtn) {
            enableBtn.textContent = 'Alerts Active ✓';
            enableBtn.disabled = true;
            enableBtn.style.opacity = '0.7';
        }
    } else if (state === 'denied') {
        badge.textContent = 'DENIED';
        badge.style.background = 'var(--red-lo)';
        badge.style.color = 'var(--red)';
        if (enableBtn) {
            enableBtn.textContent = 'Blocked by Browser';
            enableBtn.disabled = true;
        }
    } else {
        badge.textContent = 'DISABLED';
        badge.style.background = 'var(--dim)';
        badge.style.color = 'var(--muted)';
        if (enableBtn) {
            enableBtn.textContent = 'Enable Push Alerts';
            enableBtn.disabled = false;
        }
    }
}

export async function requestNotificationPermission() {
    if (!('Notification' in window)) {
        showToast('Push notifications are not supported on this browser.');
        return;
    }

    const permission = await Notification.requestPermission();
    updateNotificationBadge();

    if (permission === 'granted') {
        showToast('Notifications enabled successfully! 🔔');
        triggerLocalNotification('BOBBY.OS // Intelligence Active', {
            body: 'You will now receive morning exam reminders and 3:30 AM habit alerts.',
            icon: '/pwa-192x192.png',
            tag: 'bobby-os-welcome'
        });
    } else {
        showToast('Notification permission was denied.');
    }
}

export function triggerLocalNotification(title, options = {}) {
    if (!('Notification' in window) || Notification.permission !== 'granted') {
        return;
    }

    const defaultOptions = {
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [200, 100, 200],
        tag: 'bobby-os-notification'
    };

    // Try service worker notification first (better background support)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
        navigator.serviceWorker.ready.then(registration => {
            registration.showNotification(title, { ...defaultOptions, ...options });
        }).catch(err => {
            new Notification(title, { ...defaultOptions, ...options });
        });
    } else {
        new Notification(title, { ...defaultOptions, ...options });
    }
}

// 3:30 AM habit completeness check
export async function checkAndTriggerHabitAlert(uid, force = false) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    // Check if 3:30 AM alerts toggle is checked
    const chk330 = document.getElementById('chk-330-alert');
    if (chk330 && !chk330.checked && !force) return;

    const now = new Date();
    // Only fire if it's 3:30 AM (or if forced via mock button)
    if (!force) {
        const isExactly330 = now.getHours() === 3 && now.getMinutes() === 30;
        if (!isExactly330) return;
    }

    try {
        const H = await buildHabits(uid);
        const habitData = await dbLoad(uid, 'habits', {});
        const dates = wkDates(0);
        const tStr = today();
        const di = dates.findIndex(d => iso(d) === tStr);

        if (di === -1) return;

        const isWE = di >= 5;
        const wk = wkKey(0);
        const incomplete = [];

        H.forEach(h => {
            if (h.group) return;
            const avail = h.freq === 'all' || (h.freq === 'wd' && !isWE) || (h.freq === 'we' && isWE);
            if (!avail) return;

            const val = habitData[ck(h.id, wk, di)] || 0;
            if (val === 0) {
                incomplete.push(h.name);
            }
        });

        if (incomplete.length > 0) {
            triggerLocalNotification('🌌 BOBBY.OS // Incomplete Habits', {
                body: `It is 3:30 AM. You still have incomplete habits for today: ${incomplete.join(', ')}. Keep up the streak! 🔥`,
                tag: 'bobby-habit-alert'
            });
        } else if (force) {
            triggerLocalNotification('🌌 BOBBY.OS // All Habits Complete!', {
                body: 'Perfect score today! You are an Elite performer. ⚡',
                tag: 'bobby-habit-alert'
            });
        }
    } catch (e) {
        console.error('Error checking habits for notification:', e);
    }
}

// Morning exam alerts check
export async function checkAndTriggerExamAlert(uid, force = false) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;

    const chkExam = document.getElementById('chk-exam-alert');
    if (chkExam && !chkExam.checked && !force) return;

    const now = new Date();
    // Morning check (e.g. 7:00 AM) or forced
    if (!force) {
        const isMorningCheck = now.getHours() === 7 && now.getMinutes() === 0;
        if (!isMorningCheck) return;
    }

    try {
        const tStr = today();
        const examToday = EXAMS.find(e => e.date === tStr);

        if (examToday && examToday.papers.length > 0) {
            const list = examToday.papers.map(p => `${p.code} (${p.time})`).join(', ');
            triggerLocalNotification('📝 BOBBY.OS // Exam Today!', {
                body: `Prepare your mind! You have ${examToday.papers.length} paper(s) today: ${list}. High Cognitive Load detected.`,
                tag: 'bobby-exam-alert'
            });
        } else if (force) {
            triggerLocalNotification('📝 BOBBY.OS // No Exams Today', {
                body: 'You have no exams today. Perfect time for deep code session or syllabus revision.',
                tag: 'bobby-exam-alert'
            });
        }
    } catch (e) {
        console.error('Error checking exams for notification:', e);
    }
}

// Immediate mock triggers for both habit and exam alerts
export async function triggerTestNotification(uid) {
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
        showToast('Please enable push alerts first!');
        return;
    }

    showToast('Firing Test Alarms... ⚡');
    
    // Trigger standard notifications instantly
    triggerLocalNotification('🧪 BOBBY.OS // Test Alarm Active', {
        body: 'System notification pipes verified. Testing 3:30 AM Habits & Exams alerts...',
        tag: 'bobby-test'
    });

    setTimeout(() => {
        checkAndTriggerHabitAlert(uid, true);
    }, 1200);

    setTimeout(() => {
        checkAndTriggerExamAlert(uid, true);
    }, 2400);
}
