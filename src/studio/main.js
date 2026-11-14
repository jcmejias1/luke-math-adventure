// Sprite Studio: draw pictures and animations for the game.

import {
  createSprite, validateSprite, getPixel, setPixel, floodFill, linePoints, resize,
  addFrame, removeFrame, setPaletteColor, withFullPalette, frameColors, SIZES,
} from '../core/sprite.js';
import { createHistory, pushState, undo, redo, canUndo, canRedo } from '../core/history.js';
import { loadJSON, saveJSON, KEYS } from '../core/storage.js';
import { ROLES, ROLE_LABELS, loadGameSprites, loadStudioSprites, useSpriteInGame, restoreOriginal } from '../shared/sprite-library.js';

const $ = (sel) => document.querySelector(sel);
const editor = $('#editor');
const ectx = editor.getContext('2d');
const preview = $('#preview');
const overlay = $('#overlay');
const panel = $('#panel');

const ui = { tool: 'pencil', color: 0, frame: 0, cell: 0, playing: true };
let history = createHistory(startingSprite());
let stroke = null;

const current = () => stroke?.sprite ?? history.present;

function startingSprite() {
  const saved = loadJSON(KEYS.studioCurrent, null);
  if (saved && validateSprite(saved).length === 0) return withFullPalette(saved);
  return createSprite({ name: 'my-sprite' });
}

// ---------- changing the sprite ----------

function commit(next) {
  if (next === history.present) return;
  history = pushState(history, next);
  afterChange();
}

function afterChange() {
  const s = history.present;
  ui.frame = Math.min(ui.frame, s.frames.length - 1);
  ui.color = Math.min(ui.color, s.palette.length - 1);
  saveJSON(KEYS.studioCurrent, s);
  renderAll();
}

function fitZoom() {
  const s = history.present;
  const room = Math.min(editor.parentElement.clientWidth || 480, 520);
  ui.cell = Math.max(4, Math.min(40, Math.floor(room / Math.max(s.width, s.height))));
}

// ---------- drawing ----------

function renderEditor() {
  const s = current();
  const c = ui.cell;
  editor.width = s.width * c;
  editor.height = s.height * c;
  const colors = frameColors(s, ui.frame);
  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const color = colors[y][x];
      if (color) {
        ectx.fillStyle = color;
        ectx.fillRect(x * c, y * c, c, c);
      } else {
        // checkerboard shows "see-through"
        ectx.fillStyle = (x + y) % 2 ? '#e9e9ef' : '#f7f7fb';
        ectx.fillRect(x * c, y * c, c, c);
      }
    }
  }
  if (c >= 8) {
    ectx.strokeStyle = 'rgba(0,0,0,0.12)';
    ectx.lineWidth = 1;
    ectx.beginPath();
    for (let x = 0; x <= s.width; x++) {
      ectx.moveTo(x * c + 0.5, 0);
      ectx.lineTo(x * c + 0.5, s.height * c);
    }
    for (let y = 0; y <= s.height; y++) {
      ectx.moveTo(0, y * c + 0.5);
      ectx.lineTo(s.width * c, y * c + 0.5);
    }
    ectx.stroke();
  }
}

function drawFrameTo(canvas, s, index) {
  const ctx = canvas.getContext('2d');
  const scale = Math.min(canvas.width / s.width, canvas.height / s.height);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const ox = (canvas.width - s.width * scale) / 2;
  const oy = (canvas.height - s.height * scale) / 2;
  frameColors(s, index).forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return;
      ctx.fillStyle = color;
      ctx.fillRect(ox + x * scale, oy + y * scale, Math.ceil(scale), Math.ceil(scale));
    }),
  );
}

function renderPalette() {
  const s = current();
  const box = $('#palette');
  box.replaceChildren(
    ...s.palette.map((color, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'swatch' + (i === ui.color && ui.tool !== 'eraser' ? ' selected' : '');
      b.style.background = color;
      b.setAttribute('aria-label', `Color ${i + 1}`);
      b.addEventListener('click', () => {
        ui.color = i;
        if (ui.tool === 'eraser' || ui.tool === 'picker') ui.tool = 'pencil';
        renderAll();
      });
      return b;
    }),
  );
  $('#color-input').value = s.palette[ui.color];
}

function renderFrames() {
  const s = current();
  const box = $('#frames');
  box.replaceChildren(
    ...s.frames.map((_, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'frame-thumb' + (i === ui.frame ? ' selected' : '');
      b.setAttribute('aria-label', `Frame ${i + 1}`);
      const c = document.createElement('canvas');
      c.width = 48;
      c.height = 48;
      drawFrameTo(c, s, i);
      const n = document.createElement('span');
      n.textContent = i + 1;
      b.append(c, n);
      b.addEventListener('click', () => {
        ui.frame = i;
        renderAll();
      });
      return b;
    }),
  );
  $('#delete-frame').disabled = s.frames.length <= 1;
}

