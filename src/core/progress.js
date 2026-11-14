// Remembers what Luke has done: solved gates, which island he is on,
// and how tricky each kind of puzzle should be.
// These functions never change the old progress; they return a new copy.

import { PUZZLE_TYPES } from './puzzles.js';

export const MIN_SKILL = 1;
export const MAX_SKILL = 5;
const KEY_PATTERN = /^\d+,\d+$/;

export function createProgress() {
  return {
    version: 1,
    levelIndex: 0,
    solved: {},
    skill: Object.fromEntries(PUZZLE_TYPES.map((t) => [t, MIN_SKILL])),
    streak: Object.fromEntries(PUZZLE_TYPES.map((t) => [t, 0])),
    puzzlesSolved: 0,
  };
}

// Saved data can be old or broken. Keep only the parts that make sense.
export function normalizeProgress(raw, levelCount = Infinity) {
  const out = createProgress();
  if (!raw || typeof raw !== 'object' || raw.version !== 1) return out;

  if (Number.isInteger(raw.levelIndex) && raw.levelIndex >= 0 && raw.levelIndex < levelCount) {
    out.levelIndex = raw.levelIndex;
  }
  for (const t of PUZZLE_TYPES) {
    const s = raw.skill?.[t];
    if (Number.isInteger(s) && s >= MIN_SKILL && s <= MAX_SKILL) out.skill[t] = s;
    const k = raw.streak?.[t];
    if (Number.isInteger(k) && k >= 0) out.streak[t] = k;
  }
  if (raw.solved && typeof raw.solved === 'object') {
    for (const [levelId, keys] of Object.entries(raw.solved)) {
      if (Array.isArray(keys)) {
        out.solved[levelId] = [...new Set(keys.filter((k) => typeof k === 'string' && KEY_PATTERN.test(k)))];
      }
    }
  }
  if (Number.isInteger(raw.puzzlesSolved) && raw.puzzlesSolved >= 0) out.puzzlesSolved = raw.puzzlesSolved;
  return out;
}

// Two smooth solves in a row: a bit trickier next time.
// A real struggle: a bit gentler next time. Hints are never "bad".
export function recordResult(progress, type, { wrongTries = 0, hintsUsed = 0 } = {}) {
  const skill = { ...progress.skill };
  const streak = { ...progress.streak };
  let s = skill[type] ?? MIN_SKILL;
  let k = streak[type] ?? 0;

  if (wrongTries === 0 && hintsUsed === 0) {
    k += 1;
    if (k >= 2) {
      s = Math.min(MAX_SKILL, s + 1);
      k = 0;
    }
  } else if (wrongTries + hintsUsed >= 3) {
    s = Math.max(MIN_SKILL, s - 1);
    k = 0;
  } else {
    k = 0;
  }

  skill[type] = s;
  streak[type] = k;
  return { ...progress, skill, streak, puzzlesSolved: progress.puzzlesSolved + 1 };
}

export function isSolved(progress, levelId, gateKey) {
  return (progress.solved[levelId] ?? []).includes(gateKey);
}

export function markSolved(progress, levelId, gateKey) {
  if (isSolved(progress, levelId, gateKey)) return progress;
  const list = [...(progress.solved[levelId] ?? []), gateKey];
  return { ...progress, solved: { ...progress.solved, [levelId]: list } };
}

export function solvedCount(progress, levelId) {
  return (progress.solved[levelId] ?? []).length;
}

// A fresh adventure: gates close again, but puzzle skill is remembered.
export function resetSolved(progress) {
  return { ...progress, solved: {} };
}

export function setLevel(progress, levelIndex) {
  return { ...progress, levelIndex };
}
