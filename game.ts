// Pure game rules --- no DOM, no timers, no randomness. main.ts drives the
// live "price" random walk and the pointer-tracked quote band; this file is
// what spec/crit-5.test.ts exercises directly, so the one rule the spec asks
// for a focused test on lives here: how long you can sit outside your own
// quote before it costs you.

export interface GameState {
  readonly containedMs: number;
  readonly breachMs: number;
  readonly invulnerableMs: number;
  readonly lives: number;
  readonly status: "playing" | "over";
}

export const STARTING_LIVES = 3;
export const BREACH_LIMIT_MS = 350;
export const INVULNERABLE_MS = 700;

const START_HALF_WIDTH = 12;
const MIN_HALF_WIDTH = 4;
const HALF_WIDTH_STEP = 0.4;

export function createInitialState(): GameState {
  return {
    containedMs: 0,
    breachMs: 0,
    invulnerableMs: 0,
    lives: STARTING_LIVES,
    status: "playing",
  };
}

export function scoreOf(state: GameState): number {
  return Math.floor(state.containedMs / 100);
}

// The quote band narrows as you score, the same way a market maker who keeps
// getting filled without getting run over can afford to quote tighter.
export function bandHalfWidthFor(score: number): number {
  return Math.max(MIN_HALF_WIDTH, START_HALF_WIDTH - score * HALF_WIDTH_STEP);
}

// Inclusive at the edge: a price sitting exactly on the boundary of your
// quote still counts as covered, not a miss.
export function isContained(price: number, bandCenter: number, bandHalfWidth: number): boolean {
  return Math.abs(price - bandCenter) <= bandHalfWidth;
}

// The one rule the spec wants pinned down: staying inside your quote builds
// score for as long as you hold it there; sitting outside it for longer than
// BREACH_LIMIT_MS costs a life. INVULNERABLE_MS after a hit stops one long
// breach from chaining through every remaining life before you can react.
// resolveAttempt-style no-op once status is "over", so a stray late tick
// can't resurrect a finished run.
export function tick(state: GameState, contained: boolean, dtMs: number): GameState {
  if (state.status === "over") return state;

  const invulnerableMs = Math.max(0, state.invulnerableMs - dtMs);

  if (contained) {
    return { ...state, containedMs: state.containedMs + dtMs, breachMs: 0, invulnerableMs };
  }

  const breachMs = state.breachMs + dtMs;
  if (breachMs >= BREACH_LIMIT_MS && invulnerableMs <= 0) {
    const lives = state.lives - 1;
    return {
      ...state,
      breachMs: 0,
      invulnerableMs: INVULNERABLE_MS,
      lives,
      status: lives <= 0 ? "over" : "playing",
    };
  }

  return { ...state, breachMs, invulnerableMs };
}
