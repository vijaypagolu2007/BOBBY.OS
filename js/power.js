import { setupCPTracker } from './features/power/codeforces.js';
import { setupAI } from './features/power/insights.js';
import { setupPomodoro } from './features/power/pomodoro.js';
import { setupNightShift } from './features/power/sleep.js';
import { setupTargets } from './features/power/targets.js';

/** Initializes the independent Power Hub feature modules. */
export function initPowerHub(uid) {
  setupPomodoro(uid);
  setupTargets(uid);
  setupNightShift(uid);
  setupCPTracker(uid);
  setupAI(uid);
}
