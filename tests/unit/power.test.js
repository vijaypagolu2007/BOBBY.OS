import { jest } from '@jest/globals';

const store = {};
const db = {
  dbLoad: jest.fn(async (uid, k, def) => (k in store ? store[k] : def)),
  dbSave: jest.fn(async (uid, k, v) => {
    store[k] = v;
  }),
};
const utils = { showToast: jest.fn() };
const habits = { markHabitDoneToday: jest.fn() };
const data = {
  buildHabits: jest.fn(async () => [
    { id: 'cp', icon: '💻', name: 'CP' },
    { id: 'grp', icon: '📁', name: 'Group', group: true },
  ]),
};

jest.unstable_mockModule('../../js/db.js', () => db);
jest.unstable_mockModule('../../js/utils.js', () => utils);
jest.unstable_mockModule('../../js/habits.js', () => habits);
jest.unstable_mockModule('../../js/data.js', () => data);

const { setupNightShift } = await import('../../js/features/power/sleep.js');
const { setupTargets } = await import('../../js/features/power/targets.js');
const { setupPomodoro } = await import('../../js/features/power/pomodoro.js');
const { setupCPTracker } = await import('../../js/features/power/codeforces.js');

const $ = (id) => document.getElementById(id);
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  Object.keys(store).forEach((k) => delete store[k]);
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

