import { Capacitor } from '@capacitor/core';
import { App } from '@capacitor/app';
import { LocalNotifications } from '@capacitor/local-notifications';
import { buildHabits, EXAM_D } from './data.js';
import { dbLoad } from './db.js';
import { ck, iso, today, wkDates, wkKey, showToast } from './utils.js';

// ══════════════════════════════════════════════════════
//  INTELLIGENT NOTIFICATIONS MODULE
// ══════════════════════════════════════════════════════

const NOTI_CHANNEL_ID = 'bobby-os-alerts';
const HABIT_NOTI_ID = 3301;
const EXAM_NOTI_ID = 6301;
const isNative = Capacitor.isNativePlatform();

const ALERT_KEYS = {
  habit330: 'alert:sent:habit330',
  examDay: 'alert:sent:exam',
};

function alertSentKey(type) {
  return `${ALERT_KEYS[type]}:${today()}`;
}

function wasAlertSentToday(type) {
  return localStorage.getItem(alertSentKey(type)) === '1';
}

function markAlertSentToday(type) {
  localStorage.setItem(alertSentKey(type), '1');
}

function supportsWebNotifications() {
  return typeof Notification !== 'undefined';
}

async function getNotificationPermission() {
  if (isNative) {
    const status = await LocalNotifications.checkPermissions();
    return status.display;
  }
  if (!supportsWebNotifications()) return 'unsupported';
  return Notification.permission;
}

async function ensureNativeChannel() {
  if (!isNative) return;
  try {
    await LocalNotifications.createChannel({
      id: NOTI_CHANNEL_ID,
      name: 'BOBBY.OS Alerts',
      description: 'Habit and exam reminders',
      importance: 5,
      vibration: true,
      visibility: 1,
    });
  } catch (e) {
    console.warn('BOBBY.OS: notification channel setup skipped', e);
  }
}

async function scheduleNativeDailyAlerts() {
  if (!isNative) return;

  const chk330 = document.getElementById('chk-330-alert');
  const chkExam = document.getElementById('chk-exam-alert');
  const habitEnabled = !chk330 || chk330.checked;
  const examEnabled = !chkExam || chkExam.checked;

  try {
    await LocalNotifications.cancel({
      notifications: [{ id: HABIT_NOTI_ID }, { id: EXAM_NOTI_ID }],
    });

    const notifications = [];

    if (habitEnabled) {
      notifications.push({
        id: HABIT_NOTI_ID,
        title: '🌌 BOBBY.OS // Habit Check',
        body: 'It is 3:30 AM. Open BOBBY.OS to review incomplete habits for today.',
        channelId: NOTI_CHANNEL_ID,
        schedule: {
          on: { hour: 3, minute: 30 },
          repeats: true,
          allowWhileIdle: true,
        },
      });
    }

    if (examEnabled) {
      notifications.push({
        id: EXAM_NOTI_ID,
        title: '📝 BOBBY.OS // Exam Day',
        body: "Good morning. Open BOBBY.OS to see today's exam schedule.",
        channelId: NOTI_CHANNEL_ID,
        schedule: {
          on: { hour: 6, minute: 30 },
          repeats: true,
          allowWhileIdle: true,
        },
      });
    }

    if (notifications.length > 0) {
      await LocalNotifications.schedule({ notifications });
    }
  } catch (e) {
    console.error('BOBBY.OS: failed to schedule native alerts', e);
  }
}

export async function loadExamDates(uid) {
  EXAM_D.clear();
  const exams = await dbLoad(uid, 'exams:list', []);
  exams.forEach((exam) => {
    if (exam?.date) EXAM_D.add(exam.date);
  });
  return exams;
}

