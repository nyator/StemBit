/**
 * Tests for the display name guessed from an email address.
 *
 * Pure string work, but the input is whatever somebody typed into a sign-in
 * box, so the interesting cases are all the addresses that aren't
 * "firstname.lastname@company.com" -- machine-generated locals, plus-addressing,
 * digits used for disambiguation, and the ones that yield nothing usable at all.
 */

const { nameFromEmail, clerkNameFromEmail } = require("../nameFromEmail");

describe("nameFromEmail", () => {
  it("splits on the separators people actually use", () => {
    expect(nameFromEmail("henry.nyator@gmail.com")).toBe("Henry Nyator");
    expect(nameFromEmail("henry_nyator@gmail.com")).toBe("Henry Nyator");
    expect(nameFromEmail("henry-nyator@gmail.com")).toBe("Henry Nyator");
  });

  it("leaves a run-together local part alone", () => {
    // Nothing here says where the break is, and "Nyator Henry" would be a
    // guess on top of a guess.
    expect(nameFromEmail("nyatorhenry@gmail.com")).toBe("Nyatorhenry");
  });

  it("ignores plus-addressing", () => {
    // A filing tag, not part of who they are.
    expect(nameFromEmail("henry+stembit@gmail.com")).toBe("Henry");
    expect(nameFromEmail("henry.nyator+beta@gmail.com")).toBe("Henry Nyator");
  });

  it("drops number-only tokens but keeps words containing digits", () => {
    expect(nameFromEmail("henry.nyator.92@gmail.com")).toBe("Henry Nyator");
    expect(nameFromEmail("henry92@gmail.com")).toBe("Henry92");
  });

  it("normalises case rather than trusting the address", () => {
    expect(nameFromEmail("HENRY.NYATOR@GMAIL.COM")).toBe("Henry Nyator");
    expect(nameFromEmail("  Henry.Nyator@gmail.com  ")).toBe("Henry Nyator");
  });

  it("collapses repeated separators", () => {
    expect(nameFromEmail("henry..nyator@gmail.com")).toBe("Henry Nyator");
    expect(nameFromEmail("henry._-nyator@gmail.com")).toBe("Henry Nyator");
  });

  it("returns nothing when there is nothing worth using", () => {
    // Better "Musician" than a name that is plainly a machine's.
    expect(nameFromEmail("123@gmail.com")).toBeUndefined();
    expect(nameFromEmail("@gmail.com")).toBeUndefined();
    expect(nameFromEmail("")).toBeUndefined();
    expect(nameFromEmail("...@gmail.com")).toBeUndefined();
  });

  it("caps absurd lengths", () => {
    const long = "a".repeat(200) + "@gmail.com";
    expect(nameFromEmail(long).length).toBeLessThanOrEqual(64);
  });

  it("handles a short local part", () => {
    expect(nameFromEmail("hn@gmail.com")).toBe("Hn");
  });
});

describe("clerkNameFromEmail", () => {
  it("puts everything after the first word in the surname", () => {
    expect(clerkNameFromEmail("henry.nyator@gmail.com")).toEqual({
      firstName: "Henry",
      lastName: "Nyator",
    });
  });

  it("leaves the surname empty for a single word", () => {
    expect(clerkNameFromEmail("prince@gmail.com")).toEqual({
      firstName: "Prince",
      lastName: "",
    });
  });

  it("keeps a three-part name together", () => {
    // fullName has to come back out as it went in, so the extra words stay
    // with the surname rather than being dropped.
    expect(clerkNameFromEmail("mary.jane.watson@gmail.com")).toEqual({
      firstName: "Mary",
      lastName: "Jane Watson",
    });
  });

  it("returns nothing when the address yields no name", () => {
    expect(clerkNameFromEmail("123@gmail.com")).toBeUndefined();
  });
});
