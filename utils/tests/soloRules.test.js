const { isTrackSilent } = require("../soloRules");

const base = { trackId: "bass", solo: null, master: false, muted: false, guide: false };

describe("who is heard", () => {
  it("is everyone unmuted with nothing soloed", () => {
    expect(isTrackSilent(base)).toBe(false);
    expect(isTrackSilent({ ...base, muted: true })).toBe(true);
  });

  it("silences everything but the solo", () => {
    expect(isTrackSilent({ ...base, solo: "bass" })).toBe(false);
    expect(isTrackSilent({ ...base, trackId: "drums", solo: "bass" })).toBe(true);
  });

  it("keeps cue tracks up under a solo", () => {
    expect(isTrackSilent({ ...base, trackId: "cues", solo: "bass", guide: true })).toBe(false);
  });

  it("still lets a cue track be muted on its own", () => {
    expect(
      isTrackSilent({ ...base, trackId: "cues", solo: "bass", guide: true, muted: true })
    ).toBe(true);
  });

  it("lets master mute take the band, solo included", () => {
    expect(isTrackSilent({ ...base, solo: "bass", master: true })).toBe(true);
    expect(isTrackSilent({ ...base, trackId: "drums", master: true })).toBe(true);
  });

  it("keeps cue tracks going under master mute, like the click", () => {
    expect(isTrackSilent({ ...base, trackId: "cues", guide: true, master: true })).toBe(false);
    expect(
      isTrackSilent({ ...base, trackId: "cues", guide: true, master: true, solo: "bass" })
    ).toBe(false);
  });

  it("still lets a cue track's own mute take it out under master mute", () => {
    expect(
      isTrackSilent({ ...base, trackId: "cues", guide: true, master: true, muted: true })
    ).toBe(true);
  });
});
