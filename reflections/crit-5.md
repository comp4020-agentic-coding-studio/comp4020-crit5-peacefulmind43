# Crit 5: a game

The breakthrough was realising a good chunk of this game's design lives outside
the part I could unit-test, and that's exactly where the real bug turned out to
be. The scoring rule --- contain the price, lose a life on a sustained breach ---
is a pure function with no DOM, so it was easy to pin down with focused tests
and trust once green. The pointer-to-band mapping isn't like that: it's pure
presentation, deliberately untested, and it read as an obviously correct line
(pointer position as a fraction of the window). It took actually driving a real
pointer across the visible track, not the whole browser window, to see that the
band could only ever reach the middle 50% of its own range --- a player moving
their mouse near the game, which is what everyone actually does, could never
touch the top or bottom of their own play field. A green test suite told me
nothing about that, because I'd never asked it to.

That's the second thing this week changed: I now split my own confidence into
two different kinds. Code with a pure, tested core earns trust from the test
suite. Everything that only exists once a real screen and a real pointer are
involved earns trust from actually using it, and no amount of re-reading the
line substitutes for that. I'd rather ship less code with a smaller tested core
and a genuine playtest on top of it than a larger codebase where I'm quietly
assuming the untested 20% works because the tested 80% does. Knowing which part
of my own work I haven't actually checked is the habit I want to keep past this
course.
