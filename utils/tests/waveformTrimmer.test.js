/**
 * The index maths behind the zoomed trimmer's scrolling.
 *
 * Holding a trim handle magnifies the waveform to about a second around that
 * edge, and dragging toward either side scrolls it. Scrolling has to be free —
 * it happens on every frame of a drag — so the screen measures a buffer several
 * seconds wide and the trimmer slides a window over it. sliceBuffer is that
 * slide: get it wrong by a few buckets and the user is trimming against audio
 * from somewhere else in the file, which looks like the waveform drifting under
 * the finger.
 */

const { sliceBuffer } = require("../../components/ui/waveformTrimmer");

/** A buffer whose every bucket says where it is, so a slice is checkable. */
const bufferOf = (start, end, count) => ({
  edge: "start",
  bufferStart: start,
  bufferEnd: end,
  origin: start,
  windowSeconds: 1,
  // Bucket i covers [start + i*step, ...): its value is its own index.
  peaks: Array.from({ length: count }, (_, i) => i),
});

describe("sliceBuffer — the window the zoom slides over its measured audio", () => {
  it("takes the middle of the buffer for a window in the middle", () => {
    // 4s buffer, 400 buckets: 100 per second. The second second is buckets
    // 100–199.
    const zoom = bufferOf(0, 4, 400);
    const slice = sliceBuffer(zoom, 1, 2);

    expect(slice[0]).toBe(100);
    expect(slice).toHaveLength(100);
    expect(slice[slice.length - 1]).toBe(199);
  });

  it("moves by exactly what the view moved", () => {
    const zoom = bufferOf(0, 4, 400);
    const before = sliceBuffer(zoom, 1, 2);
    const after = sliceBuffer(zoom, 1.5, 2.5);

    // Half a second later in a 100-bucket-per-second buffer is 50 buckets on.
    expect(after[0] - before[0]).toBe(50);
    expect(after).toHaveLength(before.length);
  });

  it("counts from the buffer's own start, not from the file's", () => {
    // The buffer is a window into the middle of a long file: bucket 0 is at 10s,
    // not at 0. Reading it as absolute time is the mistake that would put the
    // waveform seconds away from the edge being dragged.
    const zoom = bufferOf(10, 14, 400);
    expect(sliceBuffer(zoom, 11, 12)[0]).toBe(100);
    expect(sliceBuffer(zoom, 10, 11)[0]).toBe(0);
  });

  it("clamps a window that overhangs either end of the buffer", () => {
    const zoom = bufferOf(10, 14, 400);

    const before = sliceBuffer(zoom, 8, 11);
    expect(before[0]).toBe(0);
    expect(before.length).toBeGreaterThan(0);

    const after = sliceBuffer(zoom, 13, 16);
    expect(after[after.length - 1]).toBe(399);
    expect(after.length).toBeGreaterThan(0);
  });

  it("never returns an empty slice, which would blank the view mid-drag", () => {
    const zoom = bufferOf(10, 14, 400);
    expect(sliceBuffer(zoom, 20, 21).length).toBeGreaterThan(0);
    expect(sliceBuffer(zoom, 0, 1).length).toBeGreaterThan(0);
    expect(sliceBuffer(zoom, 12, 12).length).toBeGreaterThan(0);
  });

  it("hands back what it has when nothing has been measured yet", () => {
    const empty = { ...bufferOf(0, 4, 0) };
    expect(sliceBuffer(empty, 1, 2)).toEqual([]);
  });
});
