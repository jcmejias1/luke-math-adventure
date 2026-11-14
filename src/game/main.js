// Luke's Math Adventure: the game screen.

import { LEVELS } from '../data/levels.js';
import { parseLevel, step, findPath, key, LEGEND } from '../core/grid.js';
import { makePuzzle, checkAnswer } from '../core/puzzles.js';
import { createRng } from '../core/random.js';
import {
  normalizeProgress, recordResult, markSolved, isSolved, solvedCount, setLevel, resetSolved,
} from '../core/progress.js';
import { loadJSON, saveJSON, KEYS } from '../core/storage.js';
import { loadGameSprites } from '../shared/sprite-library.js';
import { createRenderer } from './render.js';

const $ = (sel) => document.querySelector(sel);
const canvas = $('#game');
const overlay = $('#overlay');
const panel = $('#panel');
const toast = $('#toast');

const rng = createRng();
const STEP_MS = 140;

let renderer;
let progress = normalizeProgress(loadJSON(KEYS.progress, null), LEVELS.length);
let world;
let opened = new Set();
let player = { x: 0, y: 0 };
let facingLeft = false;
let walkQueue = [];
let lastStep = 0;
let lit = false;
let onPanelKey = null;

function save() {
  saveJSON(KEYS.progress, progress);
}

// ---------- level ----------

function loadLevel(index) {
  try {
    world = parseLevel(LEVELS[index]);
  } catch (err) {
    showPanel({
      title: 'This map needs fixing',
      body: [para(err.message), para('Open src/data/levels.js to fix it, then reload the page.')],
      actions: [],
    });
    return false;
  }
  progress = setLevel(progress, index);
  save();
  opened = new Set(world.gates.filter((g) => isSolved(progress, world.id, g.key)).map((g) => g.key));
  player = { ...world.start };
  walkQueue = [];
  lit = false;
  renderer.fit(world);
  updateHud();
  showToast(`${world.name}: ${world.intro}`);
  return true;
}

function crystals() {
  return solvedCount(progress, world.id);
}

function updateHud() {
  $('#level-name').textContent = world.name;
  $('#crystal-count').textContent = `${crystals()} of ${world.crystalsNeeded} crystals`;
}

// ---------- moving ----------

function tryMove(dir) {
  if (!overlay.hidden) return;
  if (dir === 'left') facingLeft = true;
  if (dir === 'right') facingLeft = false;
  const result = step(world, player, dir, opened);
  player = result.pos;
  if (result.bumped) {
    walkQueue = [];
    interact(result.bumped);
  }
}

function interact({ x, y, tile }) {
  const info = LEGEND[tile];
  if (info.puzzle && !opened.has(key(x, y))) {
    openPuzzle(world.gates.find((g) => g.x === x && g.y === y));
  } else if (info.sign) {
    const sign = world.signs.find((s) => s.x === x && s.y === y);
    showPanel({ title: 'A sign says…', body: [para(sign.text)], actions: [button('OK', closePanel, true)] });
  } else if (info.goal) {
    visitLighthouse();
  }
}

const KEY_DIRS = {
  ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right',
  w: 'up', s: 'down', a: 'left', d: 'right', W: 'up', S: 'down', A: 'left', D: 'right',
};

document.addEventListener('keydown', (e) => {
  if (!overlay.hidden) {
    onPanelKey?.(e);
    return;
  }
  const dir = KEY_DIRS[e.key];
  if (!dir || e.metaKey || e.ctrlKey) return;
  e.preventDefault();
  const now = performance.now();
  if (now - lastStep < 110) return;
  lastStep = now;
  walkQueue = [];
  tryMove(dir);
});

canvas.addEventListener('click', (e) => {
  if (!overlay.hidden || !world) return;
  const rect = canvas.getBoundingClientRect();
  const x = Math.floor(((e.clientX - rect.left) / rect.width) * world.width);
  const y = Math.floor(((e.clientY - rect.top) / rect.height) * world.height);
  const path = findPath(world, player, { x, y }, opened);
  if (path) walkQueue = path;
  else showToast("You can't get there yet.");
});

document.querySelectorAll('[data-move]').forEach((btn) =>
  btn.addEventListener('click', () => {
    walkQueue = [];
    tryMove(btn.dataset.move);
  }),
);

// ---------- puzzles ----------

const NOT_YET = [
  'Not that one. Want to try another?',
  'Hmm, not quite. A hint might help.',
  'Good try. Take another look.',
];

function openPuzzle(gate) {
  const puzzle = makePuzzle(gate.type, progress.skill[gate.type], rng);
  let wrongTries = 0;
  let hintsUsed = 0;

  const feedback = el('p', 'feedback');
  feedback.setAttribute('aria-live', 'polite');
  const hintBox = el('div', 'hints');
  const choices = el('div', 'choices');

  puzzle.choices.forEach((value, i) => {
    const b = button(String(value), () => choose(value, b));
    b.classList.add('choice');
    b.title = `Press ${i + 1}`;
    choices.append(b);
  });

  const hintBtn = button('💡 Hint', showHint);

  function showHint() {
    if (hintsUsed >= puzzle.hints.length) return;
    const hint = puzzle.hints[hintsUsed++];
    const item = el('div', 'hint');
    item.append(para(hint.text));
    if (hint.visual) item.append(drawVisual(hint.visual));
    hintBox.append(item);
    if (hintsUsed >= puzzle.hints.length) hintBtn.disabled = true;
  }

  function choose(value, btn) {
    if (checkAnswer(puzzle, value)) {
      progress = recordResult(progress, puzzle.type, { wrongTries, hintsUsed });
      progress = markSolved(progress, world.id, gate.key);
      save();
      opened.add(gate.key);
      updateHud();
      const enough = crystals() === world.crystalsNeeded;
      showPanel({
        title: '✦ Crystal found!',
        body: [
          crystalIcon(),
          para(puzzle.explain, 'explain'),
          para(enough ? 'You have enough crystals to light the lighthouse!' : 'The gate swings open.'),
        ],
        actions: [button('Keep exploring', closePanel, true)],
      });
    } else {
      wrongTries++;
      btn.disabled = true;
      btn.classList.add('not-this');
      feedback.textContent = NOT_YET[(wrongTries - 1) % NOT_YET.length];
    }
  }

  showPanel({
    title: puzzle.title,
    body: [para(puzzle.prompt, 'prompt'), drawVisual(puzzle.visual), choices, feedback, hintBox],
    actions: [hintBtn, button('Come back later', closePanel)],
    onKey(e) {
      const n = Number(e.key);
      if (n >= 1 && n <= 4) choices.children[n - 1]?.click();
      else if (e.key === 'h' || e.key === 'H') showHint();
    },
  });
}

