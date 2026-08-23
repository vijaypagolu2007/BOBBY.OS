import { jest } from '@jest/globals';

const db = {
  S: {},
  dbLoad: jest.fn(),
  dbSave: jest.fn(),
};

jest.unstable_mockModule('../../js/db.js', () => db);

const { buildHabits, defSlots, getSlots } = await import('../../js/data.js');

describe('schedule and habit data', () => {
  beforeEach(() => {
    Object.keys(db.S).forEach((key) => delete db.S[key]);
    db.dbLoad.mockReset();
    db.dbLoad.mockResolvedValue(null);
  });

  test('returns independent default schedule copies', () => {
    const first = defSlots(0);
    const second = defSlots(0);

    first[0].label = 'Changed';
    expect(second[0].label).toBe('CP');
  });

  test('caches a loaded daily schedule', async () => {
    const saved = [{ id: 'focus', label: 'Focus', time: '8 AM', type: 'everyday' }];
    db.dbLoad.mockResolvedValue(saved);

    expect(await getSlots('user-1', 0)).toEqual(saved);
    expect(await getSlots('user-1', 0)).toEqual(saved);
    expect(db.dbLoad).toHaveBeenCalledTimes(1);
  });

  test('builds grouped habits and preserves the defined order', async () => {
    const schedules = {
      'sched:0': [
        { id: 'fit', label: 'GYM', time: '6 AM', type: 'everyday' },
        { id: 'course', label: 'COLLEGE', time: '9 AM', type: 'college' },
      ],
      'sched:5': [{ id: 'project', label: 'DEV', time: '9 AM', type: 'weekend' }],
    };
    db.dbLoad.mockImplementation(async (_uid, key) => schedules[key] || []);

    const habits = await buildHabits('user-1');
    const entries = habits.filter((item) => !item.group);

    expect(entries.map((item) => item.id)).toEqual(['fit', 'course', 'project']);
    expect(entries.map((item) => item.freq)).toEqual(['all', 'wd', 'we']);
    expect(habits.filter((item) => item.group)).toHaveLength(3);
  });
});