function renderControls() {
  const s = current();
  document.querySelectorAll('[data-tool]').forEach((b) => b.classList.toggle('selected', b.dataset.tool === ui.tool));
  $('#undo-btn').disabled = !canUndo(history);
  $('#redo-btn').disabled = !canRedo(history);
  const sizeSelect = $('#size-select');
  sizeSelect.value = s.width === s.height && SIZES.includes(s.width) ? String(s.width) : '';
  if (document.activeElement !== $('#sprite-name')) $('#sprite-name').value = s.name;
  $('#fps').value = s.fps ?? 4;
  editor.dataset.tool = ui.tool;
}

function renderAll() {
  renderEditor();
  renderPalette();
  renderFrames();
  renderControls();
}

// ---------- mouse and touch ----------

function pixelAt(e) {
  const rect = editor.getBoundingClientRect();
  const s = current();
  return {
    x: Math.floor(((e.clientX - rect.left) / rect.width) * s.width),
    y: Math.floor(((e.clientY - rect.top) / rect.height) * s.height),
  };
}

editor.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  const { x, y } = pixelAt(e);
  const s = history.present;
  if (ui.tool === 'fill') {
    commit(floodFill(s, ui.frame, x, y, ui.color));
  } else if (ui.tool === 'picker') {
    const idx = getPixel(s, ui.frame, x, y);
    if (idx >= 0) {
      ui.color = idx;
      ui.tool = 'pencil';
      renderAll();
    }
  } else {
    editor.setPointerCapture(e.pointerId);
    const paint = ui.tool === 'eraser' ? -1 : ui.color;
    stroke = { sprite: setPixel(s, ui.frame, x, y, paint), last: { x, y }, paint };
    renderEditor();
  }
});

editor.addEventListener('pointermove', (e) => {
  if (!stroke) return;
  const { x, y } = pixelAt(e);
  if (x === stroke.last.x && y === stroke.last.y) return;
  for (const [px, py] of linePoints(stroke.last.x, stroke.last.y, x, y)) {
    stroke.sprite = setPixel(stroke.sprite, ui.frame, px, py, stroke.paint);
  }
  stroke.last = { x, y };
  renderEditor();
});

function endStroke() {
  if (!stroke) return;
  const next = stroke.sprite;
  stroke = null;
  commit(next);
  renderAll();
}
editor.addEventListener('pointerup', endStroke);
editor.addEventListener('pointercancel', endStroke);

// ---------- buttons ----------

document.querySelectorAll('[data-tool]').forEach((b) =>
  b.addEventListener('click', () => {
    ui.tool = b.dataset.tool;
    renderAll();
  }),
);

function doUndo() {
  history = undo(history);
  afterChange();
}
function doRedo() {
  history = redo(history);
  afterChange();
}
$('#undo-btn').addEventListener('click', doUndo);
$('#redo-btn').addEventListener('click', doRedo);

$('#zoom-in').addEventListener('click', () => {
  ui.cell = Math.min(48, ui.cell + 4);
  renderEditor();
});
$('#zoom-out').addEventListener('click', () => {
  ui.cell = Math.max(4, ui.cell - 4);
  renderEditor();
});

$('#size-select').addEventListener('change', (e) => {
  const size = Number(e.target.value);
  const s = history.present;
  if ((size < s.width || size < s.height) && !confirm('Making it smaller cuts off the right and bottom edges. Keep going?')) {
    renderControls();
    return;
  }
  commit(resize(s, size, size));
  fitZoom();
  renderAll();
});

$('#color-input').addEventListener('change', (e) => {
  commit(setPaletteColor(history.present, ui.color, e.target.value));
});

$('#sprite-name').addEventListener('change', (e) => {
  const name = e.target.value.trim().replace(/[^\w -]/g, '').slice(0, 30) || 'my-sprite';
  commit({ ...history.present, name });
});

$('#fps').addEventListener('change', (e) => {
  commit({ ...history.present, fps: Number(e.target.value) });
});

$('#add-frame').addEventListener('click', () => {
  commit(addFrame(history.present, ui.frame, { copy: true }));
  ui.frame += 1;
  renderAll();
  toast('New frame made from a copy. Change something small to make it move!');
});

$('#delete-frame').addEventListener('click', () => {
  commit(removeFrame(history.present, ui.frame));
});

$('#play-btn').addEventListener('click', () => {
  ui.playing = !ui.playing;
  $('#play-btn').textContent = ui.playing ? '⏸ Pause' : '▶ Play';
});

document.addEventListener('keydown', (e) => {
  if (!overlay.hidden) {
    if (e.key === 'Escape') closePanel();
    return;
  }
  if (e.target.matches('input, select')) return;
  const mod = e.metaKey || e.ctrlKey;
  if (mod && e.key.toLowerCase() === 'z') {
    e.preventDefault();
    if (e.shiftKey) doRedo();
    else doUndo();
  } else if (mod && e.key.toLowerCase() === 'y') {
    e.preventDefault();
    doRedo();
  } else if (!mod) {
    const tool = { b: 'pencil', e: 'eraser', f: 'fill', i: 'picker' }[e.key.toLowerCase()];
    if (tool) {
      ui.tool = tool;
      renderAll();
    }
  }
});

