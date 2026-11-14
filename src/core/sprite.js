// Sprites are little pictures made of pixels.
//
// A sprite file looks like this:
//   {
//     "name": "crystal",
//     "width": 16, "height": 16,
//     "palette": ["#6b46c1", "#9f7aea"],     <- color 0, color 1, ...
//     "frames": [ ["....00....", ...] ],     <- one string per row
//     "fps": 4                               <- animation speed
//   }
// In each row, "." is see-through and 0-9, a-f pick a palette color.
// Every function here returns a NEW sprite, which makes undo easy.

export const TRANSPARENT = '.';
export const PALETTE_KEYS = '0123456789abcdef';
export const MAX_COLORS = 16;
export const SIZES = [8, 16, 24, 32];
const HEX = /^#[0-9a-f]{6}$/i;

export const DEFAULT_PALETTE = [
  '#222034', '#ffffff', '#d95763', '#df7126',
  '#fbf236', '#6abe30', '#37946e', '#5b6ee1',
  '#639bff', '#76428a', '#d77bba', '#8f563b',
  '#eec39a', '#9badb7', '#696a6a', '#45283c',
];

export const isHexColor = (c) => typeof c === 'string' && HEX.test(c);

export function blankFrame(width, height) {
  return Array.from({ length: height }, () => TRANSPARENT.repeat(width));
}

export function createSprite({ name = 'my-sprite', width = 16, height = 16, palette = DEFAULT_PALETTE, fps = 4 } = {}) {
  return { name, width, height, palette: [...palette], frames: [blankFrame(width, height)], fps };
}

export function cloneSprite(s) {
  return { ...s, palette: [...s.palette], frames: s.frames.map((f) => [...f]) };
}

// Returns a list of problems in plain words. An empty list means it's fine.
export function validateSprite(s) {
  if (!s || typeof s !== 'object') return ['This is not a sprite file.'];
  const problems = [];
  if (typeof s.name !== 'string' || !s.name.trim()) problems.push('The sprite needs a name.');
  const { width: w, height: h } = s;
  if (!Number.isInteger(w) || w < 1 || w > 64) problems.push('Width must be a whole number from 1 to 64.');
  if (!Number.isInteger(h) || h < 1 || h > 64) problems.push('Height must be a whole number from 1 to 64.');
  const colors = Array.isArray(s.palette) ? s.palette.length : 0;
  if (colors < 1 || colors > MAX_COLORS) {
    problems.push(`The palette needs 1 to ${MAX_COLORS} colors.`);
  } else {
    s.palette.forEach((c, i) => {
      if (!isHexColor(c)) problems.push(`Color ${i} should look like #12ab3f.`);
    });
  }
  if (!Array.isArray(s.frames) || s.frames.length < 1) {
    problems.push('A sprite needs at least one frame.');
  } else {
    s.frames.forEach((frame, fi) => {
      if (!Array.isArray(frame) || frame.length !== h) {
        problems.push(`Frame ${fi + 1} should have ${h} rows.`);
        return;
      }
      frame.forEach((row, y) => {
        if (typeof row !== 'string' || row.length !== w) {
          problems.push(`Frame ${fi + 1}, row ${y + 1} should have ${w} pixels.`);
          return;
        }
        for (const ch of row) {
          if (ch === TRANSPARENT) continue;
          const idx = PALETTE_KEYS.indexOf(ch);
          if (idx < 0 || idx >= colors) {
            problems.push(`Frame ${fi + 1}, row ${y + 1} uses "${ch}", which is not a palette color.`);
            break;
          }
        }
      });
    });
  }
  if (s.fps !== undefined && !(Number.isFinite(s.fps) && s.fps >= 1 && s.fps <= 24)) {
    problems.push('Speed (fps) must be from 1 to 24.');
  }
  return problems;
}

const inside = (s, x, y) => x >= 0 && y >= 0 && x < s.width && y < s.height;
const charFor = (index) => (index < 0 ? TRANSPARENT : PALETTE_KEYS[index]);

// Palette color number at a pixel, or -1 for see-through.
export function getPixel(s, frame, x, y) {
  if (!inside(s, x, y)) return -1;
  const ch = s.frames[frame][y][x];
  return ch === TRANSPARENT ? -1 : PALETTE_KEYS.indexOf(ch);
}

function withFrame(s, frameIndex, rows) {
  return { ...s, frames: s.frames.map((f, i) => (i === frameIndex ? rows : f)) };
}

// Paint one pixel. Color -1 erases.
export function setPixel(s, frame, x, y, index) {
  if (!inside(s, x, y) || getPixel(s, frame, x, y) === index) return s;
  const rows = [...s.frames[frame]];
  const row = rows[y];
  rows[y] = row.slice(0, x) + charFor(index) + row.slice(x + 1);
  return withFrame(s, frame, rows);
}

// Paint bucket: fills all touching pixels of the same color.
export function floodFill(s, frame, x, y, index) {
  if (!inside(s, x, y)) return s;
  const target = getPixel(s, frame, x, y);
  if (target === index) return s;
  const grid = s.frames[frame].map((r) => [...r]);
  const targetChar = charFor(target);
  const paint = charFor(index);
  const todo = [[x, y]];
  while (todo.length) {
    const [cx, cy] = todo.pop();
    if (!inside(s, cx, cy) || grid[cy][cx] !== targetChar) continue;
    grid[cy][cx] = paint;
    todo.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
  }
  return withFrame(s, frame, grid.map((r) => r.join('')));
}

// Every pixel on a straight line, so fast mouse moves don't leave gaps.
export function linePoints(x0, y0, x1, y1) {
  const points = [];
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    points.push([x, y]);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) {
      err += dy;
      x += sx;
    }
    if (e2 <= dx) {
      err += dx;
      y += sy;
    }
  }
  return points;
}

// Change the canvas size. The picture stays in the top-left corner.
export function resize(s, width, height) {
  const frames = s.frames.map((f) =>
    Array.from({ length: height }, (_, y) => (f[y] ?? '').slice(0, width).padEnd(width, TRANSPARENT)),
  );
  return { ...s, width, height, frames };
}

export function addFrame(s, after = s.frames.length - 1, { copy = true } = {}) {
  const fresh = copy ? [...s.frames[after]] : blankFrame(s.width, s.height);
  const frames = [...s.frames];
  frames.splice(after + 1, 0, fresh);
  return { ...s, frames };
}

export function removeFrame(s, index) {
  if (s.frames.length <= 1) return s;
  return { ...s, frames: s.frames.filter((_, i) => i !== index) };
}

export function setPaletteColor(s, index, hex) {
  if (!isHexColor(hex) || index < 0 || index >= MAX_COLORS || index > s.palette.length) return s;
  if (s.palette[index]?.toLowerCase() === hex.toLowerCase()) return s;
  const palette = [...s.palette];
  palette[index] = hex.toLowerCase();
  return { ...s, palette };
}

// The studio always shows 16 color slots. Extra slots get friendly defaults.
export function withFullPalette(s) {
  if (s.palette.length >= MAX_COLORS) return s;
  const palette = [...s.palette];
  for (const c of DEFAULT_PALETTE) {
    if (palette.length >= MAX_COLORS) break;
    if (!palette.some((p) => p.toLowerCase() === c)) palette.push(c);
  }
  return { ...s, palette };
}

// Rows of colors ("#rrggbb" or null) for drawing a frame on screen.
export function frameColors(s, frame) {
  return s.frames[frame].map((row) => [...row].map((ch) => (ch === TRANSPARENT ? null : s.palette[PALETTE_KEYS.indexOf(ch)] ?? null)));
}
