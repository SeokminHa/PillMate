---
name: Schedule labels must be language-agnostic tokens
description: Why meal/time-block labels are stored as tokens, not translated text, and how rendering reverse-maps legacy data
---

Schedule/display labels (meal times, time blocks) must be persisted as
**language-agnostic tokens**, never as already-translated display text.

**Why:** Labels were originally stored as frozen translated strings at creation
time (e.g. Korean "저녁 식후"). When the user switched language, or just viewed in
the other language, the stored text stayed in the creation-time language — so an
Omega-3 created in English showed English meal text while the app was in Korean.
The data, not the UI, was carrying the language.

**How to apply:**
- Store tokens: `meal:<meal>:<timing>` (e.g. `meal:dinner:after`) and `block:<key>`
  (e.g. `block:morningBlock`). Seed data uses the same tokens.
- Render through `translateScheduleLabel(entry, t)` in `lib/schedule-label.ts` —
  it resolves tokens via the i18n `t()` and ALSO reverse-maps legacy frozen
  Korean/English labels (disambiguating meal-name vs block-name by whether
  `mealTiming` is present, since "아침"/"저녁" are ambiguous between meal and block).
- The reverse map means a DB migration was NOT needed — existing rows render
  correctly because the helper recognizes the old frozen strings.
- Any new user-facing label that varies by language must follow this token rule.
