# COMP4020 prototype

Your starter repo for a COMP4020 prototype: a static site in HTML/CSS/TypeScript
that builds to plain HTML/CSS/JS and deploys to GitHub Pages. The deployed site
is what gets marked, not this repo.

The
[course website](https://comp.anu.edu.au/courses/comp4020-agentic-coding-studio/)
publishes this deliverable's brief and spec, and this repo's name tells you
which deliverable applies. Read both before you plan or build.

## The link-preview card

`public/card.png` (1200x630) is the image a shared link shows; `index.html`'s
head points at it. Replace it and the `description` meta, and copy the head
block into any new page. The card URL resolves against the page that names it,
like any link --- `./card.png` is wrong one directory down, and nothing in CI
checks it, so the deployed head is the only place a broken one shows up.

## The checks

`pnpm check` runs them, and `pnpm check:evidence` is the extra gate before you
ship. CI runs the same plus links, secrets and the deploy.

`spec/README.md`, `PROCESS.md` and `reflections/README.md` are in this repo and
say what they are for.

## Rules learned so far

Carried forward from crit 4 (a Web Audio instrument, not a game) --- only the
stack-independent lessons survive the switch in domain:

- **Don't trust that a mechanic is wired right just because the code reads
  right --- drive the actual control and watch the outcome.** A `<select>`
  listener that looked correct silently dropped scripted `input` events; an
  instrument's release handler that read correctly still let sound ring on
  forever because a *different* always-on part of the signal chain (an
  ambient drone) was never wired to stop. For a game: don't assume a
  collision, a win condition, or a score update fires just because the call
  site looks right --- actually play the move and watch the state change.
- **When a fix doesn't land and the obvious suspect checks out clean, measure
  the whole output, not just the piece you already suspect.** Re-inspecting
  code you already convinced yourself was correct wastes a cycle; instrument
  the actual observable behaviour instead (what's on screen, what state
  changed, what a headless browser sees) and let that redirect you.
- **Rule out the tool before you believe the page is broken.** A scripted
  interaction that changes nothing might be the automation failing to drive
  that specific control, not a bug in the page. Cross-check with a different
  input or a manual pass before trusting a negative result.

## This file is yours

A starting point, not a rulebook: what you add to it is the harness, and the
harness is assessed. This file and the sensors you wire into `check` carry
across the course --- both come with you into next week's repo. The prototype
doesn't: source, and the tests answering this week's published spec, stay
behind. `spec/README.md` draws the line.
