/**
 * Fixed-timestep loop: `update(dt)` runs at `hz` regardless of display refresh,
 * `render()` once per animation frame. Returns a stop function.
 */
export function startLoop(update: (dt: number) => void, render: () => void, hz = 60): () => void {
  const stepSec = 1 / hz;
  let acc = 0;
  let last = performance.now();
  let running = true;
  let handle = 0;
  const frame = (now: number) => {
    if (!running) return;
    acc += Math.min(0.25, (now - last) / 1000);
    last = now;
    while (acc >= stepSec) {
      update(stepSec);
      acc -= stepSec;
    }
    render();
    handle = requestAnimationFrame(frame);
  };
  handle = requestAnimationFrame(frame);
  return () => {
    running = false;
    cancelAnimationFrame(handle);
  };
}