describe('sleep tracker', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="p-sleep-actual"></div><div id="p-sleep-eff"></div>
      <input id="p-sleep-input" /><button id="p-sleep-add-btn"></button>`;
  });

  test('shows placeholders when nothing is logged', async () => {
    await setupNightShift('u1');
    expect($('p-sleep-actual').textContent).toBe('--h');
    expect($('p-sleep-eff').textContent).toBe('Efficiency: --%');
  });

  test('logs sleep and computes efficiency against 8h', async () => {
    await setupNightShift('u1');
    $('p-sleep-input').value = '7';
    await $('p-sleep-add-btn').onclick();
    expect(store['power:sleep']).toEqual({ actual: 7 });
    expect($('p-sleep-actual').textContent).toBe('7.0h');
    expect($('p-sleep-eff').textContent).toBe('Efficiency: 88%');
    expect($('p-sleep-input').value).toBe('');
  });

  test('caps efficiency at 100%', async () => {
    store['power:sleep'] = { actual: 10 };
    await setupNightShift('u1');
    expect($('p-sleep-eff').textContent).toBe('Efficiency: 100%');
  });

  test.each(['0', '-1', '25', 'abc', ''])('rejects invalid input "%s"', async (v) => {
    await setupNightShift('u1');
    $('p-sleep-input').value = v;
    await $('p-sleep-add-btn').onclick();
    expect(db.dbSave).not.toHaveBeenCalled();
  });
});

describe('daily targets', () => {
  beforeEach(() => {
    document.body.innerHTML = '<div><ul class="p-target-list"></ul></div>';
  });
  const items = () => [...document.querySelectorAll('.p-target-list li')];

  test('renders the default targets', async () => {
    await setupTargets('u1');
    expect(items().map((li) => li.querySelector('span').textContent)).toEqual([
      'Solve 3 CP Problems',
      'Refactor Auth Module',
      'Leg Day Workout',
    ]);
  });

  test('toggling a target saves it and never mutates the defaults', async () => {
    await setupTargets('u1');
    await items()[0].querySelector('.p-chk').onclick();
    expect(store['power:targets'][0].done).toBe(true);
    expect(utils.showToast).toHaveBeenCalledWith('Target Acquired 🎯');

    delete store['power:targets'];
    document.body.innerHTML = '<div><ul class="p-target-list"></ul></div>';
    await setupTargets('u2');
    expect(items()[0].querySelector('.p-chk').classList.contains('checked')).toBe(false);
  });

  test('removes a target', async () => {
    await setupTargets('u1');
    await items()[1].querySelector('button').onclick();
    expect(store['power:targets'].map((t) => t.text)).toEqual([
      'Solve 3 CP Problems',
      'Leg Day Workout',
    ]);
    expect(items()).toHaveLength(2);
  });

  test('adds a trimmed target and ignores blanks', async () => {
    await setupTargets('u1');
    $('p-target-input').value = '   ';
    await $('p-target-add-btn').onclick();
    expect(db.dbSave).not.toHaveBeenCalled();

    $('p-target-input').value = '  Revise OS  ';
    await $('p-target-add-btn').onclick();
    await flush();
    expect(store['power:targets'].at(-1)).toMatchObject({ text: 'Revise OS', done: false });
    expect(items()).toHaveLength(4);
  });

  test('renders target text safely', async () => {
    store['power:targets'] = [{ id: 'x', text: '<img src=x onerror=alert(1)>', done: false }];
    await setupTargets('u1');
    expect(document.querySelector('.p-target-list img')).toBeNull();
  });
});

describe('pomodoro', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    document.body.innerHTML = `
      <div id="p-timer"></div><button id="p-start"></button><button id="p-reset"></button>
      <select id="p-habit-select"><option value="">None</option></select>
      <select id="p-duration"><option value="1">1</option><option value="25">25</option></select>`;
  });
  afterEach(() => jest.useRealTimers());

  test('lists only non-group habits and restores the saved duration', async () => {
    store['power:pomo_duration'] = 1;
    await setupPomodoro('u1');
    const values = [...$('p-habit-select').options].map((o) => o.value);
    expect(values).toEqual(['', 'cp']);
    expect($('p-timer').textContent).toBe('01:00');
  });

  test('counts down, pauses, and resets', async () => {
    store['power:pomo_duration'] = 25;
    await setupPomodoro('u1');
    $('p-start').onclick();
    expect($('p-start').textContent).toBe('Pause');
    await jest.advanceTimersByTimeAsync(3000);
    expect($('p-timer').textContent).toBe('24:57');
    $('p-start').onclick();
    await jest.advanceTimersByTimeAsync(5000);
    expect($('p-timer').textContent).toBe('24:57');
    $('p-reset').onclick();
    expect($('p-timer').textContent).toBe('25:00');
  });

  test('logs the selected habit when a session completes', async () => {
    store['power:pomo_duration'] = 1;
    await setupPomodoro('u1');
    $('p-habit-select').value = 'cp';
    $('p-start').onclick();
    await jest.advanceTimersByTimeAsync(60_000);
    expect(habits.markHabitDoneToday).toHaveBeenCalledWith('u1', 'cp');
    expect(utils.showToast).toHaveBeenCalledWith('Focus Session Complete! 🧘');
    expect($('p-timer').textContent).toBe('01:00');
  });
});

describe('codeforces tracker', () => {
  beforeEach(() => {
    document.body.innerHTML = `
      <div id="cp-rating"></div><div id="cp-rank"></div><div id="cp-max"></div>
      <div id="cp-handle-display"></div><button id="cp-refresh"></button>
      <input id="cf-handle-input" /><button id="cf-handle-save"></button>`;
  });

  const ok = (body) => ({ ok: true, json: async () => body });

  test('fetches rating, rank and delta and caches them', async () => {
    global.fetch = jest.fn(async (url) =>
      url.includes('user.info')
        ? ok({ status: 'OK', result: [{ rating: 748, rank: 'newbie', maxRating: 883 }] })
        : ok({ status: 'OK', result: [{ oldRating: 771, newRating: 748 }] })
    );
    setupCPTracker('u1');
    await $('cp-refresh').onclick();
    expect($('cp-rating').textContent).toBe('748-23');
    expect($('cp-rank').textContent).toBe('Newbie');
    expect($('cp-max').textContent).toBe('883');
    expect(store['power:cp']).toMatchObject({ rating: 748, maxRating: 883, delta: -23 });
    expect($('cp-refresh').textContent).toBe('Refresh API');
  });

  test('falls back to the second proxy when the first fails', async () => {
    global.fetch = jest.fn(async (url) => {
      if (url.startsWith('https://corsproxy.io')) throw new Error('down');
      return url.includes('user.info')
        ? ok({ status: 'OK', result: [{ rating: 1500, rank: 'specialist', maxRating: 1500 }] })
        : ok({ status: 'OK', result: [] });
    });
    setupCPTracker('u1');
    await $('cp-refresh').onclick();
    expect($('cp-rating').textContent).toBe('1500+0');
    expect(global.fetch.mock.calls.some(([u]) => u.includes('allorigins'))).toBe(true);
  });

  test('shows an error toast when the handle does not exist', async () => {
    global.fetch = jest.fn(async () =>
      ok({ status: 'FAILED', comment: 'handles: User not found' })
    );
    setupCPTracker('u1');
    await $('cp-refresh').onclick();
    expect(utils.showToast).toHaveBeenCalledWith('CP Error: handles: User not found');
    expect(store['power:cp']).toBeUndefined();
  });

  test('saving a new handle clears the cached stats and refreshes', async () => {
    global.fetch = jest.fn(async () => ok({ status: 'FAILED', comment: 'x' }));
    setupCPTracker('u1');
    await flush();
    $('cf-handle-input').value = ' tourist ';
    await $('cf-handle-save').onclick();
    expect(store['power:cf_handle']).toEqual({ handle: 'tourist' });
    expect(store['power:cp']).toBeNull();
    expect(global.fetch.mock.calls[0][0]).toContain(encodeURIComponent('handles=tourist'));
  });
});
