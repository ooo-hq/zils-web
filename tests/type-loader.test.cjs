const { test } = require('node:test');
const assert = require('node:assert/strict');
const { loaderFrame, LOADER_WORD, LOADER_TICKS } = require('../.private/test-build/type-loader.js');

const word = (frame) => frame.map((cell) => cell.char).join('');
const first = () => 0;

test('a cycle opens fully scrambled in runes', () => {
  const frame = loaderFrame(0, first);
  assert.equal(frame.length, LOADER_WORD.length);
  for (const [i, cell] of frame.entries()) {
    assert.equal(cell.locked, false);
    assert.notEqual(cell.char, LOADER_WORD[i]);
  }
});

test('letters lock left to right and then spell Zils', () => {
  let locked = 0;
  for (let tick = 0; tick < LOADER_TICKS; tick++) {
    const frame = loaderFrame(tick, Math.random);
    const count = frame.filter((cell) => cell.locked).length;
    assert.ok(count >= locked, `tick ${tick} unlocked a letter`);
    assert.deepEqual(frame.map((cell) => cell.locked), frame.map((_, i) => i < count));
    for (const cell of frame) if (cell.locked) assert.ok(LOADER_WORD.includes(cell.char));
    locked = count;
  }
  assert.equal(word(loaderFrame(LOADER_TICKS - 1, first)), 'Zils');
});

test('the loop restarts after one cycle', () => {
  assert.deepEqual(loaderFrame(LOADER_TICKS, first), loaderFrame(0, first));
});

// A page can swap one loader for the next while it opens (the route's, then the page's own). The second one carries on
// from where the first stopped, so a person sees one loader, not the word decoding again.
test('a loader that replaces one just removed carries on from its tick', () => {
  const { resumeTick, LOADER_TICK_MS } = require('../.private/test-build/type-loader.js');
  const start = LOADER_TICKS - 1;
  assert.equal(resumeTick(null, 1000), start);
  assert.equal(resumeTick({ tick: start + 12, at: 1000 }, 1000 + LOADER_TICK_MS), start + 13);
  assert.equal(resumeTick({ tick: start + 12, at: 1000 }, 1000 + 4 * LOADER_TICK_MS), start + 16);
  // Long after the last loader went away, a new one starts from the beginning.
  assert.equal(resumeTick({ tick: start + 12, at: 1000 }, 3000), start);
});
