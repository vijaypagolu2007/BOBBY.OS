import { jest } from '@jest/globals';
import { ck, getMon, localISO, simpleHash, wkDates } from '../../js/utils.js';

describe('utility helpers', () => {
  afterEach(() => jest.useRealTimers());

  test('creates deterministic, distinct hashes', () => {
    expect(simpleHash('BOBBY.OS')).toBe(simpleHash('BOBBY.OS'));
    expect(simpleHash('BOBBY.OS')).not.toBe(simpleHash('bobby.os'));
  });

  test('formats dates and creates a stable habit completion key', () => {
    const date = new Date(2026, 0, 2, 23, 30);
    expect(localISO(date)).toBe('2026-01-02');
    expect(ck('focus', '2025-12-29', 4)).toBe('2025-12-29|focus|4');
  });

  test('starts weeks on Monday and returns seven consecutive days', () => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 0, 7, 12));

    const monday = getMon(0);
    const dates = wkDates(0);

    expect(monday.getDay()).toBe(1);
    expect(dates).toHaveLength(7);
    expect(dates[0].getDate()).toBe(monday.getDate());
    expect(dates[6].getDate() - dates[0].getDate()).toBe(6);
  });
});
