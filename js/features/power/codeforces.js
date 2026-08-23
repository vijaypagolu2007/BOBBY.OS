import { dbLoad, dbSave } from '../../db.js';
import { showToast } from '../../utils.js';

export function setupCPTracker(uid) {
  const ratingEl = document.getElementById('cp-rating');
  const refreshButton = document.getElementById('cp-refresh');
  if (!ratingEl || !refreshButton) return;

  const updateUI = (stats) => {
    const rating = document.getElementById('cp-rating');
    const rank = document.getElementById('cp-rank');
    const max = document.getElementById('cp-max');
    const handle = document.getElementById('cp-handle-display');
    if (!rating) return;
    if (handle) handle.textContent = stats.handle || 'Vijaypagolu96';
    const delta =
      stats.delta !== undefined
        ? `<span style="font-size:14px; margin-left:8px; color:${stats.delta >= 0 ? '#20d68a' : '#ff5572'}">${stats.delta >= 0 ? '+' : ''}${stats.delta}</span>`
        : '';
    rating.innerHTML = `${stats.rating || '--'}${delta}`;
    if (rank)
      rank.textContent = stats.rating
        ? String(stats.rank).charAt(0).toUpperCase() + String(stats.rank).slice(1)
        : 'Unrated';
    if (max) max.textContent = stats.maxRating || '--';
    const value = stats.rating || 0;
    rating.style.color =
      value >= 2400
        ? '#ff0000'
        : value >= 2100
          ? '#ff8c00'
          : value >= 1900
            ? '#aa00aa'
            : value >= 1600
              ? '#0000ff'
              : value >= 1400
                ? '#03a89e'
                : value >= 1200
                  ? '#008000'
                  : '#808080';
  };

  const fetchWithProxy = async (url) => {
    for (const proxyUrl of [
      `https://corsproxy.io/?${encodeURIComponent(url)}`,
      `https://api.allorigins.win/raw?url=${encodeURIComponent(url)}`,
    ]) {
      try {
        const response = await fetch(proxyUrl);
        if (response.ok) return response.json();
      } catch {
        // Try the next proxy.
      }
    }
    throw new Error('Connection failed');
  };

  const refreshStats = async () => {
    refreshButton.textContent = 'Fetching...';
    try {
      const savedHandle = await dbLoad(uid, 'power:cf_handle', { handle: 'Vijaypagolu96' });
      const handle = (savedHandle.handle || 'Vijaypagolu96').trim();
      if (!handle) return;
      const encodedHandle = encodeURIComponent(handle);
      const profile = await fetchWithProxy(
        `https://codeforces.com/api/user.info?handles=${encodedHandle}`
      );
      if (profile.status !== 'OK') throw new Error(profile.comment || 'Codeforces user not found');
      let delta = 0;
      try {
        const history = await fetchWithProxy(
          `https://codeforces.com/api/user.rating?handle=${encodedHandle}`
        );
        if (history.status === 'OK' && history.result.length) {
          const last = history.result.at(-1);
          delta = last.newRating - last.oldRating;
          await dbSave(uid, 'power:cpData', history.result);
        }
      } catch (error) {
        console.warn('Rating history fetch failed', error);
      }
      const info = profile.result[0];
      const stats = {
        rating: info.rating || 0,
        rank: info.rank || 'Unrated',
        maxRating: info.maxRating || 0,
        delta,
        handle,
        ts: Date.now(),
      };
      await dbSave(uid, 'power:cp', stats);
      updateUI(stats);
      showToast(`Synced ${handle} ðŸ“Š`);
    } catch (error) {
      console.error('CP Error:', error);
      showToast(`CP Error: ${error.message}`);
    } finally {
      refreshButton.textContent = 'Refresh API';
    }
  };

  setupHandleEdit(uid, refreshStats);
  refreshButton.onclick = refreshStats;
  dbLoad(uid, 'power:cp', null).then((cached) => {
    if (cached) updateUI(cached);
  });
}

async function setupHandleEdit(uid, onSave) {
  const input = document.getElementById('cf-handle-input');
  const saveButton = document.getElementById('cf-handle-save');
  if (!input || !saveButton) return;
  const saved = await dbLoad(uid, 'power:cf_handle', { handle: 'Vijaypagolu96' });
  if (saved.handle) input.value = saved.handle;
  saveButton.onclick = async () => {
    const handle = input.value.trim();
    if (!handle) return;
    await dbSave(uid, 'power:cf_handle', { handle });
    await dbSave(uid, 'power:cp', null);
    showToast(`Handle set to ${handle} âœ“`);
    onSave();
  };
}