export async function updateNotificationBadge() {
  const badge = document.getElementById('noti-status');
  const enableBtn = document.getElementById('btn-enable-noti');
  if (!badge) return;

  const state = await getNotificationPermission();

  if (state === 'unsupported') {
    badge.textContent = 'UNSUPPORTED';
    badge.style.background = 'var(--red-lo)';
    badge.style.color = 'var(--red)';
    if (enableBtn) enableBtn.disabled = true;
    return;
  }

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
      enableBtn.textContent = isNative ? 'Open App Settings' : 'Blocked by Browser';
      enableBtn.disabled = false;
    }
  } else {
    badge.textContent = 'DISABLED';
    badge.style.background = 'var(--dim)';
    badge.style.color = 'var(--muted)';
    if (enableBtn) {
      enableBtn.textContent = 'Enable Push Alerts';
      enableBtn.disabled = false;
      enableBtn.style.opacity = '1';
    }
  }
}

export async function requestNotificationPermission() {
  if (isNative) {
    await ensureNativeChannel();
    const status = await LocalNotifications.requestPermissions();
    await updateNotificationBadge();

    if (status.display === 'granted') {
      await scheduleNativeDailyAlerts();
      showToast('Notifications enabled successfully! 🔔');
      await triggerLocalNotification('BOBBY.OS // Intelligence Active', {
        body: 'You will now receive morning exam reminders and 3:30 AM habit alerts.',
        tag: 'bobby-os-welcome',
      });
      return;
    }

    showToast('Notification permission was denied. Enable it in Android Settings.');
    return;
  }

  if (!supportsWebNotifications()) {
    showToast('Push notifications are not supported on this browser.');
    return;
  }

  const permission = await Notification.requestPermission();
  await updateNotificationBadge();

  if (permission === 'granted') {
    showToast('Notifications enabled successfully! 🔔');
    triggerLocalNotification('BOBBY.OS // Intelligence Active', {
      body: 'You will now receive morning exam reminders and 3:30 AM habit alerts.',
      icon: '/pwa-192x192.png',
      tag: 'bobby-os-welcome',
    });
  } else {
    showToast('Notification permission was denied.');
  }
}

export async function openNotificationSettings() {
  if (!isNative) return false;

  try {
    await App.openUrl({ url: 'app-settings:' });
    return true;
  } catch (e) {
    console.warn('BOBBY.OS: unable to open app settings', e);
    return false;
  }
}

export async function triggerLocalNotification(title, options = {}) {
  const permission = await getNotificationPermission();
  if (permission !== 'granted') return;

  if (isNative) {
    await ensureNativeChannel();
    const id = Math.floor(Date.now() % 100000) + 1;
    await LocalNotifications.schedule({
      notifications: [
        {
          id,
          title,
          body: options.body || '',
          channelId: NOTI_CHANNEL_ID,
          schedule: { at: new Date(Date.now() + 500) },
          extra: { tag: options.tag || 'bobby-os-notification' },
        },
      ],
    });
    return;
  }

  const defaultOptions = {
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [200, 100, 200],
    tag: 'bobby-os-notification',
  };

  if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
    navigator.serviceWorker.ready
      .then((registration) => {
        registration.showNotification(title, { ...defaultOptions, ...options });
      })
      .catch(() => {
        new Notification(title, { ...defaultOptions, ...options });
      });
  } else {
    new Notification(title, { ...defaultOptions, ...options });
  }
}

