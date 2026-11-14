// The islands! You can change these maps or add new ones.
//
// Map key:
//   #  tree         ~  water        .  grass       ,  flowers
//   S  start        L  lighthouse   ?  sign
//   +  Number Gate (adding and taking away)
//   P  Pattern Gate (what comes next?)
//   A  Garden Gate (counting rows of crystals)
//
// Rules the tests check for you:
//   - every row has the same number of squares
//   - exactly one S and one L
//   - one sign message for every ? on the map
//   - the lighthouse can be reached once the gates are open
//   - crystalsNeeded is not more than the number of gates

export const LEVELS = [
  {
    id: 'meadow',
    name: 'Sunny Meadow',
    intro: 'Find crystals by solving the gates, then light the lighthouse.',
    crystalsNeeded: 3,
    signs: [
      'Welcome, explorer! Walk into a gate to try its puzzle. Every gate you solve gives you a crystal.',
    ],
    map: [
      '##############',
      '#S..,....#...#',
      '#..?.....+..,#',
      '#....##..#...#',
      '#~~..##..#.P.#',
      '#~~......#...#',
      '#,...A...##+##',
      '#........#...#',
      '#..,.....#.L.#',
      '##############',
    ],
  },
  {
    id: 'cove',
    name: 'Crystal Cove',
    intro: 'This island has a lake in the middle. Can you find a way around it?',
    crystalsNeeded: 3,
    signs: [
      'Stuck on a puzzle? Press the hint button. Hints get more helpful each time.',
      'Some gates are shortcuts. Some lead somewhere new. Which is which?',
    ],
    map: [
      '################',
      '#S...#~~~~~~...#',
      '#.,..#~~~~~~.L.#',
      '#....+.~~~~~...#',
      '#.?..#......P..#',
      '###.##..,...####',
      '#...A...##.....#',
      '#.,.....##..+..#',
      '#~~~....?#.....#',
      '#~~~.........,.#',
      '################',
    ],
  },
];
