import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { JSDOM } from "jsdom";
import { describe, expect, it } from "vitest";
import {
  STARTING_LIVES,
  bandHalfWidthFor,
  createInitialState,
  isContained,
  scoreOf,
  tick,
} from "../game.ts";

// This week's fixed spec: losable, no on-screen or off-screen instructions,
// and the core scoring/ending rule pinned down with a focused test.

describe("isContained", () => {
  it("is true inside the band", () => {
    expect(isContained(50, 50, 10)).toBe(true);
  });

  it("is true exactly on either edge", () => {
    expect(isContained(40, 50, 10)).toBe(true);
    expect(isContained(60, 50, 10)).toBe(true);
  });

  it("is false outside the band", () => {
    expect(isContained(39.9, 50, 10)).toBe(false);
    expect(isContained(60.1, 50, 10)).toBe(false);
  });
});

describe("bandHalfWidthFor", () => {
  it("narrows as score grows", () => {
    expect(bandHalfWidthFor(5)).toBeLessThan(bandHalfWidthFor(0));
  });

  it("never narrows past a usable floor", () => {
    expect(bandHalfWidthFor(1000)).toBeGreaterThanOrEqual(4);
  });
});

describe("tick: the one rule that ends the game", () => {
  it("staying contained builds score and never costs a life", () => {
    let state = createInitialState();
    state = tick(state, true, 250);
    state = tick(state, true, 260);
    expect(scoreOf(state)).toBe(5);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.status).toBe("playing");
  });

  it("a brief breach under the limit costs nothing", () => {
    const state = tick(createInitialState(), false, 100);
    expect(state.lives).toBe(STARTING_LIVES);
    expect(state.status).toBe("playing");
  });

  it("a sustained breach past the limit costs exactly one life", () => {
    let state = createInitialState();
    state = tick(state, false, 200);
    expect(state.lives).toBe(STARTING_LIVES);
    state = tick(state, false, 200);
    expect(state.lives).toBe(STARTING_LIVES - 1);
    expect(state.status).toBe("playing");
  });

  it("a grace period stops one continuous breach from costing a second life immediately", () => {
    let state = createInitialState();
    while (state.lives === STARTING_LIVES) state = tick(state, false, 50);
    expect(state.lives).toBe(STARTING_LIVES - 1);

    const rightAfter = tick(state, false, 50);
    expect(rightAfter.lives).toBe(STARTING_LIVES - 1);
  });

  it("enough sustained breach eventually ends the game at zero lives", () => {
    let state = createInitialState();
    for (let i = 0; i < 100 && state.status === "playing"; i++) {
      state = tick(state, false, 50);
    }
    expect(state.status).toBe("over");
    expect(state.lives).toBe(0);
  });

  it("a finished game ignores further ticks instead of reviving", () => {
    let state = createInitialState();
    for (let i = 0; i < 100 && state.status === "playing"; i++) {
      state = tick(state, false, 50);
    }
    const finished = state;
    const after = tick(finished, true, 1000);
    expect(after).toEqual(finished);
  });
});

describe("the shipped page teaches nothing by reading", () => {
  const html = readFileSync(resolve("dist/index.html"), "utf8");
  const doc = new JSDOM(html).window.document;

  // Visible text only --- an aria-label naming a control ("Squeeze") is fine,
  // reading the page's own body copy a rulebook is not.
  const visibleText = doc.querySelector("main")?.textContent?.toLowerCase() ?? "";

  const instructionalPhrases = [
    "click",
    "press",
    "tap",
    "drag",
    "move your",
    "how to play",
    "instructions",
    "tutorial",
    "rules",
    "in order to",
  ];

  it("never spells out how to play in the visible copy", () => {
    for (const phrase of instructionalPhrases) {
      expect(visibleText, `found instructional phrase "${phrase}"`).not.toContain(phrase);
    }
  });

  it("ships an interactive track a player can act on without reading a label", () => {
    const track = doc.querySelector('[data-testid="track"]');
    expect(track).toBeTruthy();
  });

  it("ships somewhere for an ending to appear, hidden until the game is over", () => {
    const status = doc.querySelector('[data-testid="status"]');
    expect(status).toBeTruthy();
    expect(status?.hasAttribute("hidden")).toBe(true);
  });
});
