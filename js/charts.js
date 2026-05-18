import { dbLoad } from './db.js';
import { iso as localISO } from './utils.js';

/**
 * Renders a GitHub-style contribution heatmap for habits.
 * @param {string} uid User ID
 */
export async function renderHeatmap(uid) {
    const container = document.getElementById('habit-heatmap');
    if (!container) return;

    const habitData = await dbLoad(uid, 'habits', {});
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    
    const weeksToShow = 20;
    
    // Calculate start date (Monday of 19 weeks ago)
    const currentMon = new Date(now);
    const day = currentMon.getDay();
    currentMon.setDate(currentMon.getDate() - (day === 0 ? 6 : day - 1));
    
    const startDate = new Date(currentMon);
    startDate.setDate(currentMon.getDate() - ((weeksToShow - 1) * 7));

    // Pre-calculate counts for each absolute day to avoid O(N^2) inner loops
    const dailyCounts = new Map();
    for (const key in habitData) {
        if (habitData[key] === 1) { // Only count "Done"
            const [wk, id, di] = key.split('|');
            // Reconstruct the actual date string for this entry
            // 'wk' is in YYYY-MM-DD format (local time context)
            const [y, m, dom] = wk.split('-');
            const d = new Date(y, m - 1, dom);
            d.setDate(d.getDate() + parseInt(di));
            const dateStr = localISO(d);
            dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
        }
    }
    // Calculate Month Labels
    let monthLabelsHtml = '<div class="heatmap-months" style="display: flex; margin-left: 28px; font-size: 10px; color: var(--dim);">';
    let lastMonth = -1;
    for (let w = 0; w < weeksToShow; w++) {
        const current = new Date(startDate);
        current.setDate(startDate.getDate() + (w * 7));
        const m = current.getMonth();
        if (m !== lastMonth) {
            const mName = current.toLocaleString('default', { month: 'short' });
            // Don't show month name if it's the very first week and there are only a few days left in the month
            if (w === 0 && current.getDate() > 15) {
                monthLabelsHtml += `<span style="width: 14px; display: inline-block;"></span>`;
            } else {
                monthLabelsHtml += `<span style="width: 14px; display: inline-block; overflow: visible; white-space: nowrap;">${mName}</span>`;
            }
            lastMonth = m;
        } else {
            monthLabelsHtml += `<span style="width: 14px; display: inline-block;"></span>`;
        }
    }
    monthLabelsHtml += '</div>';

    let html = '<div class="heatmap-grid" style="display: flex; flex-direction: column; gap: 4px;">';
    html += monthLabelsHtml;
    html += '<div style="display: flex; gap: 8px;">';
    
    // Left Labels (Mon, Wed, Fri)
    html += `
        <div class="heatmap-day-labels" style="display: flex; flex-direction: column; font-size: 10px; color: var(--dim); padding-top: 0;">
            <div style="height: 10px; margin-bottom: 18px; line-height: 10px;">Mon</div>
            <div style="height: 10px; margin-bottom: 18px; line-height: 10px;">Wed</div>
            <div style="height: 10px; line-height: 10px;">Fri</div>
        </div>
    `;

    html += '<div class="heatmap-weeks" style="display: flex; gap: 4px;">';
    
    for (let w = 0; w < weeksToShow; w++) {
        html += '<div class="heatmap-week" style="display: flex; flex-direction: column; gap: 4px;">';
        for (let d = 0; d < 7; d++) {
            const current = new Date(startDate);
            current.setDate(startDate.getDate() + (w * 7) + d);
            const dateStr = localISO(current);
            
            const count = dailyCounts.get(dateStr) || 0;
            const intensity = Math.min(4, count);
            const isFuture = current > now;
            const isToday = current.getTime() === now.getTime();
            
            html += `<div class="heatmap-day i-${intensity}${isFuture ? ' future' : ''}${isToday ? ' today' : ''}" 
                        title="${dateStr}: ${count} habits completed"></div>`;
        }
        html += '</div>';
    }
    
    html += '</div></div></div>';
    container.innerHTML = html;
}

