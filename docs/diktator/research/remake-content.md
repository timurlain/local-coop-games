# Content and mechanics harvested from other Dictator remakes

Only **pelikalkkuna/dictator** (https://github.com/pelikalkkuna/dictator, Finnish browser remake, data in
`js/data/audienssit.js`, `uutiset.js`, `paatokset.js`, `kriisikortit.js`, rules in `docs/GDD.md`) adds real
content. Its numbers are its own balancing (made without the original source). ritimba
(https://github.com/programandala-net/ritimba), kastian, sfvicente, harbour-dictator, Pico Dictator and the
Czech Sharp/Atari ports copy the original data.

Notation: Arm, Pea, Lan, Gue, Lef (neighbour), SP, Rus, USA. `$` one-off treasury change (−80 = pay 80k).
`/mo` monthly cost change (+ = costs rise).

## Candidate petitions (to be re-themed for Albania)

| ID | From | Text | Pop | Str | Money |
|---|---|---|---|---|---|
| A8 | Army | Remove landowners from the administration | Arm+3 Lan−3 Pea+1 | – | – |
| A10 | Army | Buy new radio equipment abroad | Arm+3 USA+2 Rus−3 | Arm+1 | −40 |
| A11 | Army | Give farmland to veterans | Arm+3 Lan−3 Pea+1 | Arm+1 Lan−1 | – |
| A12 | Army | Hold a grand military parade | Arm+2 Pea+1 Lef−1 | – | −30 |
| A13 | Army | Purge suspected leftists from the officer corps | Arm+3 Lef−2 Rus−2 | Arm−1 Gue+1 | – |
| A14 | Army | Joint exercises with a foreign power | Arm+2 Pea−1 USA+3 Rus−3 | Arm+1 | −15 |
| A15 | Army | Crush student protests by force | Arm+3 Pea−4 Lan+1 | Arm+1 Pea−1 | −5 |
| P6 | Peasants | Set up public health care | Pea+4 Lan−2 Rus+1 | Gue−1 | −80, +5/mo |
| P8 | Peasants | Expropriate idle land for cooperatives | Pea+4 Lan−4 USA−1 | Pea+1 Lan−1 | – |
| P9 | Peasants | Price cap on basic goods | Pea+3 Lan−2 | – | /mo sign unclear |
| P10 | Peasants | National literacy campaign | Pea+3 Lan−1 | Gue−1 | −40 |
| P11 | Peasants | Fertiliser subsidies for smallholders | Pea+3 Lan−1 | Pea+1 | −25 |
| P12 | Peasants | Let refugees from the neighbour settle in border villages | Pea+2 Arm−2 Lan−2 Lef+3 | Pea+1 Lef−1 | – |
| P13 | Peasants | Nationalise the foreign water company | Pea+4 Lan−1 USA−3 | Pea+1 | +15 |
| M9 | Landowners | Expand plantations | Lan+3 Pea−2 Lef−1 | Lan+1 | /mo sign unclear |
| M10 | Landowners | Sell a monopoly to a foreign power | Lan+2 Pea−2 USA+3 Rus−3 | – | +80 |
| M11 | Landowners | Break strikes by force | Lan+3 Pea−3 SP+1 | Lan+1 Pea−1 | – |
| M12 | Landowners | Destroy guerrilla smuggling routes on our land | Lan+3 Arm−1 | Lan+1 Gue−2 | −20 |
| M13 | Landowners | Tax breaks for foreign investors | Lan+3 Pea−2 USA+2 | Lan+1 | /mo sign unclear |
| M14 | Landowners | Deport the union leaders | Lan+3 Pea−3 Lef−2 | Lan+1 Pea−1 | – |

## Crisis demands (negotiation during a coup/revolt)

| ID | Group | Demand | Pop | Str | Money |
|---|---|---|---|---|---|
| C1 | Army | Make the general vice-president | Arm+1 | Arm+3 | +5/mo |
| C2 | Army | Full autonomy for the army | Arm+1 Pea−1 Lan−1 | Arm+2 Gue−1 | – |
| E1 | Landowners | Cut land tax sharply | Lan+1 Pea−2 | Lan+1 | +8/mo |
| E2 | Landowners | Legalise private militias | Lan+1 Arm−1 Pea−2 | Lan+3 Gue−1 | – |

## Candidate news (selection worth re-theming; one-off)

| ID | Text (original theme) | Pop | Str | Money |
|---|---|---|---|---|
| N8 | We beat the neighbour at football | Pea+2 Lef−1 | – | −10 |
| N9 | Big power cut in the capital | Lan−1 | SP−1 | – |
| N11 | General caught smuggling cigars | Arm−1 Pea+1 | – | +20 |
| N12 | Heavy rains delay the harvest | Pea−1 Lan−1 | – | −5 |
| N15 | Golden statue of the ruler finished | Lan+1 Pea−2 | – | −25 |
| N17 | National lottery exposed as a swindle | Pea−2 SP+1 | – | +30 |
| N18 | Neighbour's leader mocks the ruler on radio | Arm+1 Pea+1 Lan+1 Lef−3 | – | – |
| N21 | Rebels daub graffiti on the palace wall | SP−1 | Gue+1 | – |
| N24 | Neighbour's cattle stray over the border | Lef−1 Lan+1 | – | – |
| N27 | New army uniforms shrink in the wash | Arm−1 | Gue+1 | −2 |
| N30 | Secret police arrest the postman by mistake | SP−1 Arm+1 | – | – |
| N32 | The country's only train derailed by a cow | Pea−1 Lan−1 | – | −2 |
| N34 | New stamps' glue tastes of garlic | Pea−1 SP+1 | – | – |
| N36 | Rebels blow up their own store | Arm+1 | Gue−1 | – |
| N37 | Neighbour claims our national dish | Lef−2 Pea+1 Lan+1 | – | – |
| N38 | General's parrot shouts state secrets | Arm−1 SP+1 | – | – |
| N42 | State radio plays the rebel song by mistake | SP−1 | Gue+1 | – |

## Conditional, repeatable news (condition checked when drawn; failed → back in the deck)

| ID | Text | Condition | Effect |
|---|---|---|---|
| N43 | Unhappy peasants flee to the rebels | Pea pop ≤ 2 | Str Gue+2 Pea−1 |
| N44 | Young men join the rebels | Pea pop ≤ 3 and Lan pop ≥ 6 | Str Gue+1; Pop Lan−1 |
| N45 | Army catches a rebel band | Arm str ≥ 7 and Arm pop ≥ 5 | Str Gue−2; Pop Arm+1 |
| N46 | Secret police expose a rebel cell | SP str ≥ 7 | Str Gue−1; Pop SP+1 |
| N47 | Rebels secretly get foreign arms | USA pop ≤ 2 and Rus pop ≥ 5 | Str Gue+2; Pop USA−1 |
| N48 | Priest condemns the regime in a sermon | Pea pop ≤ 3 and Lan pop ≤ 3 | Str Gue+1; Pop Pea−1 |

## Mechanics worth borrowing (ranked)

1. Conditional news with "put back if the condition fails".
2. War escalation spiral: per month of spiral, chance of war 40/60/85/100 %, chance the neighbour backs down 10/15/20 %;
   "war debt" afterwards (factions −1 pop per month for the spiral's length).
3. Choosing a defender without visible numbers — makes the police report valuable.
4. Audience answers "Go away" (−1 pop, card returns later) and "Suggest something else" (once, draw another from the same group).
5. Foreign aid scaled by the popularity gap between the two powers (0 / 50 / 130 / 200 / 270 / 330).
6. Coups and landowner revolts can be negotiated (50/50 → a hard demand), peasant revolution cannot.
7. Choose how much to send to Switzerland (all, ½, ⅓, ¼, ⅕) — ritimba.

## Czech wording precedent (František Fuka's translation)

Armáda, Rolníci, Farmáři/Statkáři (uncertain), Partyzáni, Leftotané, Tajná policie, Rusové, Američané, Bodyguardi;
"Pokladní hlášení", "Policejní hlášení", "Audience", vrtulník, švýcarská banka.
The famous slip "ceny banánů klesly **na** 98 %" is a period in-joke worth one nod.
