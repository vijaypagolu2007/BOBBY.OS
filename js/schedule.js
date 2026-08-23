import { DAY_N, TYPES, getSlots, setSlots, buildHabits } from './data.js';
import { S } from './db.js';
import { renderHabits } from './habits.js';

export let curDay = 0;
export function setCurDay(v) {
  curDay = v;
}

// Color mapping for each slot type
const TYPE_STYLE = {
  everyday: { color: '#6c63ff', bg: 'rgba(108,99,255,0.12)', label: 'Everyday' },
  college: { color: '#38bdf8', bg: 'rgba(56,189,248,0.12)', label: 'College' },
  weekend: { color: '#ffbe3d', bg: 'rgba(255,190,61,0.12)', label: 'Weekends' },
  holiday: { color: '#20d68a', bg: 'rgba(32,214,138,0.10)', label: 'Holiday' },
};

function getTypeStyle(type) {
  return TYPE_STYLE[type] || TYPE_STYLE.free;
}

/** Build a single editable slot card element */
function buildSlotCard(slot, idx, slots, uid) {
  const ts = getTypeStyle(slot.type);

  const card = document.createElement('div');
  card.className = 'sched-slot-card';
  card.style.borderLeftColor = ts.color;

  // ── Left: type badge + time ──────────────────────────────
  const left = document.createElement('div');
  left.className = 'ssc-left';

  const badge = document.createElement('span');
  badge.className = 'ssc-badge';
  badge.textContent = ts.label.toUpperCase();
  badge.style.color = ts.color;
  badge.style.background = ts.bg;

  const timeEl = document.createElement('div');
  timeEl.className = 'ssc-time';
  timeEl.textContent = slot.time || 'No time set';
  timeEl.title = 'Click to edit time';
  makeInlineEditable(timeEl, slot.time, 'e.g. 6:00–7:00 AM', (val) => {
    slots[idx].time = val;
    timeEl.textContent = val || 'No time set';
    syncSave(uid, slots);
  });

  left.append(badge, timeEl);

  // ── Center: label ────────────────────────────────────────
  const center = document.createElement('div');
  center.className = 'ssc-center';

  const label = document.createElement('div');
  label.className = 'ssc-label';
  label.textContent = slot.label || 'Unnamed Activity';
  label.title = 'Click to edit name';
  makeInlineEditable(label, slot.label, 'Activity name', (val) => {
    slots[idx].label = val;
    label.textContent = val || 'Unnamed Activity';
    if (slots[idx].type === 'habit' && !slots[idx].id) {
      slots[idx].id =
        val
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 8) || 'act';
    }
    syncSave(uid, slots);
  });

  center.append(label);

  // ── Right: type selector + delete ───────────────────────
  const right = document.createElement('div');
  right.className = 'ssc-right';

  const sel = document.createElement('select');
  sel.className = 'ssc-type-sel';
  TYPES.forEach((t) => {
    const o = document.createElement('option');
    o.value = t.v;
    o.textContent = t.l;
    o.selected = slot.type === t.v;
    sel.appendChild(o);
  });
  sel.addEventListener('change', () => {
    slots[idx].type = sel.value;
    if (sel.value === 'habit' && !slots[idx].id) {
      slots[idx].id =
        (slots[idx].label || 'habit')
          .toLowerCase()
          .replace(/[^a-z0-9]/g, '')
          .slice(0, 8) || 'act';
    }
    // Update card appearance
    const newTs = getTypeStyle(sel.value);
    card.style.borderLeftColor = newTs.color;
    badge.textContent = newTs.label.toUpperCase();
    badge.style.color = newTs.color;
    badge.style.background = newTs.bg;
    syncSave(uid, slots);
  });

  const del = document.createElement('button');
  del.className = 'ssc-del';
  del.textContent = '×';
  del.title = 'Remove slot';
  del.addEventListener('click', () => {
    slots.splice(idx, 1);
    syncSave(uid, slots);
    renderSched(uid);
  });

  right.append(sel, del);
  card.append(left, center, right);
  return card;
}

/** Makes an element click-to-edit inline */
function makeInlineEditable(el, initialValue, placeholder, onSave) {
  el.style.cursor = 'pointer';
  el.addEventListener('click', () => {
    if (el.querySelector('input')) return; // already editing

    const originalText = el.textContent;
    const input = document.createElement('input');
    input.value = initialValue || '';
    input.placeholder = placeholder;
    input.className = 'ssc-inline-input';
    el.textContent = '';
    el.appendChild(input);
    input.focus();
    input.select();

    const save = () => {
      const val = input.value.trim();
      onSave(val);
      el.textContent = val || originalText;
    };

    input.addEventListener('blur', save);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        save();
        input.blur();
      }
      if (e.key === 'Escape') {
        el.textContent = originalText;
      }
    });
  });
}

export async function renderSched(uid) {
  // Sync active day buttons
  document.querySelectorAll('.sched-day-btn').forEach((btn) => {
    btn.classList.toggle('active', parseInt(btn.dataset.day) === curDay);
  });

  const titleEl = document.getElementById('ed-title');
  if (titleEl) titleEl.textContent = DAY_N[curDay];

  const subEl = document.getElementById('ed-sub');
  if (subEl) subEl.textContent = curDay >= 5 ? 'Weekend — free day' : 'Weekday schedule';

  const list = document.getElementById('slots-list');
  if (!list) return;
  list.innerHTML = '';

  const slots = await getSlots(uid, curDay);

  if (slots.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'sched-empty';
    empty.innerHTML = '<span>No activities yet</span><p>Tap "+ Add" or use Smart Add below</p>';
    list.appendChild(empty);
  } else {
    slots.forEach((s, idx) => {
      list.appendChild(buildSlotCard(s, idx, slots, uid));
    });
  }

  await renderSyncPreview(uid);
}

export async function syncSave(uid, slots) {
  S['sched:' + curDay] = slots;
  await setSlots(uid, curDay, slots);
  await renderSyncPreview(uid);
  renderHabits(uid).catch(() => {});
}

export async function renderSyncPreview(uid) {
  const H = await buildHabits(uid);
  const wrap = document.getElementById('sync-wrap');
  if (!wrap) return;
  wrap.innerHTML = '';

  H.filter((h) => !h.group).forEach((h) => {
    const card = document.createElement('div');
    card.className = 'sync-card';
    const tgC =
      h.freq === 'wd'
        ? 'rgba(108,99,255,0.13)'
        : h.freq === 'we'
          ? 'rgba(255,190,61,0.13)'
          : 'rgba(32,214,138,0.1)';
    const tgX = h.freq === 'wd' ? '#6c63ff' : h.freq === 'we' ? '#ffbe3d' : '#20d68a';
    const tgL = h.freq === 'wd' ? 'Mon–Fri' : h.freq === 'we' ? 'Weekends' : 'Every day';
    card.innerHTML = `<div class="sc-icon">${h.icon}</div><div class="sc-name">${h.name}</div><div class="sc-time">${h.time}</div><span class="sc-freq" style="background:${tgC};color:${tgX}">${tgL}</span>`;
    wrap.appendChild(card);
  });
}
