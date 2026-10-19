const { nextSectionStart, prevSectionStart } = require("../sectionNav");

// Verse at 0, chorus at 30, bridge at 60 -- given out of order on purpose.
const STARTS = [30, 0, 60];

describe("next section", () => {
  it("goes to the first start past where the song is", () => {
    expect(nextSectionStart(STARTS, 12)).toBe(30);
    expect(nextSectionStart(STARTS, 45)).toBe(60);
  });

  it("treats a start the cursor sits on as here, not ahead", () => {
    expect(nextSectionStart(STARTS, 30)).toBe(60);
  });

  it("has nowhere to go from the last section", () => {
    expect(nextSectionStart(STARTS, 70)).toBeNull();
    expect(nextSectionStart([], 10)).toBeNull();
  });
});

describe("previous section", () => {
  it("returns to the top of the section when well into it, playing", () => {
    expect(prevSectionStart(STARTS, 40, true)).toBe(30);
  });

  it("steps back a section when pressed near the top, playing", () => {
    expect(prevSectionStart(STARTS, 31, true)).toBe(0);
  });

  it("always steps back when stopped -- the cursor was put there on purpose", () => {
    expect(prevSectionStart(STARTS, 30, false)).toBe(0);
    expect(prevSectionStart(STARTS, 31, false)).toBe(30);
  });

  it("goes to the top of the song before the first section, or with none", () => {
    expect(prevSectionStart([10, 40], 5, true)).toBe(0);
    expect(prevSectionStart([], 25, false)).toBe(0);
  });
});
