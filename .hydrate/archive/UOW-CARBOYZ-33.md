Please create and execute a new Unit of Work: .hydrate/CURRENT_UOW.md

# Unit of Work Payload: UOW-CARBOYZ-33

**Title:** Mobile Viewport & CSS Responsiveness Audit Across All UI Views
**Target Scope:** `public/css/` (or stylesheet directories), `src/ui/*.js`

---

## 1. Context & Objective
Recent mobile testing reveals viewport scaling, clipping, and layout overlap issues across multiple UI views (e.g., Sell Your Car intake form input overlap, Analytics view filter wrap/text truncation, bottom tab navigation spacing). 

The goal is to conduct a systematic UI pass across all client views to enforce mobile-first CSS containment, responsive grid bounds, and touch-target safe areas.

---

## 2. Technical Guidelines & Constraints
1. **Global CSS Reset / Constraints:**
   - Enforce `box-sizing: border-box` across all form elements, cards, inputs, and layout wrappers.
   - Ensure all flex/grid children use `min-width: 0` to prevent text/select elements from pushing parent containers past `100vw`.
2. **Form & Filter Controls:**
   - Standardize multi-column form rows and filter bars to use `grid-template-columns: repeat(auto-fit, minmax(140px, 1fr))` or vertical flex-column stacking on screens below `< 640px`.
   - Stack `<label>` and `<select>`/`<input>` controls cleanly using vertical flex layouts to eliminate inline/absolute overlap.
3. **Analytics & Cards:**
   - Metric cards (e.g., Total Volume, Win Rate) must scale fluidly in a 2-column grid on mobile without squishing label text.
   - Filter dropdowns (Date Range, Competitor, Price Band, Approval Type) must wrap into stacked full-width controls on mobile devices instead of crashing horizontally.
4. **Navigation & Mobile Safe Areas:**
   - Ensure bottom tab navigation bars respect iOS safe area insets (`env(safe-area-inset-bottom)`) so labels are not obscured by device gestures.
5. **Preserve Logic & Tests:**
   - Do NOT modify DOM event listeners, business logic, or data-binding attributes. Run `npm test` after CSS refactoring to confirm all unit tests pass.

---

## 3. Tasks
1. Audit CSS styling across all views: `IntakeView`, `LeadInboxView`, `AnalyticsView`, `SimulationView`, `AdminView`.
2. Fix form input positioning and horizontal overflow on intake forms.
3. Refactor filter bars in `AnalyticsView` and `LeadInboxView` to wrap cleanly on small viewports.
4. Verify layout integrity across all views and execute `npm test`.

---

Please write `.hydrate/CURRENT_UOW.md`, implement the responsive CSS fixes, verify that tests pass, and present the diff summary.
