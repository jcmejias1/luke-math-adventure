// Undo and redo. "past" is everything before now, "future" is what undo took away.

export function createHistory(present, limit = 100) {
  return { past: [], present, future: [], limit };
}

export function pushState(h, next) {
  if (next === h.present) return h;
  const past = [...h.past, h.present];
  if (past.length > h.limit) past.shift();
  return { ...h, past, present: next, future: [] };
}

export function undo(h) {
  if (!h.past.length) return h;
  return {
    ...h,
    past: h.past.slice(0, -1),
    present: h.past[h.past.length - 1],
    future: [h.present, ...h.future],
  };
}

export function redo(h) {
  if (!h.future.length) return h;
  const [next, ...future] = h.future;
  return { ...h, past: [...h.past, h.present], present: next, future };
}

export const canUndo = (h) => h.past.length > 0;
export const canRedo = (h) => h.future.length > 0;