function drawVisual(v) {
  const box = el('div', `visual visual-${v.kind}`);
  if (v.kind === 'equation') {
    v.parts.forEach((p) => box.append(el('span', p === '?' ? 'slot' : 'term', String(p))));
  } else if (v.kind === 'sequence') {
    v.items.forEach((n) => box.append(el('span', n === '?' ? 'slot' : 'stone', String(n))));
  } else if (v.kind === 'array') {
    box.style.gridTemplateColumns = `repeat(${v.cols}, auto)`;
    for (let i = 0; i < v.rows * v.cols; i++) box.append(crystalIcon('small'));
    box.setAttribute('aria-label', `${v.rows} rows of ${v.cols} crystals`);
  } else if (v.kind === 'dots') {
    for (let i = 0; i < v.filled; i++) box.append(el('span', 'dot filled'));
    for (let i = 0; i < v.empty; i++) box.append(el('span', 'dot empty'));
  }
  return box;
}

function crystalIcon(size = 'big') {
  const c = document.createElement('canvas');
  c.className = `crystal-icon ${size}`;
  c.width = 16;
  c.height = 16;
  renderer.drawIcon('crystal', c);
  return c;
}

// ---------- lighthouse ----------

function visitLighthouse() {
  const have = crystals();
  const need = world.crystalsNeeded;
  if (have < need) {
    const more = need - have;
    showPanel({
      title: 'The lighthouse is dark',
      body: [para(`It needs ${more} more crystal${more === 1 ? '' : 's'}. Solve gates to find them.`)],
      actions: [button('OK', closePanel, true)],
    });
    return;
  }
  lit = true;
  const next = progress.levelIndex + 1;
  const hasNext = next < LEVELS.length;
  showPanel({
    title: 'The lighthouse shines!',
    body: [
      para(`You lit up ${world.name}.`),
      para(
        hasNext
          ? 'A boat is waiting to take you to the next island.'
          : "You've lit every lighthouse. What island would you like to build next?",
      ),
    ],
    actions: hasNext
      ? [button('Sail to the next island ⛵', () => { closePanel(); loadLevel(next); }, true), button('Stay here', closePanel)]
      : [
          button('Start a new adventure', () => { closePanel(); progress = resetSolved(progress); loadLevel(0); }, true),
          button('Stay here', closePanel),
        ],
  });
}

// ---------- panels and messages ----------

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function para(text, className) {
  return el('p', className, text);
}

function button(label, onClick, primary = false) {
  const b = el('button', primary ? 'btn primary' : 'btn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  if (primary) b.dataset.primary = 'true';
  return b;
}

function showPanel({ title, body, actions, onKey }) {
  panel.replaceChildren(el('h2', null, title), ...body, Object.assign(el('div', 'actions'), {}));
  panel.querySelector('.actions').append(...actions);
  overlay.hidden = false;
  walkQueue = [];
  onPanelKey = (e) => {
    if (e.key === 'Escape') closePanel();
    else if (e.key === 'Enter' && document.activeElement?.tagName !== 'BUTTON') panel.querySelector('[data-primary]')?.click();
    else onKey?.(e);
  };
  (panel.querySelector('[data-primary]') ?? panel.querySelector('button.choice') ?? panel.querySelector('button'))?.focus();
}

function closePanel() {
  overlay.hidden = true;
  onPanelKey = null;
  canvas.focus();
}

let toastTimer;
function showToast(text) {
  toast.textContent = text;
  toast.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (toast.hidden = true), 3500);
}

$('#help-btn').addEventListener('click', () =>
  showPanel({
    title: 'How to play',
    body: [
      para('Walk with the arrow keys (or W A S D), the arrow buttons, or click where you want to go.'),
      para('Walk into a gate to try its puzzle. Every solved gate gives you a crystal.'),
      para('Collect enough crystals, then walk into the lighthouse to light it.'),
      para('Stuck? Use a hint. There is no timer, so take your time.'),
      para('Want to change how things look? Open the Sprite Studio and draw your own pictures.'),
    ],
    actions: [button('Got it', closePanel, true)],
  }),
);

// ---------- start ----------

function frame(time) {
  if (world) {
    if (walkQueue.length && overlay.hidden && time - lastStep > STEP_MS) {
      lastStep = time;
      tryMove(walkQueue.shift());
    }
    renderer.draw({ world, opened, player, facingLeft, time, lit });
  }
  requestAnimationFrame(frame);
}

async function start() {
  renderer = createRenderer(canvas, await loadGameSprites());
  loadLevel(progress.levelIndex);
  canvas.tabIndex = 0;
  requestAnimationFrame(frame);
  document.body.dataset.ready = 'true';
}

start();
