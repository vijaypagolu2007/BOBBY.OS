import { dbLoad, dbSave } from '../../db.js';
import { showToast } from '../../utils.js';
import { markHabitDoneToday } from '../../habits.js';
import { buildHabits } from '../../data.js';

let pomodoroInterval;
let timeLeft = 25 * 60;
let isRunning = false;

export async function setupPomodoro(uid) {
  const display = document.getElementById('p-timer');
  const startBtn = document.getElementById('p-start');
  const resetBtn = document.getElementById('p-reset');
  const habitSelect = document.getElementById('p-habit-select');
  const durationSel = document.getElementById('p-duration');

  if (!display || !startBtn || !resetBtn) return;

  if (habitSelect) {
    const habits = await buildHabits(uid);
    habits.forEach((habit) => {
      if (!habit.group) {
        const option = document.createElement('option');
        option.value = habit.id;
        option.textContent = `${habit.icon} ${habit.name}`;
        habitSelect.appendChild(option);
      }
    });
  }

  const savedMins = await dbLoad(uid, 'power:pomo_duration', 25);
  timeLeft = savedMins * 60;
  if (durationSel) durationSel.value = String(savedMins);

  const updateDisplay = () => {
    const minutes = Math.floor(timeLeft / 60);
    const seconds = timeLeft % 60;
    display.textContent = `${minutes.toString().padStart(2, '0')}:${seconds
      .toString()
      .padStart(2, '0')}`;
  };

  const resetPomodoro = () => {
    clearInterval(pomodoroInterval);
    const minutes = durationSel ? parseInt(durationSel.value) : 25;
    timeLeft = minutes * 60;
    isRunning = false;
    startBtn.textContent = 'Start Session';
    updateDisplay();
  };

  if (durationSel) {
    durationSel.addEventListener('change', async () => {
      timeLeft = parseInt(durationSel.value) * 60;
      if (isRunning) {
        clearInterval(pomodoroInterval);
        isRunning = false;
        startBtn.textContent = 'Start Session';
      }
      await dbSave(uid, 'power:pomo_duration', parseInt(durationSel.value));
      updateDisplay();
    });
  }

  updateDisplay();
  startBtn.onclick = () => {
    if (isRunning) {
      clearInterval(pomodoroInterval);
      startBtn.textContent = 'Start Session';
      isRunning = false;
      return;
    }

    isRunning = true;
    startBtn.textContent = 'Pause';
    pomodoroInterval = setInterval(async () => {
      timeLeft--;
      updateDisplay();
      if (timeLeft <= 0) {
        clearInterval(pomodoroInterval);
        showToast('Focus Session Complete! ðŸ§˜');
        if (habitSelect?.value) {
          await markHabitDoneToday(uid, habitSelect.value);
          showToast('Habit automatically logged ðŸ“ˆ');
        }
        resetPomodoro();
      }
    }, 1000);
  };

  resetBtn.onclick = resetPomodoro;
}
