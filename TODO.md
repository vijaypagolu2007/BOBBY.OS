# 🌌 BOBBY.OS // Evolution Roadmap

> **Current Status**: V1.0 PRO Performance Edition Launched 🚀  
> **Active Focus**: Phase 2 — The Power User OS (Intelligence & Analytics)
> **Target**: V1.1 Professional Expansion

---

## ✅ PHASE 1: Pro-Minimalist Restoration (Complete)
*Goal: Restored the elite minimalist aesthetic of V1.0 with modern tech*

- [x] **Project Scaffolding**: Migrated to Vite/Modular JS structure.
- [x] **UI Reversion**: Restored the clean, functional V1.0 aesthetic.
- [x] **Cloud Core**: Integrated Firebase Auth & Firestore for real-time sync.
- [x] **Security**: UID Partitioning for multi-user isolation.

---

## 🟡 PHASE 2: The Power User OS (Active)
*Goal: Implement practical features that make BOBBY.OS indispensable*

### ⏱️ Productivity Tools
- [ ] **Zen Pomodoro**: 25/5 or custom timer integrated into every habit slot.
- [ ] **Exam Countdown**: Live countdown for the current/next exam (CT2/SEE).
- [ ] **Daily Target Setter**: Set numeric goals (e.g., "Solve 5 problems") per habit.
- [ ] **Sleep Tracker**: Log actual sleep time vs scheduled vs target.

### 📊 Analytics & Progress
- [ ] **Cexport async function toggle(uid, id, wk, di) {
    const k = ck(id, wk, di);
    console.log(`[Habit] Toggling ${id} on ${wk} day ${di}`);
    const data = await dbLoad(uid, 'habits', {});
    data[k] = ((data[k] || 0) + 1) % 3;
    await dbSave(uid, 'habits', data);
    await renderHabits(uid);
}
- [ ] **Progress Charts**: Weekly/monthly trends for habits and CP problems.
- [ ] **CT2 Score Tracker**: Record and visualize scores across semesters.

### 📝 Study & CP Tools
- [ ] **Formula Vault**: Subject-wise formula sheets with a quick-review mode.
- [ ] **Revision Checklist**: Topic-wise syllabus tracking per subject.
- [ ] **Wrong Answer Log**: Dedicated space to track CP mistakes and learnings.
- [ ] **Subject Notes**: Attach quick markdown notes to any exam/subject.

---

## 🟠 PHASE 3: Social & Professional Delivery (Planned)
*Goal: Intelligence, Reminders, and Customization*

- [            const [y, m, dom] = wk.split('-');
            if (!y || !m || !dom || isNaN(parseInt(di))) continue;
            
            const d = new Date(parseInt(y), parseInt(m) - 1, parseInt(dom));
            d.setDate(d.getDate() + parseInt(di));
            if (isNaN(d.getTime())) continue;
            
            const dateStr = localISO(d);
            dailyCounts.set(dateStr, (dailyCounts.get(dateStr) || 0) + 1);
**Premium Customization**:
    - [ ] **Theme Switcher**: Red, Green, and Monochrome premium modes.
    - [ ] **UI Scaling**: Compact mode toggle for "Power User" density.
- [ ] **PWA Mastery**:
    - [ ] 100% Offline coverage with optimized background sync.
    - [ ] App Store/Play Store ready assets.

---

*“Success is a habit, not an event.” — BOBBY.OS Team*

