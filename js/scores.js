import { dbLoad, dbSave } from './db.js';
import { showToast } from './utils.js';
import { renderScoreChart } from './charts.js';

export async function setupScoreTracker(uid) {
  const semSelect = document.getElementById('score-sem-select');
  const addSemBtn = document.getElementById('score-add-sem-btn');
  const delSemBtn = document.getElementById('score-del-sem-btn');
  const addSubBtn = document.getElementById('score-add-sub-btn');

  if (!semSelect || !addSemBtn || !delSemBtn || !addSubBtn) return;

  if (!semSelect.dataset.init) {
    semSelect.dataset.init = '1';

    semSelect.addEventListener('change', () => {
      renderScoreTracker(uid);
    });

    addSemBtn.addEventListener('click', async () => {
      const semName = prompt('Enter Semester Name (e.g. Semester 1, Semester 2):');
      if (!semName) return;
      const trimmed = semName.trim();
      if (!trimmed) return;

      const semData = await dbLoad(uid, 'exam:sem_scores', {});
      if (semData[trimmed]) {
        showToast('Semester already exists!');
        return;
      }
      semData[trimmed] = [];
      await dbSave(uid, 'exam:sem_scores', semData);

      await renderScoreTracker(uid, trimmed);
      showToast('Semester added ✓');
    });

    delSemBtn.addEventListener('click', async () => {
      const activeSem = semSelect.value;
      if (!activeSem) return;
      if (!confirm(`Are you sure you want to delete "${activeSem}" and all its scores?`)) return;

      const semData = await dbLoad(uid, 'exam:sem_scores', {});
      delete semData[activeSem];
      await dbSave(uid, 'exam:sem_scores', semData);

      await renderScoreTracker(uid);
      showToast('Semester deleted ✓');
    });

    addSubBtn.addEventListener('click', async () => {
      const activeSem = semSelect.value;
      if (!activeSem) {
        showToast('Please add or select a semester first!');
        return;
      }
      const subNameIn = document.getElementById('score-sub-name');
      const subGradeIn = document.getElementById('score-sub-grade');
      if (!subNameIn || !subGradeIn) return;

      const name = subNameIn.value.trim();
      const gradeVal = parseFloat(subGradeIn.value);
      if (!name || isNaN(gradeVal) || gradeVal < 0 || gradeVal > 10) {
        showToast('Please enter a valid course name and GPA (0-10)!');
        return;
      }

      const semData = await dbLoad(uid, 'exam:sem_scores', {});
      if (!semData[activeSem]) semData[activeSem] = [];
      semData[activeSem].push({ name, grade: gradeVal });
      await dbSave(uid, 'exam:sem_scores', semData);

      subNameIn.value = '';
      subGradeIn.value = '';
      await renderScoreTracker(uid);
      showToast('Course grade added ✓');
    });
  }

  renderScoreTracker(uid);
}

export async function renderScoreTracker(uid, selectSemester = null) {
  const semSelect = document.getElementById('score-sem-select');
  const subjectsContainer = document.getElementById('score-subjects-container');
  if (!semSelect || !subjectsContainer) return;

  const semData = await dbLoad(uid, 'exam:sem_scores', {});
  const semNames = Object.keys(semData).sort((a, b) => {
    const numA = parseInt(a.replace(/\D/g, '')) || 0;
    const numB = parseInt(b.replace(/\D/g, '')) || 0;
    return numA - numB || a.localeCompare(b);
  });

  const previousSelection = selectSemester || semSelect.value;
  semSelect.innerHTML = '';

  if (semNames.length === 0) {
    const opt = document.createElement('option');
    opt.value = '';
    opt.textContent = '-- No Semesters --';
    semSelect.appendChild(opt);
    subjectsContainer.innerHTML =
      '<div style="text-align:center; padding:12px; color:var(--dim); font-size:11px;">Add a semester to start tracking.</div>';
    renderScoreChart(uid);
    return;
  }

  semNames.forEach((name) => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    if (name === previousSelection) {
      opt.selected = true;
    }
    semSelect.appendChild(opt);
  });

  const activeSem = semSelect.value;
  subjectsContainer.innerHTML = '';
  const subjects = semData[activeSem] || [];

  if (subjects.length === 0) {
    subjectsContainer.innerHTML =
      '<div style="text-align:center; padding:12px; color:var(--dim); font-size:11px;">No courses logged for this semester.</div>';
  } else {
    subjects.forEach((sub, idx) => {
      const row = document.createElement('div');
      row.style.cssText =
        'display:flex; justify-content:space-between; align-items:center; background:var(--surface); border:1px solid var(--border); border-radius:6px; padding:6px 10px; font-size:11px;';
      row.innerHTML = `
                <div style="font-weight:600; color:var(--text);">${sub.name}</div>
                <div style="display:flex; align-items:center; gap:10px;">
                    <div style="color:var(--yellow); font-family:var(--mono);">${sub.grade.toFixed(2)}</div>
                    <button class="score-sub-del" data-idx="${idx}" style="background:none; border:none; color:var(--red); cursor:pointer; font-size:11px; padding:0 2px;">✕</button>
                </div>
            `;
      row.querySelector('.score-sub-del').addEventListener('click', async () => {
        const currentSemData = await dbLoad(uid, 'exam:sem_scores', {});
        if (currentSemData[activeSem]) {
          currentSemData[activeSem].splice(idx, 1);
          await dbSave(uid, 'exam:sem_scores', currentSemData);
          renderScoreTracker(uid);
        }
      });
      subjectsContainer.appendChild(row);
    });
  }

  renderScoreChart(uid);
}
