import { jest } from '@jest/globals';

const firestore = {
  doc: jest.fn((db, col, uid) => ({ path: `${col}/${uid}` })),
  getDoc: jest.fn(),
  setDoc: jest.fn(),
  onSnapshot: jest.fn(),
};
const fakeDb = { name: 'firestore' };

jest.unstable_mockModule('firebase/firestore', () => firestore);
jest.unstable_mockModule('../../js/firebase.js', () => ({ db: fakeDb }));

const dbModule = await import('../../js/db.js');
const { DB, uKey, dbLoad, dbSave, clearCache, preloadAllUserData, showSyncIndicator, uDoc } =
  dbModule;

const snap = (data) => ({ exists: () => data !== null, data: () => data });
const flush = () => new Promise((r) => setTimeout(r, 0));

beforeEach(() => {
  localStorage.clear();
  clearCache();
  firestore.getDoc.mockReset();
  firestore.setDoc.mockReset();
  firestore.setDoc.mockResolvedValue();
  document.body.innerHTML = '<div id="sync-ind"></div>';
  jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => jest.restoreAllMocks());

describe('keys and local storage', () => {
  test('uKey namespaces by user and falls back to guest', () => {
    expect(uKey('u1', 'habits')).toBe('bobbyos:u1:habits');
    expect(uKey(null, 'habits')).toBe('bobbyos:guest:habits');
  });

  test('DB round-trips JSON and returns null for missing or corrupt values', async () => {
    await DB.set('k', { a: 1 });
    expect(await DB.get('k')).toEqual({ a: 1 });
    expect(await DB.get('missing')).toBeNull();
    localStorage.setItem('bad', '{not json');
    expect(await DB.get('bad')).toBeNull();
    await DB.del('k');
    expect(await DB.get('k')).toBeNull();
  });

  test('uDoc points at users/{uid}', () => {
    expect(uDoc('u1')).toEqual({ path: 'users/u1' });
    expect(firestore.doc).toHaveBeenCalledWith(fakeDb, 'users', 'u1');
  });
});

describe('dbSave', () => {
  test('writes the in-memory cache and localStorage immediately', async () => {
    await dbSave('u1', 'power:sleep', { actual: 7 });
    expect(dbModule.S['power:sleep']).toEqual({ actual: 7 });
    expect(JSON.parse(localStorage.getItem('bobbyos:u1:power:sleep'))).toEqual({ actual: 7 });
  });

  test('merges the key into the user document in Firestore', async () => {
    await dbSave('u1', 'power:targets', []);
    await flush();
    expect(firestore.setDoc).toHaveBeenCalledWith(
      { path: 'users/u1' },
      { 'power:targets': [] },
      { merge: true }
    );
    expect(document.getElementById('sync-ind').textContent).toBe('✓ synced');
  });

  test('shows a sync error when the cloud write fails', async () => {
    firestore.setDoc.mockRejectedValue(new Error('offline'));
    await dbSave('u1', 'x', 1);
    await flush();
    expect(document.getElementById('sync-ind').textContent).toBe('⚠ sync error');
    expect(JSON.parse(localStorage.getItem('bobbyos:u1:x'))).toBe(1);
  });

  test('guest saves stay local', async () => {
    await dbSave(null, 'x', 1);
    await flush();
    expect(firestore.setDoc).not.toHaveBeenCalled();
    expect(localStorage.getItem('bobbyos:guest:x')).toBe('1');
  });
});

describe('dbLoad', () => {
  test('prefers the in-memory cache', async () => {
    await dbSave(null, 'k', 'cached');
    localStorage.setItem('bobbyos:u1:k', JSON.stringify('local'));
    expect(await dbLoad('u1', 'k')).toBe('cached');
    expect(firestore.getDoc).not.toHaveBeenCalled();
  });

  test('falls back to localStorage before the cloud', async () => {
    localStorage.setItem('bobbyos:u1:k', JSON.stringify('local'));
    expect(await dbLoad('u1', 'k')).toBe('local');
    expect(firestore.getDoc).not.toHaveBeenCalled();
  });

  test('reads from Firestore and caches locally when nothing is stored', async () => {
    firestore.getDoc.mockResolvedValue(snap({ k: 'cloud' }));
    expect(await dbLoad('u1', 'k')).toBe('cloud');
    expect(JSON.parse(localStorage.getItem('bobbyos:u1:k'))).toBe('cloud');
  });

  test('returns the default when the cloud has no value', async () => {
    firestore.getDoc.mockResolvedValue(snap({ other: 1 }));
    expect(await dbLoad('u1', 'k', 'def')).toBe('def');
  });

  test('returns the default when the cloud read is denied', async () => {
    firestore.getDoc.mockRejectedValue(new Error('Missing or insufficient permissions.'));
    expect(await dbLoad('u1', 'k', [])).toEqual([]);
  });
});

describe('preloadAllUserData', () => {
  test('hydrates cache and localStorage from the user document', async () => {
    firestore.getDoc.mockResolvedValue(snap({ a: 1, b: [2] }));
    await preloadAllUserData('u1');
    expect(dbModule.S).toMatchObject({ a: 1, b: [2] });
    expect(JSON.parse(localStorage.getItem('bobbyos:u1:b'))).toEqual([2]);
    expect(await dbLoad('u1', 'a')).toBe(1);
  });

  test('times out to local fallback when the network hangs', async () => {
    jest.useFakeTimers();
    firestore.getDoc.mockReturnValue(new Promise(() => {}));
    const done = preloadAllUserData('u1');
    await jest.advanceTimersByTimeAsync(2500);
    await done;
    expect(document.getElementById('sync-ind').textContent).toBe('local only');
    jest.useRealTimers();
  });
});

describe('showSyncIndicator', () => {
  test.each([
    ['saving', 'syncing...'],
    ['error', '⚠ sync error'],
    ['offline', 'local only'],
    ['saved', '✓ synced'],
  ])('%s shows "%s"', (state, text) => {
    showSyncIndicator(state);
    const el = document.getElementById('sync-ind');
    expect(el.textContent).toBe(text);
    expect(el.className).toBe(`sync-indicator ${state}`);
  });
});
