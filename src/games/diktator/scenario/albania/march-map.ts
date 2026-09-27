// Pochod na Tiranu — the hand-authored map (spec 2026-09-27-diktator-pochod-design §4.2, §4.3, §4.5). Data only.
// 80 × 45 tiles of 60 units (4800 × 2700). North is up; the Yugoslav border is the east edge, Tirana the south-west.
// Legend: = road, b bridge, . meadow, f forest, s snow, o ford, ~ river, m mountain rock, w lake.
// The Black Drin (x ≈ col 69) is crossed at the Maqellarë bridge (69, 29) and the ford (69, 37); the Mat is crossed
// only at the Burrel bridge (41, 24). Burrel → Krujë: the snowy pass Qafa e Shtamës (rows 21–24) or the Mat gorge
// road past Klos. Kukës is a dead end up the Drin.

import type { MarchMap } from '../../minigames/march/map';

export const ALBANIA_MARCH: MarchMap = {
  cols: 80,
  rows: 45,
  tile: 60,
  terrain: [
  // 0         1         2         3         4         5         6         7
  // 01234567890123456789012345678901234567890123456789012345678901234567890123456789
  '.................................~...................m.........~.....ssmmmmmmmmm', // 0
  '.................................~......m..........mmmmm.......~~....ssmmmmmmmmm', // 1
  '.................................~~...mmmmm.......mmmmmmm.......~~...ssmmmmmmmmm', // 2
  '..................................~...mmmmm......mmmmmmmmm.......~~..ssmmmmmmmmm', // 3
  '..................................~..mmmmmmm......mmmmmmm.........~~.ssmmmmmmmmm', // 4
  '..............................f...~...mmmmm.f......mmmmm...........~.ssmmmmmmmmm', // 5
  '............................fffff.~~..mmmmmffff......m......=====..~~ssmmmmmmmmm', // 6
  '...........................fffffff.~....mfffffff..........===...=...~ssmmmmmmmmm', // 7
  '..........................fffffffff~....fffffffff...............=...~ssmmmmmmmmm', // 8
  '...........................fffffff.~.....fffffff.....fffff......=...~ssmmmmmmmmm', // 9
  '............................fffff..~~.....fffff.....fffffff.....=...~~smmmmmmmmm', // 10
  '..............................f.....~.......f......fffffffff....=....~smmmmmmmmm', // 11
  '....................................~...............fffffff.....=.f..~smmmmmmmmm', // 12
  '......................mmmmmmmmmmmmm.~~...............fffff......=fff.~smmmmmmmmm', // 13
  '......................mmmmmmmmmmmmm..~.....=..............s.....=fff.~smmmmmmmmm', // 14
  '......................mmmmmmmmmmmmm..~.....==..........sssssss..=fff.~smmmmmmmmm', // 15
  '......................mmmmmmmmmmmmm..~~ww...==........ssmmmmmss.=ffff~smmmmmmmmm', // 16
  '............f.........mmmmmmmmmmmmm.ww~www...==....m.ssmmmmmmmss=fff.~smmmmmmmmm', // 17
  '..........fffff.......mmmmmmmmmmmmm..w~~w.....==..mmmsmmmmmmmmms=fff.~smmmmmmmmm', // 18
  '.........fffffff......mmmmmmmmmmmmm....~.......=.mmmmmmmmmmmmmms=fff.~smmmmmmmmm', // 19
  '........fffffffff.....mmmmmsssssmmm....~~.....==.mmmmmmmmmmmmmmm=.f..~smmmmmmmmm', // 20
  '......f..fffffff..........ssssssss......~.....=..mmmmmmmmmmmmmms=....~smmmmmmmmm', // 21
  '....fffff.fffff...........ssssssss......~....==...mmmsmmmmmmmmms=....~smmmmmmmmm', // 22
  '....fffff...f......==.....ssssssss......~~.===.....m.ssmmmmmmmss=....~ssssssssss', // 23
  '...fffffff.........===....ssssssss....===b==.====.....ssmmmmmss.==...~ssssssssss', // 24
  '....fffff........===.==..mmmmmmmmmmmmm=..~~.....===....sssssss...=...~ssssssssss', // 25
  '....fffff........=....=..mmmmmmmmmmmmm=...~.......===.....s......=...~ssssssssss', // 26
  '......f..........=....==.mmmmmmmmmmmmm=...~~........===........====..~..........', // 27
  '..=====.........==.....==mmmmmmmmmmmmm=....~...f......===...====..===~..........', // 28
  '......========..=.......===..........==....~.fffff......=====.......=b=.........', // 29
  '.............====.........===.......==.....~~fffff...................~====......', // 30
  '...............=............===...===.......~ffffff..................~...====...', // 31
  '.............===..............=====.........~~ffff...........fff.....~......==..', // 32
  '............==.................fffff.........~ffff..........fffff....~..........', // 33
  '...........==.................fffffff........~~f...........fffffff...~..........', // 34
  '..........==.................fffffffff........~...........f.fffff....~..........', // 35
  '...................m..........fffffff.........~~........ffffffff.....~....f.....', // 36
  '.................mmmmmf........fffff...........~.......fffffff.......o..fffff...', // 37
  '.................mmmmmffff.mmmmmmmmmmmmmmmm....~~.....fffffffff......~..fffff...', // 38
  '................mmmmmmmffffmmmmmmmmmmmmmmmm.....~......fffffff.......~.fffffff..', // 39
  '.................mmmmmfffffmmmmmmmmmmmmmmmm.....~.......fffff.m......~..fffff...', // 40
  '.................mmmmmfffffmmmmmmmmmmmmmmmm.....~~........f.mmmmm....~..fffff...', // 41
  '...................mffffff.mmmmmmmmmmmmmmmm......~.........mmmmmmm...~....f.....', // 42
  '......................f....mmmmmmmmmmmmmmmm......~~.........mmmmm....~..........', // 43
  '...........................mmmmmmmmmmmmmmmm.......~...........m......~..........', // 44
  ],
  start: [77, 32],
  goal: [10, 35],
  places: [
    { id: 'maqellare', kind: 'village', at: [72, 30] },
    { id: 'peshkopi', kind: 'barracks', at: [65, 27], guards: [3, 4] },
    { id: 'zerqan', kind: 'village', at: [58, 29] },
    { id: 'bulqize', kind: 'tower', at: [53, 27] },
    { id: 'kukes', kind: 'barracks', at: [64, 6], guards: [4, 5] },
    { id: 'lume', kind: 'tower', at: [58, 7] },
    { id: 'burgajet', kind: 'home', at: [47, 19] },
    { id: 'burrel', kind: 'barracks', at: [44, 23], guards: [2, 3] },
    { id: 'selite', kind: 'tower', at: [43, 14] },
    { id: 'klos', kind: 'village', at: [36, 31] },
    { id: 'kruje', kind: 'barracks', at: [20, 23], guards: [3, 4] },
    { id: 'preze', kind: 'tower', at: [16, 30] },
    // Optional benefits (spec §4.5): detours, never required.
    { id: 'homesh', kind: 'stable', at: [56, 34] },
    { id: 'martanesh', kind: 'volunteers', at: [52, 38] },
    { id: 'posel', kind: 'messenger', at: [10, 29] },
  ],
  roads: [
    [[77, 32], [72, 30], [69, 29], [65, 27], [61, 28], [58, 29], [55, 28], [53, 27], [49, 25], [44, 23]],
    [[44, 23], [41, 24], [38, 24]],
    [[38, 24], [38, 28], [36, 31], [31, 32], [25, 29], [22, 26], [20, 23]],
    [[20, 23], [17, 26], [16, 30], [13, 33], [10, 35]],
    [[16, 30], [10, 29], [2, 28]],
    [[65, 27], [64, 21], [64, 12], [64, 6], [61, 6], [58, 7]],
    [[44, 23], [46, 21], [47, 19], [45, 16], [43, 14]],
  ],
  patrols: [
    [[77, 32], [72, 30], [69, 29]],
    [[65, 27], [61, 28], [58, 29]],
    [[58, 29], [55, 28], [53, 27], [49, 25]],
    [[49, 25], [44, 23], [41, 24]],
    [[65, 27], [64, 21], [64, 12]], // Kukës road ×3
    [[64, 12], [64, 6]],
    [[64, 6], [61, 6], [58, 7]],
    [[44, 23], [46, 21], [47, 19], [45, 16], [43, 14]],
    [[37, 23], [33, 23], [27, 22], [23, 23]], // the pass ×1
    [[38, 24], [38, 28], [36, 31]], // the Mat gorge ×3
    [[36, 31], [31, 32], [25, 29]],
    [[25, 29], [22, 26], [20, 23]],
    [[20, 23], [17, 26], [16, 30]],
    [[16, 30], [13, 33], [10, 35]],
  ],
  caches: [[75, 40], [60, 13], [28, 35]],
  messengerRoad: [[10, 29], [2, 28]],
};
