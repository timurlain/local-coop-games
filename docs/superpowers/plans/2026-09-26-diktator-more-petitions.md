# Diktátor — 36 more unique petitions (play-test change)

> **For agentic workers:** one task, TDD. Steps use checkbox (`- [ ]`) syntax.

**Goal:** 60 unique petitions (24 original + 20 adapted from the Finnish remake + 16 new Albanian), so a 57-quarter game almost never reshuffles the deck and repeats petitions.

**Why:** Play-test feedback (the user, 2026-09-26): with 24 petitions the deck is reshuffled about twice per game, so money-changing petitions (pay rise, tax cut, conscription…) can be accepted again and again. The user asked for more unique petitions. (Originally planned for plan 3; moved earlier.)

**Sources:** remake numbers from `docs/diktator/research/remake-content.md` (pelikalkkuna/dictator), mapped Army→`armada`, Peasants→`rolnici`, Landowners→`statkari`, Guerillas→`povstalci`, Leftoto→`jugoslavie`, SP→`policie`, Russians→`italie`, Americans→`britanie`. Where the remake's monthly sign was unclear (P9, M9, M13) the value below is our decision. The 16 new ones are our design in the original's style (petitioner +3…+4, others pay).

## The records

Append these to `PETITIONS` in `src/games/diktator/scenario/albania/records.ts`, after `p24`, with a comment line before each block (`// Remake (pelikalkkuna), re-themed` and `// New, from Albanian history (our design)`). Copy verbatim.

