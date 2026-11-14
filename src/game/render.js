// Draws the island on the canvas.

import { LEGEND, key } from '../core/grid.js';
import { frameColors } from '../core/sprite.js';

export const TILE = 48; // 16-pixel sprites drawn 3 times bigger

const FALLBACK = {
  grass: '#7cc95b', water: '#3b82c4', tree: '#2f7d32', flowers: '#ff8fb1',
  gate: '#8d6e63', sign: '#a1887f', lighthouse: '#e53e3e', explorer: '#2b6cb0', crystal: '#9f7aea',
};

function frameCanvas(sprite, index) {
  const c = document.createElement('canvas');
  c.width = sprite.width;
  c.height = sprite.height;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(sprite.width, sprite.height);
  frameColors(sprite, index).forEach((row, y) =>
    row.forEach((color, x) => {
      if (!color) return;
      const i = (y * sprite.width + x) * 4;
      img.data[i] = parseInt(color.slice(1, 3), 16);
      img.data[i + 1] = parseInt(color.slice(3, 5), 16);
      img.data[i + 2] = parseInt(color.slice(5, 7), 16);
      img.data[i + 3] = 255;
    }),
  );
  ctx.putImageData(img, 0, 0);
  return c;
}

export function createRenderer(canvas, sprites) {
  const ctx = canvas.getContext('2d');
  const frames = {};
  for (const [role, sprite] of Object.entries(sprites)) {
    frames[role] = sprite.frames.map((_, i) => frameCanvas(sprite, i));
  }

  function frameFor(role, time) {
    const list = frames[role];
    if (!list) return null;
    const fps = sprites[role].fps || 4;
    return list[Math.floor((time / 1000) * fps) % list.length];
  }

  function drawRole(role, x, y, time, { flip = false } = {}) {
    const img = frameFor(role, time);
    if (!img) {
      ctx.fillStyle = FALLBACK[role] ?? '#999';
      ctx.fillRect(x + 6, y + 6, TILE - 12, TILE - 12);
      return;
    }
    if (flip) {
      ctx.save();
      ctx.translate(x + TILE, y);
      ctx.scale(-1, 1);
      ctx.drawImage(img, 0, 0, TILE, TILE);
      ctx.restore();
    } else {
      ctx.drawImage(img, x, y, TILE, TILE);
    }
  }

  function fit(world) {
    canvas.width = world.width * TILE;
    canvas.height = world.height * TILE;
  }

  function draw({ world, opened, player, facingLeft, time, lit }) {
    ctx.imageSmoothingEnabled = false;
    for (let y = 0; y < world.height; y++) {
      for (let x = 0; x < world.width; x++) {
        const ch = world.rows[y][x];
        const tile = LEGEND[ch];
        const px = x * TILE;
        const py = y * TILE;
        drawRole(tile.name === 'water' ? 'water' : 'grass', px, py, time);
        if (tile.puzzle) {
          if (!opened.has(key(x, y))) {
            drawRole('gate', px, py, time);
            ctx.fillStyle = '#5d4037';
            ctx.font = `bold ${Math.round(TILE * 0.3)}px system-ui, sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(tile.symbol, px + TILE / 2, py + TILE * 0.5);
          }
        } else if (['tree', 'flowers', 'sign', 'lighthouse'].includes(tile.name)) {
          drawRole(tile.name, px, py, time);
        }
      }
    }

    if (lit) {
      const gx = world.goal.x * TILE + TILE / 2;
      const gy = world.goal.y * TILE + TILE * 0.15;
      const glow = ctx.createRadialGradient(gx, gy, 2, gx, gy, TILE * 1.6);
      glow.addColorStop(0, 'rgba(255, 236, 150, 0.9)');
      glow.addColorStop(1, 'rgba(255, 236, 150, 0)');
      ctx.fillStyle = glow;
      ctx.fillRect(gx - TILE * 2, gy - TILE * 2, TILE * 4, TILE * 4);
    }

    drawRole('explorer', player.x * TILE, player.y * TILE, time, { flip: facingLeft });
  }

  function drawIcon(role, targetCanvas, time = 0) {
    const img = frameFor(role, time);
    const c = targetCanvas.getContext('2d');
    c.imageSmoothingEnabled = false;
    c.clearRect(0, 0, targetCanvas.width, targetCanvas.height);
    if (img) c.drawImage(img, 0, 0, targetCanvas.width, targetCanvas.height);
  }

  return { fit, draw, drawIcon };
}
