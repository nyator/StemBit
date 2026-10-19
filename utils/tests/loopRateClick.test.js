/**
 * The loop click across a tempo change (constants/loopEngine.ts).
 *
 * Changing the tempo re-renders the stretched loop, which blocks the page's
 * thread. The click used to be scheduled only 100ms ahead, so a render longer
 * than that left a hole -- and tapping + fast rendered on every tap, so the
 * click kept dropping out. Then the swap cancelled every queued click, the
 * ones still due under the old tempo included.
 *
 * primeGrid queues the click past the render at the spacing still playing;
 * cutGridFrom then drops only what falls after the swap. Extracted from the
 * engine source the way the other engine tests do it.
 */

const fs = require("fs");
const path = require("path");

const script = fs
  .readFileSync(path.join(__dirname, "..", "..", "constants", "loopEngine.ts"), "utf8")
  .match(/<script id="engine">([\s\S]*?)<\/script>/)[1];

const grab = (name) =>
  script.match(new RegExp(`function ${name}[\\s\\S]*?\\r?\\n        \\}`))[0];

/** The real primeGrid, cutGridFrom and advanceGrid over stubbed audio. */
const makeGrid = ({ beatSec = 0.5, startAt = 0, pendingSwapAt = null } = {}) =>
  // eslint-disable-next-line no-new-func
  new Function(
    "opts",
    `
      var playing = {}; var active = {};
      var clickEnabled = true;
      var pendingSwap = opts.pendingSwapAt == null ? null : { at: opts.pendingSwapAt };
      var gridNextTime = opts.startAt; var gridBeatIndex = 0;
      var beatTimer = null; var beatTimers = []; var clickSources = [];
      var emitted = [];
      function beatSeconds() { return opts.beatSec; }
      function barBeats() { return 4; }
      function emitBeat(index, time) {
        emitted.push(time);
        beatTimers.push({ at: time, id: time });
      }
      function scheduleClick(index, time) {
        var source = { __at: time, stopped: false, stop: function () { this.stopped = true; } };
        clickSources.push(source);
      }
      function clearTimeout() {}
      ${grab("advanceGrid")}
      ${grab("primeGrid")}
      ${grab("cutGridFrom")}
      return {
        primeGrid: primeGrid,
        cutGridFrom: cutGridFrom,
        clicks: function () { return clickSources.map(function (s) { return s.__at; }); },
        all: function () { return clickSources; },
        beats: function () { return beatTimers.map(function (b) { return b.at; }); },
      };
    `
  )({ beatSec, startAt, pendingSwapAt });

describe("the loop click across a tempo render", () => {
  it("queues clicks past the render at the spacing still playing", () => {
    const grid = makeGrid({ beatSec: 0.5, startAt: 0.2 });
    grid.primeGrid(1.5);
    expect(grid.clicks()).toEqual([0.2, 0.7, 1.2]);
    expect(grid.beats()).toEqual([0.2, 0.7, 1.2]);
  });

  it("stops priming at a queued cue swap, which re-lays the grid itself", () => {
    const grid = makeGrid({ beatSec: 0.5, startAt: 0.2, pendingSwapAt: 0.9 });
    grid.primeGrid(1.5);
    expect(grid.clicks()).toEqual([0.2, 0.7]);
  });

  it("keeps the clicks before the swap and cancels the ones after", () => {
    const grid = makeGrid({ beatSec: 0.5, startAt: 0.2 });
    grid.primeGrid(1.5);
    const before = grid.all();
    grid.cutGridFrom(0.9);

    expect(grid.clicks()).toEqual([0.2, 0.7]);
    expect(grid.beats()).toEqual([0.2, 0.7]);
    // The one after the swap was actually stopped, not just forgotten.
    expect(before.filter((s) => s.stopped).map((s) => s.__at)).toEqual([1.2]);
  });
});
