# Diktátor — Tariffs: capped, and a growing yearly penalty (play-test change)

> **For agentic workers:** one task, TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** The tariff petition can no longer be accepted without limit, and tariffs cost the economy over time.

**Why:** Play-test feedback (the user, 2026-09-26, artifact thread 205c1df9): once all 24 petitions are used, the deck resets and "Uvalit clo na všechno zboží z Jugoslávie" (p20, income +5) can be accepted again and again. The user asked for a limit of about 3 and "a longer economic penalty for destroying the free market": a permanent income decrease every year for every tariff in force, piling up. Scale agreed in the thread: −1 tis. per tariff per year (income starts at 60 tis. per quarter).

## Rules

1. `Petition` gains two optional fields: `maxAccepted?: number` (how many times "yes" may be answered over the whole game) and `tariff?: boolean`. `p20` gets `maxAccepted: 3, tariff: true`. No numbers of p20 change.
2. `GameState` gains `accepted: Record<string, number>` — how many times each petition was answered "yes" (forced "no" does not count). Start `{}`.
3. A petition whose `accepted[id] >= maxAccepted` is never drawn again: `drawPetition` and `suggestOther` skip it (as if permanently used; the deck reset must not bring it back). If every petition were capped the draw would throw — impossible with the Albanian data; add a guard that throws a clear error.
4. **Yearly penalty (our addition):** at the start of every quarter with `quarter % 4 === 1` and `quarter > 1` (each January from 1926), before the budget is booked: `penalty = RULES.tariffPenaltyPerYear × tariffsInForce`, where `tariffsInForce` = the sum of `accepted[id]` over petitions with `tariff: true`; `income = max(0, income − penalty)`; emit `{ type: 'tariffPenalty', tariffs: tariffsInForce, amount: penalty }` when `penalty > 0`. `RULES.tariffPenaltyPerYear = 1`. The decrease is permanent, so it piles up year after year.
5. Mother's forecast: accepting a `tariff` petition adds a warning `{ kind: 'tariffDrain' }`; `motherSays` → `„Cla dusí obchod, synu. Každý rok pak přijdeme o kus příjmů.“`. `forecast` needs to know the record is a tariff: give `forecast(s, effects, opts?: { tariff?: boolean })`, and the petition callers (text mode `main.ts` audience prompt, and anything else that forecasts a petition "yes") pass `{ tariff: p.tariff }`.
6. Text: the money line of a tariff petition adds `, každý rok −1 tis. příjmů za každé clo` (from `RULES.tariffPenaltyPerYear`). The text mode shows the `tariffPenalty` event: `Cla dusí obchod: příjmy −X tis. (cel v platnosti: N).` (add strings to `cs.diktator.events`).
7. Save: `GameState.version` 4, `SAVE_VERSION` 4.
8. Spec §4.1: add a sentence under the budget paragraph: tariffs capped at 3 accepted, yearly permanent income penalty of 1 tis. per tariff in force (our addition, play-test change).

## Steps

- [ ] Failing tests first: `tests/diktator/tariffs.test.ts` for rules 2–4 (accepting p20 counts; capped p20 is never drawn even after a deck reset; suggestOther skips it; January penalty applies and piles up over two years; no penalty in 1925 or without tariffs; forced "no" does not count); extend `forecast.test.ts` / `effects-text.test.ts` for rules 5–6; `state.test.ts` / `save.test.ts` for rule 7; `scenario.test.ts` spot check for p20's new fields.
- [ ] Implement in `logic/records.ts`, `logic/state.ts`, `logic/audience.ts`, `logic/money.ts` or `logic/turn.ts` (`startQuarter`), `logic/rules.ts`, `logic/forecast.ts`, `logic/save.ts`, `scenario/albania/records.ts`, `ui/effects-text.ts`, `main.ts`, `src/shared/i18n/cs.ts` (`diktator` only).
- [ ] Keep every existing test's intent; list any changed test with the reason.
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` green; palace mode unaffected.
- [ ] Commit `feat(diktator): tariffs capped at three, each costs income every year` (Co-Authored-By trailer in the body).
