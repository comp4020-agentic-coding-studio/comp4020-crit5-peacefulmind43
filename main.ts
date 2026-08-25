import { STARTING_LIVES, bandHalfWidthFor, createInitialState, isContained, scoreOf, tick } from "./game.ts";
import type { GameState } from "./game.ts";

function required<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

const trackEl = required<HTMLElement>('[data-testid="track"]');
const bandEl = required<HTMLElement>('[data-testid="band"]');
const priceEl = required<HTMLElement>('[data-testid="price"]');
const scoreEl = required<HTMLElement>('[data-testid="score"]');
const livesEl = required<HTMLElement>('[data-testid="lives"]');
const statusEl = required<HTMLElement>('[data-testid="status"]');

const PRICE_ACCEL = 140; // %/s^2 of random jitter
const BASE_PRICE_SPEED_CAP = 22; // %/s
const PRICE_SPEED_STEP = 1.4; // %/s added per point scored

let state: GameState = createInitialState();
let pricePos = 50;
let priceVelocity = 0;
let bandCenter = 50;
let lastTime: number | null = null;
let rafId: number | null = null;
let prevLives = state.lives;

function priceSpeedCapFor(score: number): number {
  return BASE_PRICE_SPEED_CAP + score * PRICE_SPEED_STEP;
}

function updateBandFromClientY(clientY: number): void {
  // Map against the track's own bounds, not the whole window --- a real
  // player's mouse only ranges over the visible track, so anchoring to
  // window.innerHeight left the top and bottom of the range unreachable
  // (found by actually moving a pointer across the track, not by reading
  // this line).
  const rect = trackEl.getBoundingClientRect();
  const fraction = 1 - Math.min(1, Math.max(0, (clientY - rect.top) / rect.height));
  bandCenter = fraction * 100;
}

function render(): void {
  const halfWidth = bandHalfWidthFor(scoreOf(state));
  priceEl.style.top = `${100 - pricePos}%`;
  bandEl.style.top = `${Math.max(0, 100 - Math.min(100, bandCenter + halfWidth))}%`;
  bandEl.style.height = `${halfWidth * 2}%`;
  scoreEl.textContent = String(scoreOf(state));
  livesEl.textContent = "●".repeat(state.lives) + "○".repeat(STARTING_LIVES - state.lives);
  livesEl.setAttribute("aria-label", `${state.lives} lives remaining`);
}

function flashHit(): void {
  trackEl.classList.remove("hit");
  void trackEl.offsetWidth;
  trackEl.classList.add("hit");
}

function stopLoop(): void {
  if (rafId !== null) cancelAnimationFrame(rafId);
  rafId = null;
}

function startLoop(): void {
  lastTime = null;
  rafId = requestAnimationFrame(tickFrame);
}

function tickFrame(time: number): void {
  if (state.status !== "playing") return;
  const dt = lastTime === null ? 0 : time - lastTime;
  lastTime = time;
  const dtSec = dt / 1000;

  const cap = priceSpeedCapFor(scoreOf(state));
  priceVelocity += (Math.random() - 0.5) * PRICE_ACCEL * dtSec;
  priceVelocity = Math.max(-cap, Math.min(cap, priceVelocity));
  pricePos += priceVelocity * dtSec;
  if (pricePos <= 0) {
    pricePos = 0;
    priceVelocity = Math.abs(priceVelocity);
  } else if (pricePos >= 100) {
    pricePos = 100;
    priceVelocity = -Math.abs(priceVelocity);
  }

  const halfWidth = bandHalfWidthFor(scoreOf(state));
  const contained = isContained(pricePos, bandCenter, halfWidth);
  state = tick(state, contained, dt);

  trackEl.classList.toggle("contained", contained);
  trackEl.classList.toggle("breach", !contained);

  if (state.lives < prevLives) flashHit();
  prevLives = state.lives;

  render();

  if (state.status === "over") {
    stopLoop();
    document.body.classList.add("over");
    statusEl.hidden = false;
    statusEl.textContent = `${scoreOf(state)}`;
    return;
  }

  rafId = requestAnimationFrame(tickFrame);
}

function restart(): void {
  state = createInitialState();
  pricePos = 50;
  priceVelocity = 0;
  prevLives = state.lives;
  trackEl.classList.remove("contained", "breach", "hit");
  statusEl.hidden = true;
  statusEl.textContent = "";
  document.body.classList.remove("over");
  render();
  startLoop();
}

window.addEventListener("pointermove", (event) => updateBandFromClientY(event.clientY));
window.addEventListener(
  "touchmove",
  (event) => {
    const touch = event.touches[0];
    if (touch) updateBandFromClientY(touch.clientY);
  },
  { passive: true },
);
window.addEventListener("keydown", (event) => {
  if (event.code === "ArrowUp") {
    event.preventDefault();
    bandCenter = Math.min(100, bandCenter + 3);
  } else if (event.code === "ArrowDown") {
    event.preventDefault();
    bandCenter = Math.max(0, bandCenter - 3);
  }
});
window.addEventListener("click", () => {
  if (state.status === "over") restart();
});

render();
startLoop();
