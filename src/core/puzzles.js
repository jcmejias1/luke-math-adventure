// Puzzle makers. Each puzzle has a question, four choices, three hints that
// get more helpful, and a short explanation of the answer.
//
// Skill goes from 1 (gentle) to 5 (tricky). The game raises or lowers it
// slowly, based on how the last few puzzles went.

export const PUZZLE_TYPES = ['sum', 'pattern', 'array'];

export const PUZZLE_TITLES = {
  sum: 'Number Gate',
  pattern: 'Pattern Gate',
  array: 'Garden Gate',
};

const clampSkill = (s) => Math.min(5, Math.max(1, Math.round(Number(s)) || 1));

// Four choices: the answer plus three "nearby" numbers that are easy to mix up.
export function makeChoices(answer, rng, extras = []) {
  const candidates = new Set();
  for (const c of [...extras, answer + 1, answer - 1, answer + 2, answer - 2, answer + 10, answer - 10]) {
    if (Number.isInteger(c) && c >= 0 && c !== answer) candidates.add(c);
  }
  const picked = rng.shuffle([...candidates]).slice(0, 3);
  let n = answer + 3;
  while (picked.length < 3) {
    if (!picked.includes(n) && n !== answer) picked.push(n);
    n++;
  }
  return rng.shuffle([answer, ...picked]);
}

function sumPuzzle(skill, rng) {
  if (skill === 3) {
    // Taking away: 12 - ? = 5
    const total = rng.int(8, 20);
    const answer = rng.int(1, total - 1);
    const rest = total - answer;
    return {
      prompt: `${total} − ? = ${rest}`,
      visual: { kind: 'equation', parts: [total, '−', '?', '=', rest] },
      answer,
      extras: [rest, total],
      hints: [
        { text: `You had ${total}, and ${rest} were left. How many went away?` },
        {
          text: `Count up from ${rest} to ${total}. How many steps did you take?`,
          visual: { kind: 'dots', filled: rest, empty: answer },
        },
        { text: `Adding and taking away are partners. What is ${rest} + ? = ${total}?` },
      ],
      explain: `${total} − ${answer} = ${rest}`,
      data: { op: '-', total, rest },
    };
  }

  let total;
  let a;
  if (skill === 5) {
    total = 10 * rng.int(5, 10);
    a = 10 * rng.int(1, total / 10 - 1);
  } else if (skill === 4) {
    total = rng.int(21, 50);
    a = rng.int(10, total - 5);
  } else {
    total = skill === 1 ? rng.int(5, 10) : rng.int(11, 20);
    a = rng.int(1, total - 1);
  }
  const answer = total - a;
  const small = total <= 20;
  return {
    prompt: `${a} + ? = ${total}`,
    visual: { kind: 'equation', parts: [a, '+', '?', '=', total] },
    answer,
    extras: [total, a],
    hints: [
      { text: `Start at ${a}. How many more do you need to reach ${total}?` },
      small
        ? {
            text: `Count up from ${a}: ${a + 1}, ${a + 2}, … until you reach ${total}. Count your steps.`,
            visual: { kind: 'dots', filled: a, empty: answer },
          }
        : { text: `Jump up from ${a} by tens first, then by ones, until you reach ${total}.` },
      { text: `Adding and taking away are partners. What is ${total} − ${a}?` },
    ],
    explain: `${a} + ${answer} = ${total}`,
    data: { op: '+', a, total },
  };
}

function patternPuzzle(skill, rng) {
  let seq;
  let rule;
  let kind;
  let step = 0;
  if (skill === 5) {
    kind = 'double';
    const start = rng.pick([1, 2, 3]);
    seq = [0, 1, 2, 3].map((i) => start * 2 ** i);
    rule = 'double it';
  } else if (skill === 3) {
    kind = 'subtract';
    step = rng.pick([2, 3]);
    const start = rng.int(20, 30);
    seq = [0, 1, 2, 3].map((i) => start - i * step);
    rule = `take away ${step}`;
  } else {
    kind = 'add';
    step = { 1: rng.pick([1, 2]), 2: rng.pick([5, 10]), 4: rng.pick([3, 4]) }[skill];
    const start = skill === 2 ? step * rng.int(1, 5) : rng.int(1, 12);
    seq = [0, 1, 2, 3].map((i) => start + i * step);
    rule = `add ${step}`;
  }
  const last = seq[3];
  const answer = kind === 'double' ? last * 2 : kind === 'subtract' ? last - step : last + step;

  const hints = [{ text: 'Look at how each number changes to become the next one.' }];
  if (kind === 'double') {
    hints.push({ text: `${seq[0]} becomes ${seq[1]}, and ${seq[1]} becomes ${seq[2]}. What happens each time?` });
    hints.push({ text: `Each number is double the one before. What is ${last} + ${last}?` });
  } else {
    const way = kind === 'add' ? 'up' : 'down';
    const sign = kind === 'add' ? '+' : '−';
    hints.push({ text: `From ${seq[0]} to ${seq[1]} goes ${way} ${step}. Is it the same every time?` });
    hints.push({ text: `The rule is "${rule}". What is ${last} ${sign} ${step}?` });
  }

  return {
    prompt: 'What number comes next?',
    visual: { kind: 'sequence', items: [...seq, '?'] },
    answer,
    extras: [last, last + (last - seq[2])],
    hints,
    explain: `The rule is "${rule}": ${seq.join(', ')}, ${answer}`,
    data: { seq, kind, step },
  };
}

function arrayPuzzle(skill, rng) {
  const sizes = {
    1: [
      [2, 2],
      [2, 5],
    ],
    2: [
      [2, 3],
      [2, 5],
    ],
    3: [
      [3, 5],
      [3, 5],
    ],
    4: [
      [4, 6],
      [4, 6],
    ],
    5: [
      [3, 6],
      [6, 10],
    ],
  }[skill];
  const rows = rng.int(sizes[0][0], sizes[0][1]);
  const cols = rng.int(sizes[1][0], sizes[1][1]);
  const answer = rows * cols;
  return {
    prompt: 'How many crystals are in the garden?',
    visual: { kind: 'array', rows, cols },
    answer,
    extras: [rows + cols, answer - cols, answer + cols],
    hints: [
      { text: 'Count just one row first.' },
      { text: `Each row has ${cols}. Count by ${cols}s, one row at a time: ${cols}, ${cols * 2}, …` },
      { text: `There are ${rows} rows of ${cols}. That's ${rows} × ${cols}.` },
    ],
    explain: `${rows} rows of ${cols} make ${answer}. ${rows} × ${cols} = ${answer}`,
    data: { rows, cols },
  };
}

const MAKERS = { sum: sumPuzzle, pattern: patternPuzzle, array: arrayPuzzle };

export function makePuzzle(type, skill, rng) {
  const maker = MAKERS[type];
  if (!maker) throw new Error(`Unknown puzzle type "${type}"`);
  const level = clampSkill(skill);
  const { extras, ...p } = maker(level, rng);
  return { type, skill: level, title: PUZZLE_TITLES[type], ...p, choices: makeChoices(p.answer, rng, extras) };
}

export function checkAnswer(puzzle, value) {
  return Number(value) === puzzle.answer;
}