/** Helper to get Monday ISO string for any date, matching utils.js */
function getMondayIsoStr(date) {
    const d = new Date(date);
    const dow = d.getDay() || 7;
    d.setDate(d.getDate() - dow + 1);
    const tzOffset = d.getTimezoneOffset() * 60000;
    return (new Date(d - tzOffset)).toISOString().slice(0, 10);
}

let habitChartInstance = null;
let cpChartInstance = null;

export async function renderProgressCharts(uid) {
    if (!window.Chart) return;

    // 1. Habit Consistency Chart
    const habitCtx = document.getElementById('habit-trend-chart');
    if (habitCtx) {
        const habitData = await dbLoad(uid, 'habits', {});
        const weeks = [];
        const consistency = [];
        
        // Calculate consistency for the last 8 weeks
        const now = new Date();
        now.setHours(0, 0, 0, 0);
        const currentMon = new Date(now);
        const day = currentMon.getDay();
        currentMon.setDate(currentMon.getDate() - (day === 0 ? 6 : day - 1));

        for (let w = 7; w >= 0; w--) {
            const start = new Date(currentMon);
            start.setDate(currentMon.getDate() - (w * 7));
            const dateStr = getMondayIsoStr(start);
            weeks.push(start.toLocaleDateString('default', { month: 'short', day: 'numeric' }));

            let totalDone = 0;
            // Count total habits marked 1 (done) in this week across all habits
            for (let i = 0; i < 7; i++) {
                const searchDate = new Date(start);
                searchDate.setDate(start.getDate() + i);
                const searchStr = localISO(searchDate);
                
                // Brute force check all keys for this date
                // Actually since the keys are ck(id, wk, di) we need a better way.
                // Let's just use the same logic as the heatmap: pre-calculate dailyCounts
            }
            // To simplify, let's recount using the same dailyCounts map logic
        }

        // Simpler approach for Habit Trend: Total habits done per week
        const weeklyCounts = new Array(8).fill(0);
        for (const key in habitData) {
            if (habitData[key] === 1) {
                const [wk, id, di] = key.split('|');
                const [y, m, dom] = wk.split('-');
                const d = new Date(y, m - 1, dom);
                d.setDate(d.getDate() + parseInt(di));
                
                // Which week index?
                const diffTime = Math.abs(now - d);
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const weekIndex = Math.floor(diffDays / 7);
                if (weekIndex < 8) {
                    weeklyCounts[7 - weekIndex]++;
                }
            }
        }

        if (habitChartInstance) habitChartInstance.destroy();
        habitChartInstance = new Chart(habitCtx, {
            type: 'line',
            data: {
                labels: weeks,
                datasets: [{
                    label: 'Habits Completed',
                    data: weeklyCounts,
                    borderColor: '#20d68a',
                    backgroundColor: 'rgba(32, 214, 138, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }

    // 2. CP Rating Chart
    const cpCtx = document.getElementById('cp-trend-chart');
    if (cpCtx) {
        const cpHistory = await dbLoad(uid, 'power:cpData', []);
        
        let labels = [];
        let data = [];
        
        if (cpHistory && cpHistory.length > 0) {
            // Take the last 15 contests
            const recent = cpHistory.slice(-15);
            labels = recent.map(r => {
                const d = new Date(r.ratingUpdateTimeSeconds * 1000);
                return d.toLocaleDateString('default', { month: 'short', day: 'numeric' });
            });
            data = recent.map(r => r.newRating);
        } else {
            labels = ['No Data'];
            data = [0];
        }

        if (cpChartInstance) cpChartInstance.destroy();
        cpChartInstance = new Chart(cpCtx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: [{
                    label: 'Rating',
                    data: data,
                    borderColor: '#6c63ff',
                    backgroundColor: 'rgba(108, 99, 255, 0.1)',
                    borderWidth: 2,
                    fill: true,
                    tension: 0.4
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { grid: { color: 'rgba(255,255,255,0.05)' } },
                    x: { grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    }
}
