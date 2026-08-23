import { getStudyAdvice } from '../../gemini.js';

export function setupAI(uid) {
  const button = document.getElementById('ai-refresh');
  const message = document.getElementById('ai-suggestion');
  if (!button || !message) return;

  button.onclick = async () => {
    button.textContent = 'Analyzing...';
    button.style.opacity = '0.7';
    button.disabled = true;
    try {
      message.innerHTML = `"${await getStudyAdvice(uid)}"`;
    } catch {
      message.innerHTML = '"Error generating insights."';
    } finally {
      button.textContent = 'Optimize Schedule';
      button.style.opacity = '1';
      button.disabled = false;
    }
  };
}