// 3:30 AM habit completeness check
export async function checkAndTriggerHabitAlert(uid, force = false) {
  if ((await getNotificationPermission()) !== 'granted') return;

  const chk330 = document.getElementById('chk-330-alert');
  if (chk330 && !chk330.checked && !force) return;

  const now = new Date();
  if (!force) {
    const isExactly330 = now.getHours() === 3 && now.getMinutes() === 30;
    if (!isExactly330) return;
    if (wasAlertSentToday('habit330')) return;
  }

  try {
    const H = await buildHabits(uid);
    const habitData = await dbLoad(uid, 'habits', {});
    const dates = wkDates(0);
    const tStr = today();
    const di = dates.findIndex((d) => iso(d) === tStr);

    if (di === -1) return;

    const isWE = di >= 5;
    const wk = wkKey(0);
    const incomplete = [];

    H.forEach((h) => {
      if (h.group) return;
      const avail = h.freq === 'all' || (h.freq === 'wd' && !isWE) || (h.freq === 'we' && isWE);
      if (!avail) return;

      const val = habitData[ck(h.id, wk, di)] || 0;
      if (val === 0) {
        incomplete.push(h.name);
      }
    });

    if (incomplete.length > 0) {
      await triggerLocalNotification('🌌 BOBBY.OS // Incomplete Habits', {
        body: `It is 3:30 AM. You still have incomplete habits for today: ${incomplete.join(', ')}. Keep up the streak! 🔥`,
        tag: 'bobby-habit-alert',
      });
      if (!force) markAlertSentToday('habit330');
    } else if (force) {
      await triggerLocalNotification('🌌 BOBBY.OS // All Habits Complete!', {
        body: 'Perfect score today! You are an Elite performer. ⚡',
        tag: 'bobby-habit-alert',
      });
    } else {
      markAlertSentToday('habit330');
    }
  } catch (e) {
    console.error('Error checking habits for notification:', e);
  }
}

// 6:30 AM exam-day alert
export async function checkAndTriggerExamAlert(uid, force = false) {
  if ((await getNotificationPermission()) !== 'granted') return;

  const chkExam = document.getElementById('chk-exam-alert');
  if (chkExam && !chkExam.checked && !force) return;

  const now = new Date();
  if (!force) {
    const isMorningAlert = now.getHours() === 6 && now.getMinutes() === 30;
    if (!isMorningAlert) return;
    if (wasAlertSentToday('examDay')) return;
  }

  try {
    const exams = await loadExamDates(uid);
    const tStr = today();
    const todaysExams = exams.filter((exam) => exam.date === tStr);

    if (todaysExams.length === 0) {
      if (force) {
        await triggerLocalNotification('🌌 BOBBY.OS // No Exam Today', {
          body: 'No exams are scheduled for today. Add dates under exams:list to enable exam-day alerts.',
          tag: 'bobby-exam-alert',
        });
      }
      return;
    }

    const paperCount = todaysExams.reduce((sum, exam) => sum + (exam.papers?.length || 1), 0);
    const paperList = todaysExams.flatMap((exam) =>
      (exam.papers || []).map(
        (paper) => `${paper.code || 'Exam'}${paper.slot ? ` (${paper.slot})` : ''}`
      )
    );
    const summary =
      paperList.length > 0
        ? paperList.join(', ')
        : `${paperCount} paper${paperCount > 1 ? 's' : ''}`;

    await triggerLocalNotification('📝 BOBBY.OS // Exam Day Alert', {
      body: `Good luck today! You have ${paperCount} exam paper${paperCount > 1 ? 's' : ''}: ${summary}. Stay focused. ⚡`,
      tag: 'bobby-exam-alert',
    });

    if (!force) markAlertSentToday('examDay');
  } catch (e) {
    console.error('Error checking exams for notification:', e);
  }
}

export async function refreshNotificationSchedules() {
  if ((await getNotificationPermission()) !== 'granted') return;
  if (isNative) await scheduleNativeDailyAlerts();
}

// Immediate mock trigger for habit and exam alerts
export async function triggerTestNotification(uid) {
  if ((await getNotificationPermission()) !== 'granted') {
    showToast('Please enable push alerts first!');
    return;
  }

  showToast('Firing Test Alarms... ⚡');

  await triggerLocalNotification('🧪 BOBBY.OS // Test Alarm Active', {
    body: 'System notification pipes verified. Testing 3:30 AM habit and exam-day alerts...',
    tag: 'bobby-test',
  });

  setTimeout(() => {
    checkAndTriggerHabitAlert(uid, true);
  }, 1200);

  setTimeout(() => {
    checkAndTriggerExamAlert(uid, true);
  }, 2400);
}