// ---------- saving, opening, sharing ----------

function loadSprite(s) {
  history = createHistory(withFullPalette(s));
  ui.frame = 0;
  ui.color = 0;
  fitZoom();
  afterChange();
}

$('#save-btn').addEventListener('click', () => {
  const s = history.present;
  const projects = loadJSON(KEYS.studioProjects, {}) || {};
  projects[s.name] = s;
  toast(saveJSON(KEYS.studioProjects, projects) ? `Saved "${s.name}" in My Sprites.` : 'This browser would not let me save.');
});

$('#open-btn').addEventListener('click', async () => {
  const projects = loadJSON(KEYS.studioProjects, {}) || {};
  const game = await loadGameSprites();
  const list = (items) => {
    const box = el('div', 'open-list');
    items.forEach(([label, sprite]) => box.append(button(label, () => { closePanel(); loadSprite(sprite); })));
    return box;
  };
  const mine = Object.entries(projects).filter(([, s]) => validateSprite(s).length === 0);
  showPanel('Open a sprite', [
    el('h3', null, 'Start fresh'),
    list([
      ['✨ New blank 16 × 16', createSprite({ name: 'my-sprite' })],
      ['✨ New blank 8 × 8', createSprite({ name: 'tiny-sprite', width: 8, height: 8 })],
    ]),
    el('h3', null, 'My sprites'),
    mine.length ? list(mine.map(([name, s]) => [name, s])) : el('p', 'muted', 'Nothing saved yet. Press 💾 Save to keep a sprite here.'),
    el('h3', null, 'Pictures in the game'),
    list(ROLES.filter((r) => game[r]).map((r) => [ROLE_LABELS[r], game[r]])),
  ]);
});

$('#use-btn').addEventListener('click', () => {
  const s = history.present;
  const custom = loadStudioSprites();
  const choices = el('div', 'open-list');
  ROLES.forEach((role) =>
    choices.append(
      button(ROLE_LABELS[role], () => {
        closePanel();
        toast(useSpriteInGame(role, s) ? `Your sprite is now the ${ROLE_LABELS[role]} in the game. Go have a look!` : 'This browser would not let me save.');
      }),
    ),
  );
  const restore = el('div', 'open-list');
  Object.keys(custom).forEach((role) =>
    restore.append(button(`Put back the original ${ROLE_LABELS[role]}`, () => { restoreOriginal(role); closePanel(); toast('The original picture is back.'); })),
  );
  showPanel('Use in the game as…', [
    el('p', null, `Which picture should "${s.name}" replace?`),
    choices,
    ...(Object.keys(custom).length ? [el('h3', null, 'Changed your mind?'), restore] : []),
  ]);
});

$('#download-btn').addEventListener('click', () => {
  const s = history.present;
  const blob = new Blob([JSON.stringify(s, null, 2) + '\n'], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${s.name}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
});

$('#upload-input').addEventListener('change', async (e) => {
  const file = e.target.files[0];
  e.target.value = '';
  if (!file) return;
  try {
    const s = JSON.parse(await file.text());
    const problems = validateSprite(s);
    if (problems.length) {
      showPanel('That file has a problem', [el('p', null, problems.slice(0, 3).join(' '))]);
      return;
    }
    loadSprite(s);
    toast(`Opened "${s.name}".`);
  } catch {
    showPanel('That file has a problem', [el('p', null, "It isn't a sprite file.")]);
  }
});

// ---------- panels ----------

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined) n.textContent = text;
  return n;
}

function button(label, onClick) {
  const b = el('button', 'btn', label);
  b.type = 'button';
  b.addEventListener('click', onClick);
  return b;
}

function showPanel(title, body) {
  const close = button('Close', closePanel);
  close.classList.add('primary');
  const actions = el('div', 'actions');
  actions.append(close);
  panel.replaceChildren(el('h2', null, title), ...body, actions);
  overlay.hidden = false;
  panel.querySelector('button')?.focus();
}

function closePanel() {
  overlay.hidden = true;
}

let toastTimer;
function toast(text) {
  const t = $('#toast');
  t.textContent = text;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => (t.hidden = true), 3500);
}

// ---------- animation preview ----------

let lastFrameTime = 0;
let previewIndex = 0;
function animate(time) {
  const s = current();
  const fps = s.fps || 4;
  if (!ui.playing) previewIndex = ui.frame;
  else if (time - lastFrameTime > 1000 / fps) {
    lastFrameTime = time;
    previewIndex = (previewIndex + 1) % s.frames.length;
  }
  drawFrameTo(preview, s, Math.min(previewIndex, s.frames.length - 1));
  requestAnimationFrame(animate);
}

window.addEventListener('resize', () => {
  fitZoom();
  renderEditor();
});

fitZoom();
renderAll();
requestAnimationFrame(animate);
document.body.dataset.ready = 'true';
