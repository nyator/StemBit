// Live slider levels reach the engines throttled, and the release always lands
// on the final value. See utils/volumePreview.ts.
import {
  onVolumePreview,
  previewVolume,
  settleVolumePreview,
} from "../volumePreview";

describe("volumePreview", () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it("throttles a drag but always delivers its latest value", () => {
    const heard = [];
    const stop = onVolumePreview("loop", (value) => heard.push(value));

    previewVolume("loop", 0.1); // goes straight out
    previewVolume("loop", 0.2); // inside the window: replaced by the next
    previewVolume("loop", 0.3);
    expect(heard).toEqual([0.1]);

    jest.advanceTimersByTime(40);
    expect(heard).toEqual([0.1, 0.3]);
    stop();
  });

  it("settles on release, dropping a tick still in flight", () => {
    const heard = [];
    const stop = onVolumePreview("pad", (value) => heard.push(value));

    jest.advanceTimersByTime(100);
    previewVolume("pad", 0.5);
    previewVolume("pad", 0.6); // pending
    settleVolumePreview("pad", 0.7);
    jest.advanceTimersByTime(100);

    expect(heard).toEqual([0.5, 0.7]);
    stop();
  });

  it("keeps channels apart", () => {
    const loop = [];
    const metronome = [];
    const stopLoop = onVolumePreview("loop", (value) => loop.push(value));
    const stopMetronome = onVolumePreview("metronome", (value) => metronome.push(value));

    jest.advanceTimersByTime(100);
    settleVolumePreview("metronome", 1.5);

    expect(loop).toEqual([]);
    expect(metronome).toEqual([1.5]);
    stopLoop();
    stopMetronome();
  });
});
