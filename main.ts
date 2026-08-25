import { STARTING_LIVES, bandHalfWidthFor, createInitialState, isContained, scoreOf, tick } from "./game.ts";
import type { GameState } from "./game.ts";

function required<T extends Element>(selector: string): T {
  const el = document.querySelector<T>(selector);
  if (!el) throw new Error(`missing ${selector}`);
  return el;
}

const trackEl = required<HTMLElement>('[data-testid="track"]');
const chartEl = required<HTMLCanvasElement>('[data-testid="chart"]');
const bandEl = required<HTMLElement>('[data-testid="band"]');
const priceEl = required<HTMLElement>('[data-testid="price"]');
const scoreEl = required<HTMLElement>('[data-testid="score"]');
const livesEl = required<HTMLElement>('[data-testid="lives"]');
const statusEl = required<HTMLElement>('[data-testid="status"]');

const chartCtxOrNull = chartEl.getContext("2d");
if (!chartCtxOrNull) throw new Error("2d canvas context unavailable");
const chartCtx = chartCtxOrNull;

const rootStyle = getComputedStyle(document.documentElement);
const GOOD_COLOR = rootStyle.getPropertyValue("--good").trim() || "#38e6b5";
const BAD_COLOR = rootStyle.getPropertyValue("--bad").trim() || "#ff4d5e";

const PRICE_ACCEL = 140; // %/s^2 of random jitter
const BASE_PRICE_SPEED_CAP = 22; // %/s
const PRICE_SPEED_STEP = 1.4; // %/s added per point scored

// A candle closes every CANDLE_INTERVAL_MS of live price movement --- this is
// what turns the continuous random walk into the discrete bars a K-line chart
// is recognisable by, without changing what the price actually does.
const CANDLE_INTERVAL_MS = 260;
const CANDLE_SLOT_PX = 7;

interface Candle {
  open: number;
  high: number;
  low: number;
  close: number;
}

let state: GameState = createInitialState();
let pricePos = 50;
let priceVelocity = 0;
let bandCenter = 50;
let lastTime: number | null = null;
let rafId: number | null = null;
let prevLives = state.lives;
let candles: Candle[] = [];
let currentCandle: Candle | null = null;
let candleElapsedMs = 0;

function priceSpeedCapFor(score: number): number {
  return BASE_PRICE_SPEED_CAP + score * PRICE_SPEED_STEP;
}

function sizeChartCanvas(): void {
  const rect = trackEl.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  chartEl.width = Math.max(1, Math.round(rect.width * dpr));
  chartEl.height = Math.max(1, Math.round(rect.height * dpr));
  chartCtx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function maxCandles(): number {
  const rect = trackEl.getBoundingClientRect();
  return Math.max(1, Math.floor(rect.width / CANDLE_SLOT_PX));
}

function updateCandles(dtMs: number): void {
  if (!currentCandle) {
    currentCandle = { open: pricePos, high: pricePos, low: pricePos, close: pricePos };
    candleElapsedMs = 0;
  }
  currentCandle.high = Math.max(currentCandle.high, pricePos);
  currentCandle.low = Math.min(currentCandle.low, pricePos);
  currentCandle.close = pricePos;
  candleElapsedMs += dtMs;
  if (candleElapsedMs >= CANDLE_INTERVAL_MS) {
    candles.push(currentCandle);
    const cap = maxCandles();
    if (candles.length > cap) candles = candles.slice(candles.length - cap);
    currentCandle = null;
  }
}

function drawChart(): void {
  const rect = trackEl.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;
  chartCtx.clearRect(0, 0, width, height);

  chartCtx.strokeStyle = "rgba(124, 138, 168, 0.12)";
  chartCtx.lineWidth = 1;
  const rows = 4;
  for (let i = 1; i < rows; i++) {
    const y = (height / rows) * i;
    chartCtx.beginPath();
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);
    chartCtx.stroke();
  }

  const yFor = (value: number) => ((100 - value) / 100) * height;
  const bodyWidth = Math.max(2, CANDLE_SLOT_PX - 2);
  const all = currentCandle ? [...candles, currentCandle] : candles;
  all.forEach((candle, i) => {
    const x = width - (all.length - i) * CANDLE_SLOT_PX + CANDLE_SLOT_PX / 2;
    if (x < -CANDLE_SLOT_PX) return;
    const color = candle.close >= candle.open ? GOOD_COLOR : BAD_COLOR;
    chartCtx.strokeStyle = color;
    chartCtx.fillStyle = color;
    chartCtx.beginPath();
    chartCtx.moveTo(x, yFor(candle.high));
    chartCtx.lineTo(x, yFor(candle.low));
    chartCtx.stroke();
    const bodyTop = yFor(Math.max(candle.open, candle.close));
    const bodyBottom = yFor(Math.min(candle.open, candle.close));
    chartCtx.fillRect(x - bodyWidth / 2, bodyTop, bodyWidth, Math.max(1, bodyBottom - bodyTop));
  });
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

  updateCandles(dt);
  drawChart();
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
  candles = [];
  currentCandle = null;
  candleElapsedMs = 0;
  trackEl.classList.remove("contained", "breach", "hit");
  statusEl.hidden = true;
  statusEl.textContent = "";
  document.body.classList.remove("over");
  drawChart();
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
window.addEventListener("resize", () => {
  sizeChartCanvas();
  drawChart();
});

sizeChartCanvas();
render();
startLoop();
