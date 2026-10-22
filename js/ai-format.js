/**
 * Pure helpers for the AI advisor: parsing Gemini responses and rendering
 * the advice safely. Kept free of Firebase / import.meta so they are unit-testable.
 */

/**
 * Extracts advice text from a Gemini generateContent response.
 * Joins every non-thought text part, so a reply split across parts still works.
 * Throws a descriptive error on safety blocks, empty output, or token exhaustion.
 */
export function extractAdvice(data) {
  const candidate = data?.candidates?.[0];
  if (!candidate) throw new Error('Gemini returned no candidates (possible safety block).');

  const { finishReason } = candidate;
  const TERMINAL_REASONS = new Set(['STOP', 'MAX_TOKENS']);
  if (finishReason && !TERMINAL_REASONS.has(finishReason)) {
    throw new Error(`Gemini response blocked (finishReason: ${finishReason}).`);
  }

  const parts = candidate.content?.parts ?? [];
  const text = parts
    .filter((p) => !p.thought && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
    .trim();

  if (!text) {
    throw new Error(
      finishReason === 'MAX_TOKENS'
        ? 'AI ran out of tokens before answering.'
        : 'Gemini returned an empty response.'
    );
  }
  return text;
}

/**
 * Renders advice into an element as plain text, turning **bold** into <strong>.
 * Never uses innerHTML, so model output can't inject markup.
 */
export function renderAdvice(el, text) {
  el.textContent = '';
  String(text)
    .split(/(\*\*[^*]+\*\*)/)
    .forEach((chunk) => {
      if (!chunk) return;
      if (chunk.length > 4 && chunk.startsWith('**') && chunk.endsWith('**')) {
        const strong = document.createElement('strong');
        strong.textContent = chunk.slice(2, -2);
        el.append(strong);
      } else {
        el.append(chunk);
      }
    });
}
