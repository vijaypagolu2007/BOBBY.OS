import { jest } from '@jest/globals';

const generateContent = jest.fn();

jest.unstable_mockModule('../../js/firebase.js', () => ({ app: undefined, auth: {} }));
jest.unstable_mockModule('firebase/ai', () => ({
  getAI: jest.fn(),
  getGenerativeModel: jest.fn(() => ({ generateContent })),
  GoogleAIBackend: jest.fn(),
  ThinkingLevel: { MINIMAL: 'MINIMAL' },
}));

jest.unstable_mockModule('../../js/db.js', () => ({ dbLoad: jest.fn() }));
jest.unstable_mockModule('../../js/data.js', () => ({
  buildHabits: jest.fn(),
  defSlots: jest.fn(),
}));

const { getStudyAdvice } = await import('../../js/gemini.js');

test('returns mock advice when Firebase is not configured', async () => {
  expect(await getStudyAdvice('u1')).toMatch(/^\[MOCK\] Analyzing schedule\.\.\. /);
  expect(generateContent).not.toHaveBeenCalled();
});