```ts
  // Remake (pelikalkkuna/dictator), re-themed for Albania
  { id: 'r01', from: 'armada', origin: 'remake', title: 'Vyhodit statkáře z krajských úřadů',
    effects: { pop: { armada: 3, statkari: -3, rolnici: 1 } } },
  { id: 'r02', from: 'armada', origin: 'remake', title: 'Koupit armádě britské vysílačky',
    effects: { cost: -40, pop: { armada: 3, britanie: 2, italie: -3 }, str: { armada: 1 } } },
  { id: 'r03', from: 'armada', origin: 'remake', title: 'Dát vysloužilým vojákům půdu',
    effects: { pop: { armada: 3, statkari: -3, rolnici: 1 }, str: { armada: 1, statkari: -1 } } },
  { id: 'r04', from: 'armada', origin: 'remake', title: 'Uspořádat velkou vojenskou přehlídku v Tiraně',
    effects: { cost: -30, pop: { armada: 2, rolnici: 1, jugoslavie: -1 } } },
  { id: 'r05', from: 'armada', origin: 'remake', title: 'Vyhodit z důstojnického sboru přátele Itálie',
    effects: { pop: { armada: 3, jugoslavie: -2, italie: -2 }, str: { armada: -1, povstalci: 1 } } },
  { id: 'r06', from: 'armada', origin: 'remake', title: 'Uspořádat společné manévry s britskou armádou',
    effects: { cost: -15, pop: { armada: 2, rolnici: -1, britanie: 3, italie: -3 }, str: { armada: 1 } } },
  { id: 'r07', from: 'armada', origin: 'remake', title: 'Rozehnat studentské protesty v Tiraně',
    effects: { cost: -5, pop: { armada: 3, rolnici: -4, statkari: 1 }, str: { armada: 1, rolnici: -1 } } },
  { id: 'r08', from: 'rolnici', origin: 'remake', title: 'Zřídit venkovské nemocnice',
    effects: { cost: -80, monthly: 5, pop: { rolnici: 4, statkari: -2, italie: 1 }, str: { povstalci: -1 } } },
  { id: 'r09', from: 'rolnici', origin: 'remake', title: 'Rozdělit ladem ležící půdu rolnickým družstvům',
    effects: { pop: { rolnici: 4, statkari: -4, britanie: -1 }, str: { rolnici: 1, statkari: -1 } } },
  { id: 'r10', from: 'rolnici', origin: 'remake', title: 'Stanovit nejvyšší ceny chleba a soli',
    effects: { monthly: 5, pop: { rolnici: 3, statkari: -2 } } },
  { id: 'r11', from: 'rolnici', origin: 'remake', title: 'Zahájit kampaň proti negramotnosti',
    effects: { cost: -40, pop: { rolnici: 3, statkari: -1 }, str: { povstalci: -1 } } },
  { id: 'r12', from: 'rolnici', origin: 'remake', title: 'Podpořit drobné rolníky osivem a hnojivem',
    effects: { cost: -25, pop: { rolnici: 3, statkari: -1 }, str: { rolnici: 1 } } },
  { id: 'r13', from: 'rolnici', origin: 'remake', title: 'Usadit jugoslávské přistěhovalce v pohraničních vesnicích',
    effects: { pop: { rolnici: 2, armada: -2, statkari: -2, jugoslavie: 3 }, str: { rolnici: 1, jugoslavie: -1 } } },
  { id: 'r14', from: 'rolnici', origin: 'remake', title: 'Znárodnit britskou vodárenskou společnost',
    effects: { cost: 15, pop: { rolnici: 4, statkari: -1, britanie: -3 }, str: { rolnici: 1 } } },
  { id: 'r15', from: 'statkari', origin: 'remake', title: 'Vysušit bažiny pro nové olivové háje',
    effects: { income: 4, pop: { statkari: 3, rolnici: -2, jugoslavie: -1 }, str: { statkari: 1 } } },
  { id: 'r16', from: 'statkari', origin: 'remake', title: 'Prodat Britům monopol na tabák',
    effects: { cost: 80, pop: { statkari: 2, rolnici: -2, britanie: 3, italie: -3 } } },
  { id: 'r17', from: 'statkari', origin: 'remake', title: 'Rozehnat stávku na naftových polích v Kuçově',
    effects: { pop: { statkari: 3, rolnici: -3, policie: 1 }, str: { statkari: 1, rolnici: -1 } } },
  { id: 'r18', from: 'statkari', origin: 'remake', title: 'Zničit pašerácké stezky povstalců na jejich pozemcích',
    effects: { cost: -20, pop: { statkari: 3, armada: -1 }, str: { statkari: 1, povstalci: -2 } } },
  { id: 'r19', from: 'statkari', origin: 'remake', title: 'Dát daňové úlevy cizím investorům',
    effects: { income: -3, pop: { statkari: 3, rolnici: -2, britanie: 2 }, str: { statkari: 1 } } },
  { id: 'r20', from: 'statkari', origin: 'remake', title: 'Vyhostit vůdce rolnických spolků',
    effects: { pop: { statkari: 3, rolnici: -3, jugoslavie: -2 }, str: { statkari: 1, rolnici: -1 } } },
  // New, from Albanian history (our design)
  { id: 'a01', from: 'armada', origin: 'new', title: 'Postavit vojenskou silnici do hor Mirdity',
    effects: { cost: -60, pop: { armada: 3, rolnici: 1, statkari: -1 }, str: { armada: 1, povstalci: -2 } } },
  { id: 'a02', from: 'armada', origin: 'new', title: 'Odzbrojit horské klany',
    effects: { pop: { armada: 3, rolnici: -2, statkari: -2 }, str: { armada: 1, rolnici: -1, povstalci: -3 } } },
  { id: 'a03', from: 'armada', origin: 'new', title: 'Poslat mladé důstojníky na studia do Itálie',
    effects: { cost: -20, pop: { armada: 3, italie: 2, britanie: -1 }, str: { armada: 1 } } },
  { id: 'a04', from: 'armada', origin: 'new', title: 'Najmout české instruktory ze Zbrojovky Brno',
    effects: { cost: -30, pop: { armada: 3, italie: -1 }, str: { armada: 2 } } },
  { id: 'a05', from: 'armada', origin: 'new', title: 'Zesílit hlídky na jugoslávské hranici',
    effects: { monthly: 4, pop: { armada: 2, jugoslavie: -2 }, str: { armada: 1, jugoslavie: -1 } } },
  { id: 'a06', from: 'rolnici', origin: 'new', title: 'Postavit v každém kraji albánskou školu',
    effects: { cost: -60, pop: { rolnici: 4, statkari: -1, italie: -2 }, str: { povstalci: -1 } } },
  { id: 'a07', from: 'rolnici', origin: 'new', title: 'Snížit desátek z úrody',
    effects: { income: -4, pop: { rolnici: 4, statkari: -1 }, str: { rolnici: 1 } } },
  { id: 'a08', from: 'rolnici', origin: 'new', title: 'Vysušit malarické bažiny u Durrësu',
    effects: { cost: -50, pop: { rolnici: 3, statkari: 1 }, str: { rolnici: 1 } } },
  { id: 'a09', from: 'rolnici', origin: 'new', title: 'Zakázat krevní mstu',
    effects: { pop: { rolnici: 3, armada: -1, statkari: -2, policie: 1 }, str: { povstalci: -1 } } },
  { id: 'a10', from: 'rolnici', origin: 'new', title: 'Otevřít trh s tabákem drobným pěstitelům',
    effects: { income: 2, pop: { rolnici: 3, statkari: -3 }, str: { rolnici: 1, statkari: -1 } } },
  { id: 'a11', from: 'rolnici', origin: 'new', title: 'Pustit rolníky do lesů bejů',
    effects: { pop: { rolnici: 4, statkari: -4 }, str: { rolnici: 1, statkari: -1 } } },
  { id: 'a12', from: 'statkari', origin: 'new', title: 'Vrátit bejům půdu z pozemkové reformy',
    effects: { pop: { statkari: 4, rolnici: -4 }, str: { statkari: 2, rolnici: -1 } } },
  { id: 'a13', from: 'statkari', origin: 'new', title: 'Dovolit bejům vybírat mýto na cestách',
    effects: { income: -2, pop: { statkari: 3, rolnici: -2 }, str: { statkari: 1 } } },
  { id: 'a14', from: 'statkari', origin: 'new', title: 'Postavit ve Vloře přístav pro vývoz oleje',
    effects: { cost: -100, income: 4, pop: { statkari: 3, italie: 1 }, str: { statkari: 1 } } },
  { id: 'a15', from: 'statkari', origin: 'new', title: 'Jmenovat bejy prefekty krajů',
    effects: { pop: { statkari: 4, armada: -2, policie: -1 }, str: { statkari: 1, policie: -1 } } },
  { id: 'a16', from: 'statkari', origin: 'new', title: 'Uvalit clo na italské zboží', maxAccepted: 3, tariff: true,
    effects: { income: 5, pop: { statkari: 3, italie: -3 }, str: { statkari: 1 } } },
```

