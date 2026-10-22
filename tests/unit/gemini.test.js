import { jest } from '@jest/globals';

// ESM mocks copy export values at import time, so `app` stays fixed here;
// mock mode (no Firebase app) is covered in gemini-mock.test.js.
const firebase = { app: { name: 'app' }, auth: { currentUser: null } };
const generateContent = jest.fn();
const store = {};
let modelConfig;

jest.unstable_mockModule('../../js/firebase.js', () => firebase);
jest.unstable_mockModule('firebase/ai', () => ({
  getAI: jest.fn(() => ({})),
  getGenerativeModel: jest.fn((ai, config) => {
    modelConfig = config;
    return { generateContent };
  }),
  GoogleAIBackend: jest.fn(),
  ThinkingLevel: { MINIMAL: 'MINIMAL' },
}));
jest.unstable_mockModule('../../js/db.js', () => ({
  dbLoad: jest.fn(async (uid, k, def) => (k in store ? store[k] : def)),
}));
jest.unstable_mockModule('../../js/data.js', () => ({
  buildHabits: jest.fn(async () => []),
  defSlots: jest.fn(() => []),
}));

const { getStudyAdvice } = await import('../../js/gemini.js');

const reply = (text) => ({ response: { candidates: [{ content: { parts: [{ text }] } }] } });

beforeEach(() => {
  localStorage.clear();
  generateContent.mockReset();
  firebase.auth.currentUser = { uid: 'u1' };
  jest.spyOn(console, 'error').mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

test('asks the user to sign in first', async () => {
  firebase.auth.currentUser = null;
  expect(await getStudyAdvice('u1')).toBe('Sign in to get AI advice.');
});

test('sends the user context and returns the model text', async () => {
  store['power:sleep'] = { actual: 6 };
  store['power:targets'] = [
    { text: 'Graphs', done: false },
    { text: 'DP', done: true },
  ];
  generateContent.mockResolvedValue(reply('Sleep **more**.'));
  expect(await getStudyAdvice('u1')).toBe('Sleep **more**.');
  const prompt = generateContent.mock.calls[0][0];
  expect(prompt).toContain('Sleep last night: 6h');
  expect(prompt).toContain('Daily targets pending: Graphs');
  expect(prompt).toContain('Daily targets done: DP');
});

test('rate-limits repeat requests for 30 seconds', async () => {
  generateContent.mockResolvedValue(reply('Revise joins'));
  await getStudyAdvice('u1');
  expect(await getStudyAdvice('u1')).toMatch(/^⏳ Wait \d+s/);
  expect(generateContent).toHaveBeenCalledTimes(1);
});

test('reports API errors instead of throwing, and allows an immediate retry', async () => {
  generateContent.mockRejectedValueOnce(new Error('quota exceeded'));
  expect(await getStudyAdvice('u1')).toBe('AI Advisor unavailable: quota exceeded');
  generateContent.mockResolvedValue(reply('Revise **joins** now.'));
  expect(await getStudyAdvice('u1')).toBe('Revise **joins** now.');
});

test('retries are allowed right after a garbage reply', async () => {
  generateContent.mockResolvedValueOnce(reply('"**0/"'));
  expect(await getStudyAdvice('u1')).toMatch(/unreadable reply/);
  generateContent.mockResolvedValue(reply('Sleep **earlier** tonight.'));
  expect(await getStudyAdvice('u1')).toBe('Sleep **earlier** tonight.');
});

test('keeps Gemini 3 at its default temperature', async () => {
  const config = modelConfig?.generationConfig;
  expect(config).toBeDefined();
  expect(config.temperature).toBeUndefined();
});
