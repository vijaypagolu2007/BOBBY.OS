// ══════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════

export function simpleHash(s) {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
        h = ((h << 5) - h) + s.charCodeAt(i);
        h |= 0;
    }
    return h.toString(36);
}

export function today() { return new Date().toISOString().slice(0, 10); }

export function showToast(m) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = m;
    t.classList.add('on');
    setTimeout(() => t.classList.remove('on'), 2400);
}

export function iso(d) { return d.toISOString().slice(0, 10); }

export function wkKey(off) { return iso(getMon(off)); }

export function ck(id, wk, di) { return `${wk}|${id}|${di}`; }

export function getMon(off) {
    const d = new Date();
    const dow = d.getDay() || 7;
    d.setDate(d.getDate() - dow + 1 + off * 7);
    d.setHours(0, 0, 0, 0);
    return d;
}

export function wkDates(off) {
    const m = getMon(off);
    return Array.from({ length: 7 }, (_, i) => {
        const d = new Date(m);
        d.setDate(m.getDate() + i);
        return d;
    });
}
