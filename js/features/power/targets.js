import { dbLoad, dbSave } from '../../db.js';
import { showToast } from '../../utils.js';

const DEFAULT_TARGETS = [
  { id: '1', text: 'Solve 3 CP Problems', done: false },
  { id: '2', text: 'Refactor Auth Module', done: false },
  { id: '3', text: 'Leg Day Workout', done: false },
];

export async function setupTargets(uid) {
  if (!document.querySelector('.p-target-list')) return;
  const targets = await dbLoad(uid, 'power:targets', DEFAULT_TARGETS);
  renderTargets(uid, targets);
}

function renderTargets(uid, targets) {
  const list = document.querySelector('.p-target-list');
  if (!list) return;
  list.innerHTML = '';

  targets.forEach((target, index) => {
    const item = document.createElement('li');
    item.style.cssText = `opacity:${target.done ? '0.5' : '1'}; text-decoration:${target.done ? 'line-through' : 'none'}; display:flex; justify-content:space-between;`;

    const left = document.createElement('div');
    left.style.cssText = 'display:flex; align-items:center; gap:12px;';
    const checkbox = document.createElement('div');
    checkbox.className = `p-chk${target.done ? ' checked' : ''}`;
    if (target.done)
      checkbox.style.cssText = 'background:var(--accent); border-color:var(--accent);';
    checkbox.onclick = async () => {
      target.done = !target.done;
      await dbSave(uid, 'power:targets', targets);
      renderTargets(uid, targets);
      if (target.done) showToast('Target Acquired ðŸŽ¯');
    };
    const text = document.createElement('span');
    text.textContent = target.text;
    left.append(checkbox, text);

    const remove = document.createElement('button');
    remove.innerHTML = 'âœ•';
    remove.style.cssText =
      'background:none; border:none; color:var(--dim); cursor:pointer; font-size:12px; padding:0 5px; opacity:0.5;';
    remove.onmouseover = () => {
      remove.style.color = '#ff5572';
      remove.style.opacity = '1';
    };
    remove.onmouseout = () => {
      remove.style.color = 'var(--dim)';
      remove.style.opacity = '0.5';
    };
    remove.onclick = async () => {
      targets.splice(index, 1);
      await dbSave(uid, 'power:targets', targets);
      renderTargets(uid, targets);
    };
    item.append(left, remove);
    list.appendChild(item);
  });

  if (!document.getElementById('p-target-add-wrap')) {
    const wrap = document.createElement('div');
    wrap.id = 'p-target-add-wrap';
    wrap.className = 'p-add-row';
    wrap.innerHTML =
      '<input type="text" id="p-target-input" placeholder="Add new target..."><button id="p-target-add-btn">+</button>';
    list.parentElement.appendChild(wrap);
    document.getElementById('p-target-add-btn').onclick = () => addTarget(uid, targets);
    document.getElementById('p-target-input').onkeydown = (event) => {
      if (event.key === 'Enter') addTarget(uid, targets);
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
  showToast('New objective set ðŸš€');
}
