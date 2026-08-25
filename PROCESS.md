# Process overview

A reading-guide to how the work came together.

## What I built

Squeeze, a one-mechanic reflex game about market making. A "price" random-walks
up and down a vertical track; your quote band follows the pointer and has to
keep containing it. Staying contained builds score for as long as you hold it;
sitting outside the band for more than a third of a second costs a life, with a
short invulnerability window so one long breach can't chain through every life
before you can react. The band narrows and the price accelerates as you score,
so the same mechanic gets harder to sustain the longer you survive. Nothing on
the page explains any of this --- the band visibly follows the mouse the
instant the page loads, which is the entire tutorial.

## The moments that mattered

The harness came from crit-4's `CLAUDE.md`, carried forward and reworded for a
game instead of an audio instrument rather than pasted wholesale --- the
template itself had changed shape again since crit 4 (it had dropped a section
crit 4's version had), so the diff mattered more than the copy
([`35a9a4e`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-peacefulmind43/commit/35a9a4e)).

I explored a few concepts before settling on this one, including a discrete
timing-click game, but it didn't have the right feel for what I actually
wanted: a mechanic about continuously managing exposure rather than reacting to
single moments, which is closer to what makes market making interesting.
Squeeze's core rule --- contain the price or start losing lives --- is a small
pure state machine with no DOM and no timers, which is what
`spec/crit-5.test.ts` exercises directly: boundary containment, a brief breach
costing nothing, a sustained breach costing exactly one life, the grace period
stopping one breach from chaining through every life, and a finished game
refusing to revive on a stray tick
([`0455c72`](https://github.com/comp4020-agentic-coding-studio/comp4020-crit5-peacefulmind43/commit/0455c72)).

That same commit is also where the one change driven by actually playing the
game, rather than reading the code, landed. The pointer-to-band mapping read
perfectly reasonably --- pointer Y as a fraction of the window height --- and
passed every unit test, because none of the unit tests touch DOM geometry at
all; that logic is deliberately outside the pure, tested core. Driving a real
headless browser across the actual visible track, not the whole window, showed
the real problem: hovering across the entire track only swept the band from
about 14% to 61% of its range, because the track sits in the middle of the page
rather than spanning it edge to edge. A player moving their mouse near the
thing they're looking at --- which is what every real player does --- could
never reach the top or bottom of their own play field, making losses feel
arbitrary rather than earned. Remapping against the track's own
`getBoundingClientRect()` instead of `window.innerHeight` fixed it, confirmed
by moving a real pointer across the real track before and after and checking
the band actually reached both ends. Reading the line never would have caught
this; only driving the control the way a player actually would did.
