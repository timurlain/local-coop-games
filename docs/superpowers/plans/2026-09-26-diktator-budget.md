# Diktátor — Budget: income against expenses (play-test change)

> **For agentic workers:** one task, TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** Replace the original's "treasury melts by the monthly costs" with a government budget: a quarterly **income** against the quarterly **expenses**, balanced at the start, so a deficit only comes from the players' choices. Starting reserve 300 instead of 1000.

**Why:** Play-test feedback (the user, 2026-09-26). The original lasted 20–40 turns with no income; over 57 quarters the treasury would empty in ~16 turns and money would dominate the game. Decided with the user: fixed base income moved by choices; starting reserve 300.

**Principle:** No original number changes. Records whose money is really revenue are re-booked from `monthly` (expenses) to `income` with the opposite sign, so every choice's **net** effect on the per-quarter balance is exactly the original's.

**Spec:** `docs/superpowers/specs/2026-09-26-diktator-design.md` — add the rule below to §4.1 (next to "Costs are always visible") as part of this task.

---

## Rules

1. `GameState` gains `income: number` (per-quarter revenue). Start: `income = 60`, `costs = 60`, `treasury = 300` (constants in `RULES.start`: `income: 60`, `treasury: 300`; `costs: 60` unchanged). `StartingRegime.treasury` still overrides the treasury.
2. `Effects` gains `income?: number` — change of per-quarter income (+ = more revenue). `applyEffects` floors income at 0 like costs.
3. Start of each quarter (`settleTreasury`, keeping the original's order): if `treasury < 0` → the original bankruptcy penalties (unchanged) and re-plot; then **always** `treasury += income − costs` and emit `{ type: 'budget', income, costs }` (replaces the `costsPaid` event). The original's "pay nothing at exactly 0" no longer applies: with income, the balance is always booked.
4. Cash check (`affordable`): the per-quarter deficit a choice adds is `monthly − income` (more expenses or less income). Replace `monthly` in the original formula by that net change: affordable if `treasury + cost > 0`; otherwise unaffordable if `(cost < 0 || net > 0) && (treasury + cost < 0 || treasury − net < 0)`; otherwise affordable.
5. Re-booked records (numbers unchanged, only moved):
   - `p16` Založit státní loterii: `monthly: -6` → `income: 6`
   - `p20` Uvalit clo na všechno zboží z Jugoslávie: `monthly: -5` → `income: 5`
   - `p22` Snížit vysoké pozemkové daně: `monthly: 5` → `income: -5`
   - `d30` Pronajmout Italům ostrov Sazan pro námořnictvo: `monthly: -10` → `income: 10`
   - `d31` Snížit daně všem: `monthly: 8` → `income: -8`
6. Mother's forecast (`logic/forecast.ts`): money warnings use the per-quarter **balance** `income − costs`. `broke` if the treasury after the choice is below 0; `moneyRunsOut` only when the balance after the choice is negative: `quarters = floor(treasury / (costs − income))`, warned when `≤ 3` and lower than before the choice (a balanced or surplus budget never runs out).
7. UI text (`ui/effects-text.ts` `moneyText`): add `příjmy +X tis. každé čtvrtletí` / `příjmy −X tis. každé čtvrtletí` for `income`, after the expenses part. The text-mode page (`src/games/diktator/main.ts`) shows income and balance next to the treasury: `Příjmy: 60 tis. / Výdaje: 60 tis. / Bilance: 0 tis. za čtvrtletí` (add the strings to `cs.diktator`; replace the `costsPaid` event text with a budget line, e.g. `Rozpočet: příjmy 60 tis., výdaje 60 tis.`).
8. Save: `GameState.version` 3, `SAVE_VERSION` 3 (the new field breaks old saves; they are rejected, as designed).
9. Mark in `rules.ts` comments that `income` and the 300 reserve are **our addition** (play-test change), not the original.

## Steps

- [ ] Write failing tests first for rules 1–8 (new `tests/diktator/budget.test.ts` for rules 3, 4, 6; extend `records.test.ts`, `scenario.test.ts` spot checks for rule 5, `effects-text.test.ts` for rule 7, `save.test.ts`/`state.test.ts` for rules 1 and 8). Scenario validator: `income` values within −9…+9 × 10 are plain numbers — just assert the five re-booked records.
- [ ] Implement.
- [ ] Update every existing test that hard-codes the old treasury or the `costsPaid` event (the old start 1000 and the 940 after the first quarter become 300 and 300; arithmetic in decision/aid/police tests that starts from 1000 must be recomputed from 300 — change the setup (e.g. `s.treasury = 1000` in a test's own state helper) rather than the assertion where that keeps the test's intent clearer). Keep every test's intent; list each changed test in the report with old → new and why.
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` all green.
- [ ] Update the spec §4.1 with the budget rule (a short paragraph "Budget (play-test change, our addition)").
- [ ] Commit `feat(diktator): a balanced budget — income against expenses, deficits by choice` (Co-Authored-By trailer in the body).
