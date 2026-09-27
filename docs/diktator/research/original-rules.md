# Dictator (Don Priestley, DK'Tronics 1983) — original rules reference

Source of truth: the original English BASIC from the official TAP on Spectrum Computing
(https://spectrumcomputing.co.uk/entry/1388/ZX-Spectrum/Dictator), detokenised; line numbers `L…` refer to it.
Manual: https://spectrumcomputing.co.uk/pub/sinclair/games-info/d/Dictator.txt.
Spanish listing (identical logic): http://programandala.net/es.programa.dictador.html.
Where the C (kastian) / C# (sfvicente) remakes disagree with the BASIC, **the BASIC wins** (§7).

## 1. State and starting values (L140–L244)

8 groups, popularity and strength each clamped 0–9.

| # | Group | Pop | Str |
|---|---|---|---|
| 1 | Army | 7 | 6 |
| 2 | Peasants | 7 | 6 |
| 3 | Landowners | 7 | 6 |
| 4 | Guerillas | 0 | 6 |
| 5 | Leftotans (neighbour) | 7 | 6 |
| 6 | Secret Police | 7 | 6 |
| 7 | Russians | 7 | – |
| 8 | Americans | 7 | – |

- Only groups 1–3 plot. Status: none / **A** (assassination) / **R** (revolution, with ally 1–6).
- Treasury `bk` = 1000 (units of $1 000). Monthly costs `mpy` = 60. Player strength (bodyguard) `st` = 4.
  Swiss account `sw` = 0. Month `mth` = 0. Alive bonus `d` = 10. Plot cooldown `pc` = 0.
- Re-rolled every month: `low` = 2 + rnd(0..2) (pop ≤ low = hostile); `str` = 10 + rnd(0..2) (strength for revolution).
- 49 records with a used flag: 1–24 petitions, 25–43 decisions, 44–49 news.

## 2. Monthly loop (L600…)

1. Re-roll `low`, `str`; month += 1.
2. **Plot** (L1400): nothing if `mth ≤ 2`; clear statuses of 1–3; stop if `mth < pc`. For each faction a with pop ≤ low:
   first p in 1..6 (p ≠ a, pop(p) ≤ low) with str(a)+str(p) ≥ `str` → R with ally p; else → A.
3. **Money**: if `bk < 0` → bankruptcy: Army pop −1, Police pop −1, Police str −1, `st` −1 (floor 0), re-plot.
   Then if `bk > 0`: `bk -= mpy` (at exactly 0 nothing happens; can go negative, penalty repeats).
4. **Audience** (§3), treasury report. 5. Re-plot.
6. **Assassination** (L1500). 7. **War** (L4200). 8. Re-plot, police report offer.
9. **Decision** (§4), one per month. 10. Treasury, re-plot, police report offer.
11. **News** (1/3 chance, unused random item) then **revolution**: 3 tries picking a random faction 1–3; if one has R → revolution.

**Police report** (L1700): costs 1; only if `bk > 0`, police pop > low and police str > low. Shows all bars, statuses, allies, `st`, `str`.

## 3. Petitions (records 1–24)

Random unused r (cyclic step; reset all when exhausted); petitioner = Army 1–8, Peasants 9–16, Landowners 17–24.
Cash check: affordable if `bk + cost > 0`, else unaffordable if (cost<0 or mo<0) and (bk+cost<0 or bk+mo<0) → forced NO.
Accept: apply all, `bk += cost`, `mpy -= mo` (floor 0). Refuse: petitioner pop −(what accepting gave it).

Cost = one-off treasury change in $k; Mo = change of monthly cost (+ = costs rise).

| # | Petition | Cost | Mo | Popularity | Strength |
|---|---|---|---|---|---|
|1|Introduce conscription|0|+5|Arm+4 Pea−3 Lan−1|Arm+3 Pea−2 Lan−1|
|2|Requisition land for training|0|0|Arm+3 Lan−3|Arm+1 Lan−1|
|3|Attack all guerilla bases|−100|0|Arm+3 Pea−1 Lan+1 Lef−1 Rus−1|Arm+1 Lan+1 Gue−4|
|4|Attack guerilla bases in Leftoto|−80|0|Arm+3 Pea−1 Lef−4 Rus−1|Arm+1 Lan+1 Gue−2|
|5|Sack the secret police chief|0|0|Arm+4 Pea+2 Lan+1 SP−4|Arm+1 Lan+1 SP−3|
|6|Expel Russian military advisors|0|0|Arm+3 Lef−1 Rus−4 USA+2|–|
|7|Increase the pay of the troops|0|+9|Arm+4 Lan−1|Arm+2 Pea−1 Lan−1 Gue−1|
|8|Buy more arms and ammunition|−120|0|Arm+4 Pea−1 Lan−1 Lef−1 SP−1|Arm+3 Pea−1 Lan−1 Gue−2 Lef−1|
|9|Stop army sign-up coercion|0|0|Arm−1 Pea+2 Lan+1|Arm−1 Gue−1|
|10|Increase the basic minimum wage|0|0|Pea+4 Lan−4 Lef+1|Pea+2 Lan−1|
|11|Cut the powers of the S. Police|0|−3|Arm+1 Pea+4 Lan+2 SP−4|Arm+1 Pea+1 Lan+1 Gue+1 SP−3|
|12|Stop Leftotan immigrant workers|0|0|Pea+3 Lan−2 Lef−2|Pea+2 Lan−2|
|13|Introduce free education for all|−100|+8|Arm−1 Pea+4 Lan−2 Lef+2 SP−1 Rus+1|Pea+1 Lan−1 Gue−1|
|14|Legalise the formation of unions|0|0|Pea+4 Lan−3 Lef+1 SP−1 Rus+1|Pea+3 Lan−3 SP−1|
|15|Free their imprisoned leader|0|0|Arm−1 Pea+4 Lan−2 Lef+1 SP−1|Pea+2 Lan−1 Gue−1|
|16|Start a public lottery|0|−6|Pea+3 Lan−1|Gue−1|
|17|Stop military use of their land|0|0|Arm−2 Lan+3|Arm−1|
|18|Lower the basic minimum wage|0|0|Pea−4 Lan+4 Lef−1 Rus−1|Pea−2 Lan+2 Gue+1|
|19|Nationalise American businesses|+100|+5|Lan+3 Lef+1 Rus+2 USA−4|Lan+1|
|20|Levy duty on all Leftoto imports|0|−5|Lan+3 Lef−3 Rus−1|Pea+1 Lan+2 Lef−1|
|21|Cut spending on the S. Police|0|−4|Arm+1 Pea+1 Lan+3 SP−4|Arm+1 Lan+1 Gue+1 SP−2|
|22|Decrease heavy land taxation|0|+5|Lan+4|Lan+2|
|23|Release troops to work the land|0|0|Arm−2 Pea−1 Lan+3|Arm−1 Pea−1 Lan+1 Gue+1|
|24|Build a large irrigation system|−120|+10|Arm+1 Pea+1 Lan+3 Lef−3 Rus+2 USA+1|Lan+3 Lef−2|

## 4. Decisions (records 25–43, L2500)

Menu sections: 1 Please a group, 2 Please all, 3 Improve your chances, 4 Raise cash, 5 Strengthen a group.
One per month, each once, except `*` (reusable). Unaffordable → back to menu.

| Sec | # | Decision | Cost | Mo | Popularity | Strength / special |
|---|---|---|---|---|---|---|
|1|25|Make army chief vice-president|0|0|Arm+4 Pea−1 Lan−1 SP−1|Arm+1 Gue−1 SP−1|
|1|26|Set up free clinics for workers|−10|+4|Arm−1 Pea+4 Lan+1 Lef+2 Rus+1|Gue−1|
|1|27|Give landowners regional powers|0|0|Arm−1 Pea−2 Lan+4 SP−1 Rus−1|Arm−1 Pea−1 Lan+2 SP−1|
|1|28|Sell American arms to Leftoto|+50|0|Arm−2 Lef+4 Rus−2 USA+1|Arm−1 Gue−1 Lef+3|
|1|29|Sell mining rights to U.S. firms|+120|0|Lan−1 Lef−1 Rus−2 USA+3|–|
|1|30|Rent the Russians a naval base|0|−10|Arm−2 Rus+3 USA−3|Lef+1|
|2|31|Decrease general taxation level|0|+8|Arm+1 Pea+3 Lan+3|Arm−1 Gue−1|
|2|32|Stage a big popularity campaign|−80|0|Arm+3 Pea+3 Lan+3|Gue−1|
|2|33|Cut S. Police powers completely|0|−8|Arm+3 Pea+3 Lan+3 SP−9|Arm+2 Pea+1 Lan+1 Gue+1 SP−9|
|3|34|Increase S. Police powers a lot|0|+6|Arm−3 Pea−3 Lan−3 SP+8|Arm−1 Pea−1 Lan−1 Gue−1 SP+8|
|3|35|Increase your bodyguard *|−40|0|Arm−2 Pea−1 Lan−1 SP−1|Arm−2 SP−1; `st += 2`|
|3|36|Buy an escape helicopter|−120|0|Arm−4 Pea−4 Lan−3 SP−2|helicopter flag|
|3|37|See to your Swiss bank account *|–|–|–|x = ⌊bk/2⌋; if x ≥ 1: sw += x, bk −= x|
|4|38|Ask the Russians for a loan|–|–|–|foreign aid|
|4|39|Ask Americans for foreign aid|–|–|–|foreign aid|
|4|40|Nationalise Leftotan businesses|+130|0|Arm+1 Pea+1 Lan+3 Lef−6 Rus−2|–|
|5|41|Buy heavy artillery for the army|−50|0|Arm+3 Lef−3 Rus−1|Arm+5 Gue−2 Lef−2 SP−1|
|5|42|Allow peasants free movement|0|0|Pea+3 Lan−1 SP−1|Pea+5 Lan−1 Gue+3 SP−1|
|5|43|Allow landowners private militia|0|0|Arm−1 Pea−1 Lan+3 SP−1|Arm−1 Pea−1 Lan+5 Gue−1 SP−1|

**Foreign aid** (L2060), in order: `mth < 3 + rnd(0..4)` → too early; already granted → no more loans;
lender pop ≤ low → refused (may ask later); else receive `pop*30 + rnd(0..199)`, lender marked used.
A failed attempt still uses the month's decision.

## 5. Events

**News** (1/3 chance per month, after the decision; one-off, no money):

| # | News | Popularity | Strength |
|---|---|---|---|
|44|President loses S. Police files|SP−4|Gue+4 SP−4|
|45|Cubans arm and train guerillas|–|Arm−1 Gue+9|
|46|Accident: army barracks blows up|–|Arm−4 Gue+2 SP+1|
|47|Banana prices fall by 98%|–|Lan−3 Lef−2|
|48|Major earthquake in Leftoto|–|Lan+2 Lef−4|
|49|A plague sweeps through peasants|–|Pea−4 Lan−1 Gue−2|

**Assassination** (L1500): pick a random faction 1–3; nothing unless its status is A. Die if all three are A.
Otherwise survive if police pop > low OR police str > low OR a 50 % coin flip succeeds.

**War** (L4200): only if neighbour pop ≤ low and neighbour str ≥ low.
2/3: "threat of war" → pop +1 for Army, Peasants, Landowners and Secret Police.
1/3: invasion. Home = `st` + str of factions 1–3 with pop > low + police str if police pop > low.
Enemy = sum of str of groups 1–6 with pop ≤ low. Enemy wins if `enemy + rnd(−1..1) ≥ home`.
Win → neighbour str = 0. Lose → helicopter: 2/3 escape, else executed; no helicopter → executed.

**Revolution** (L1810): offer escape. Helicopter: 2/3 escape, 1/3 fails → mountains.
Mountains: caught if `INT(RND*(G/3+0.4)) ≠ 0` (G = guerilla str): G=0 → always escape, G=6 ≈ 42 %, G=9 ≈ 29 %.
Stay: rebels x = str(faction) + str(ally). Player picks an ally among groups 1–6 with pop > low
(picking one with pop ≤ low → forced to the mountains). Win if `x ≤ st + str(ally) + rnd(−1..1)`.
After a win: optional punish (rebel faction and its ally → pop = str = 0); **ally str = 9**; `pc = mth + 2`.
Original bug: no eligible ally leaves `h` unset → remake uses `st` alone.

## 6. End and score (L3000)

Ends on death or escape; no win condition. Score = Σ popularity (8 groups) + 3 × months;
if alive + 10 + ⌊sw/10⌋.

## 7. Known remake deviations (do not copy)

- kastian (C): treasury 0 counts as bankrupt; assassination logic inverted (dies if police weak OR unpopular OR coin);
  mountain formula `G/3+2` and no death when caught; revolution ally gets pop 9 instead of str 9.
- sfvicente (C#): threat of war lowers police pop; news 1/2; helicopter fails 1/4; mountain logic inverted;
  same assassination inversion; misreads 'Z' (record 40 is +130, not +120).
- The manual says Leftoto "will not make war"; the code has invasions (code wins).
