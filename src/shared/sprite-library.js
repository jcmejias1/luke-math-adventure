// Where the game finds its pictures.
// 1. The picture files in assets/sprites/ (saved in the project).
// 2. Pictures sent from the Sprite Studio with "Use in game" (saved in this browser).
// Studio pictures win, so Luke sees his drawings right away.

import { validateSprite } from '../core/sprite.js';
import { loadJSON, saveJSON, KEYS } from '../core/storage.js';

export const ROLES = ['explorer', 'crystal', 'tree', 'water', 'grass', 'flowers', 'gate', 'sign', 'lighthouse'];

export const ROLE_LABELS = {
  explorer: 'Explorer (you!)',
  crystal: 'Crystal',
  tree: 'Tree',
  water: 'Water',
  grass: 'Grass',
  flowers: 'Flowers',
  gate: 'Gate',
  sign: 'Sign',
  lighthouse: 'Lighthouse',
};

export async function loadProjectSprites(base = 'assets/sprites/') {
  const out = {};
  await Promise.all(
    ROLES.map(async (role) => {
      try {
        const res = await fetch(`${base}${role}.json`, { cache: 'no-cache' });
        if (!res.ok) return;
        const sprite = await res.json();
        if (validateSprite(sprite).length === 0) out[role] = sprite;
      } catch {
        // Missing or broken file: the game draws a plain colored square instead.
      }
    }),
  );
  return out;
}

export function loadStudioSprites() {
  const raw = loadJSON(KEYS.gameSprites, {});
  const out = {};
  if (raw && typeof raw === 'object') {
    for (const role of ROLES) {
      if (raw[role] && validateSprite(raw[role]).length === 0) out[role] = raw[role];
    }
  }
  return out;
}

export async function loadGameSprites() {
  return { ...(await loadProjectSprites()), ...loadStudioSprites() };
}

export function useSpriteInGame(role, sprite) {
  const all = loadJSON(KEYS.gameSprites, {}) || {};
  all[role] = sprite;
  return saveJSON(KEYS.gameSprites, all);
}

export function restoreOriginal(role) {
  const all = loadJSON(KEYS.gameSprites, {}) || {};
  delete all[role];
  return saveJSON(KEYS.gameSprites, all);
}
