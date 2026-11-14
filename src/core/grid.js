// The island map: what each letter means, walking around, and finding paths.

// The map key. Each letter in a level map is one square on the island.
export const LEGEND = {
  '#': { name: 'tree', solid: true },
  '~': { name: 'water', solid: true },
  '.': { name: 'grass' },
  ',': { name: 'flowers' },
  S: { name: 'grass', start: true },
  L: { name: 'lighthouse', solid: true, goal: true },
  '?': { name: 'sign', solid: true, sign: true },
  '+': { name: 'gate', solid: true, puzzle: 'sum', symbol: '+' },
  P: { name: 'gate', solid: true, puzzle: 'pattern', symbol: '123' },
  A: { name: 'gate', solid: true, puzzle: 'array', symbol: '::' },
};

export const DIRECTIONS = {
  up: { dx: 0, dy: -1 },
  down: { dx: 0, dy: 1 },
  left: { dx: -1, dy: 0 },
  right: { dx: 1, dy: 0 },
};

export const key = (x, y) => `${x},${y}`;

export class LevelError extends Error {}

// Turns a level from src/data/levels.js into a world the game can use.
// If something is wrong with the map, the error message explains how to fix it.
export function parseLevel(level) {
  const label = level?.name ? `"${level.name}"` : 'this level';
  const rows = level?.map;
  if (!Array.isArray(rows) || rows.length === 0) {
    throw new LevelError(`${label} needs a map with at least one row.`);
  }
  const width = rows[0].length;
  const start = [];
  const goal = [];
  const gates = [];
  const signSpots = [];

  rows.forEach((row, y) => {
    if (typeof row !== 'string' || row.length !== width) {
      throw new LevelError(
        `In ${label}, row ${y + 1} has ${row?.length ?? 0} squares but row 1 has ${width}. Every row needs the same number.`,
      );
    }
    [...row].forEach((ch, x) => {
      const tile = LEGEND[ch];
      if (!tile) {
        throw new LevelError(`In ${label}, row ${y + 1} uses "${ch}", which is not in the map key.`);
      }
      if (tile.start) start.push({ x, y });
      if (tile.goal) goal.push({ x, y });
      if (tile.puzzle) gates.push({ x, y, type: tile.puzzle, key: key(x, y) });
      if (tile.sign) signSpots.push({ x, y });
    });
  });

  if (start.length !== 1) {
    throw new LevelError(`${label} needs exactly one start square "S" (it has ${start.length}).`);
  }
  if (goal.length !== 1) {
    throw new LevelError(`${label} needs exactly one lighthouse "L" (it has ${goal.length}).`);
  }
  const texts = level.signs ?? [];
  if (texts.length !== signSpots.length) {
    throw new LevelError(
      `${label} has ${signSpots.length} sign squares "?" but ${texts.length} sign messages. They need to match.`,
    );
  }
  const needed = level.crystalsNeeded ?? gates.length;
  if (!Number.isInteger(needed) || needed < 0 || needed > gates.length) {
    throw new LevelError(`${label} asks for ${needed} crystals but only has ${gates.length} gates.`);
  }

  return {
    id: level.id,
    name: level.name,
    intro: level.intro ?? '',
    crystalsNeeded: needed,
    width,
    height: rows.length,
    rows,
    start: start[0],
    goal: goal[0],
    gates,
    signs: signSpots.map((spot, i) => ({ ...spot, text: texts[i] })),
  };
}

// Anything outside the map counts as a tree, so you can't walk off the edge.
export function tileAt(world, x, y) {
  if (x < 0 || y < 0 || x >= world.width || y >= world.height) return '#';
  return world.rows[y][x];
}

// Can the explorer stand here? Gates open once their puzzle is solved.
export function isOpen(world, x, y, opened = new Set()) {
  const tile = LEGEND[tileAt(world, x, y)];
  if (tile.puzzle) return opened.has(key(x, y));
  return !tile.solid;
}

// Tries to take one step. If something is in the way, it reports what was bumped.
export function step(world, pos, dir, opened = new Set()) {
  const d = DIRECTIONS[dir];
  if (!d) return { pos, bumped: null };
  const x = pos.x + d.dx;
  const y = pos.y + d.dy;
  if (isOpen(world, x, y, opened)) return { pos: { x, y }, bumped: null };
  return { pos, bumped: { x, y, tile: tileAt(world, x, y) } };
}

// Something you can bump into to make it do something (gate, sign, lighthouse).
export function isInteractive(world, x, y, opened = new Set()) {
  const tile = LEGEND[tileAt(world, x, y)];
  if (tile.puzzle) return !opened.has(key(x, y));
  return Boolean(tile.sign || tile.goal);
}

function bfs(world, from, opened) {
  const prev = new Map([[key(from.x, from.y), null]]);
  const queue = [from];
  while (queue.length) {
    const cur = queue.shift();
    for (const [dir, d] of Object.entries(DIRECTIONS)) {
      const nx = cur.x + d.dx;
      const ny = cur.y + d.dy;
      const k = key(nx, ny);
      if (prev.has(k) || !isOpen(world, nx, ny, opened)) continue;
      prev.set(k, { from: cur, dir });
      queue.push({ x: nx, y: ny });
    }
  }
  return prev;
}

function backtrack(prev, target) {
  const dirs = [];
  let k = key(target.x, target.y);
  while (prev.get(k)) {
    const { from, dir } = prev.get(k);
    dirs.unshift(dir);
    k = key(from.x, from.y);
  }
  return dirs;
}

// A list of steps ("up", "left", ...) to reach a square, or null if there's no way.
// If the square is a gate, sign or lighthouse, the last step bumps into it.
export function findPath(world, from, to, opened = new Set()) {
  if (from.x === to.x && from.y === to.y) return [];
  const prev = bfs(world, from, opened);
  if (isOpen(world, to.x, to.y, opened)) {
    return prev.has(key(to.x, to.y)) ? backtrack(prev, to) : null;
  }
  if (!isInteractive(world, to.x, to.y, opened)) return null;

  let best = null;
  for (const [dir, d] of Object.entries(DIRECTIONS)) {
    const beside = { x: to.x - d.dx, y: to.y - d.dy };
    if (!prev.has(key(beside.x, beside.y))) continue;
    const path = [...backtrack(prev, beside), dir];
    if (!best || path.length < best.length) best = path;
  }
  return best;
}

// Every square the explorer could walk to from a starting point.
export function reachable(world, from, opened = new Set()) {
  return new Set(bfs(world, from, opened).keys());
}
