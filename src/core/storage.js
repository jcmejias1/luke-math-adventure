// Saving in the browser. If the browser blocks saving (private window),
// the game still works; it just won't remember things next time.

export const KEYS = {
  progress: 'lab.progress.v1',
  gameSprites: 'lab.gameSprites.v1',
  studioProjects: 'lab.studio.projects.v1',
  studioCurrent: 'lab.studio.current.v1',
};

function store() {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null;
  }
}

export function loadJSON(key, fallback) {
  try {
    const raw = store()?.getItem(key);
    return raw == null ? fallback : JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(key, value) {
  try {
    const s = store();
    if (!s) return false;
    s.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