## Rules

1. The Albania scenario has **60 petitions**: 20 `armada`, 21 `rolnici`, 19 `statkari`; ids unique; origins 24 `original`, 20 `remake`, 16 `new`.
2. `a16` is a tariff: it counts towards the yearly tariff penalty together with `p20` (the penalty already sums `accepted` over every `tariff: true` petition), and is capped at 3 like `p20`.
3. The palace's `wishFor` / Mother's forecast / money text need no change (they read records generically) — verify with a test that `moneyText` and `groupText` work on a new record (e.g. `a14`: `stojí 100 tis., příjmy +4 tis. každé čtvrtletí`).
4. Existing tests that assume 24 petitions or all-`original` origins change to the new counts (scenario validator); tests that draw a petition by a scripted dice index (`drawPetition` with `scriptedDice([4])` → `p05` etc.) keep working because the first 24 entries keep their order — verify; if one breaks, fix the test's setup, not the data order.
5. No save version bump is needed (no state shape change), but saved games from before keep working: their `used` map simply lacks the new ids.
6. `docs/superpowers/specs/2026-09-26-diktator-design.md` §8 table: petitions row now says "the original 24, 20 adapted from the remake, 16 new Albanian (60)" and that this was moved from plan 3 after play-test feedback.

## Steps

- [ ] Update `tests/diktator/scenario.test.ts` (counts, origins, spot checks for `r08`, `a14`, `a16`) and add the `effects-text` check — they fail.
- [ ] Add the records verbatim.
- [ ] Fix any other test only by setup, never by reordering or editing data; list changed tests with reasons.
- [ ] `npx vitest run`, `npx tsc --noEmit`, `npm run build` green (including the classic and palace bots).
- [ ] Update the spec §8 row.
- [ ] Commit `feat(diktator): 60 unique petitions — remake and Albanian history` (Co-Authored-By trailer in the body).
