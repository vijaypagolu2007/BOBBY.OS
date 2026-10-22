import { extractAdvice, renderAdvice } from '../../js/ai-format.js';

const reply = (parts, finishReason = 'STOP') => ({
  candidates: [{ finishReason, content: { parts } }],
});

describe('extractAdvice', () => {
  test('joins text parts and trims', () => {
    expect(extractAdvice(reply([{ text: ' Do **DBMS** ' }, { text: 'now. ' }]))).toBe(
      'Do **DBMS** now.'
    );
  });

  test('skips thought parts', () => {
    expect(extractAdvice(reply([{ thought: true, text: 'thinking' }, { text: 'Sleep.' }]))).toBe(
      'Sleep.'
    );
  });

  test('keeps truncated text when MAX_TOKENS still produced output', () => {
    expect(extractAdvice(reply([{ text: 'Revise joins' }], 'MAX_TOKENS'))).toBe('Revise joins');
  });

  test('explains when thinking used up the token budget', () => {
    expect(() =>
      extractAdvice({ candidates: [{ finishReason: 'MAX_TOKENS', content: {} }] })
    ).toThrow('AI ran out of tokens before answering.');
  });

  test('throws on empty output, safety blocks, and missing candidates', () => {
    expect(() => extractAdvice(reply([]))).toThrow('Gemini returned an empty response.');
    expect(() => extractAdvice(reply([{ text: 'x' }], 'SAFETY'))).toThrow('finishReason: SAFETY');
    expect(() => extractAdvice({})).toThrow('no candidates');
  });
});

describe('renderAdvice', () => {
  test('renders **bold** as <strong> and the rest as text', () => {
    const el = document.createElement('div');
    renderAdvice(el, 'Focus on **graphs** first.');
    expect(el.querySelector('strong').textContent).toBe('graphs');
    expect(el.textContent).toBe('Focus on graphs first.');
  });

  test('never interprets model output as HTML', () => {
    const el = document.createElement('div');
    renderAdvice(el, '<img src=x onerror=alert(1)> **ok**');
    expect(el.querySelector('img')).toBeNull();
    expect(el.textContent).toContain('<img src=x onerror=alert(1)>');
  });
});
