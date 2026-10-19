const { shortStemNames } = require("../stemNames");

describe("short stem names", () => {
  it("drops the project name every stem starts with", () => {
    expect(
      shortStemNames(["AntidoteAudio - Drums", "AntidoteAudio - Bass", "AntidoteAudio - Pads"])
    ).toEqual(["Drums", "Bass", "Pads"]);
  });

  it("cuts on a word boundary, not mid-word", () => {
    // Shared "Song Dru" would cut "Drums" in half; it backs off to "Song ".
    expect(shortStemNames(["Song Drums", "Song Drum Room"])).toEqual(["Drums", "Drum Room"]);
  });

  it("leaves names alone when nothing useful is shared", () => {
    expect(shortStemNames(["Drums", "Bass"])).toEqual(["Drums", "Bass"]);
    expect(shortStemNames(["Kick", "Keys"])).toEqual(["Kick", "Keys"]);
  });

  it("keeps the originals rather than leave a stem nameless", () => {
    expect(shortStemNames(["Track", "Track 2"])).toEqual(["Track", "Track 2"]);
  });

  it("does nothing for a single stem", () => {
    expect(shortStemNames(["AntidoteAudio - Drums"])).toEqual(["AntidoteAudio - Drums"]);
  });
});
