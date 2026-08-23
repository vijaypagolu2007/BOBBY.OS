import { dbLoad, dbSave } from '../../db.js';
import { showToast } from '../../utils.js';

export async function setupNightShift(uid) {
  const actualEl = document.getElementById('p-sleep-actual');
  const efficiencyEl = document.getElementById('p-sleep-eff');
  const inputEl = document.getElementById('p-sleep-input');
  const addBtn = document.getElementById('p-sleep-add-btn');
  if (!actualEl || !inputEl || !addBtn) return;

  const sleepData = await dbLoad(uid, 'power:sleep', { actual: 0 });
  const updateSleepUI = (actual) => {
    actualEl.textContent = actual > 0 ? `${actual.toFixed(1)}h` : '--h';
    if (actual > 0) {
      const efficiency = Math.min(100, Math.round((actual / 8) * 100));
      efficiencyEl.textContent = `Efficiency: ${efficiency}%`;
      efficiencyEl.style.color =
        efficiency >= 85 ? '#20d68a' : efficiency >= 70 ? '#ffbe3d' : '#ff5572';
    } else {
      efficiencyEl.textContent = 'Efficiency: --%';
      efficiencyEl.style.color = 'var(--dim)';
    }
  };

  updateSleepUI(sleepData.actual);
  addBtn.onclick = async () => {
    const actual = parseFloat(inputEl.value);
    if (isNaN(actual) || actual <= 0 || actual > 24) return;
    sleepData.actual = actual;
    await dbSave(uid, 'power:sleep', sleepData);
    updateSleepUI(actual);
    inputEl.value = '';
    showToast('Sleep log updated ðŸŒ™');
  };
}
