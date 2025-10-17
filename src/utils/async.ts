/** @ignore */
export const nextTick = (cb: CallableFunction) => Promise.resolve().then(() => cb());

/** @ignore */
export const raf = globalThis.requestAnimationFrame || globalThis.setTimeout;
