// What to call each stem in a row narrow enough that the name gets cut.
//
// Stems come out of a DAW named after the project: "AntidoteAudio - Drums",
// "AntidoteAudio - Bass", fourteen of them. In a 150px head every one of
// those truncates to "AntidoteAudio - D…" -- the part they share is what's
// left, and the part that tells them apart is what's cut. So the shared
// start is taken off, back to a word boundary, and what differs is shown.
//
// Display only: the stored name, and what a screen reader hears, stay whole.

// Where a cut may fall: after one of these, so "AntidoteAudio - Drums" loses
// "AntidoteAudio - " and not "AntidoteAudio - D".
const SEPARATOR = /[\s\-_.·:|]/;

export function shortStemNames(names: string[]): string[] {
  if (names.length < 2) return names;

  let shared = names[0];
  for (const name of names.slice(1)) {
    let i = 0;
    while (i < shared.length && i < name.length && shared[i] === name[i]) i++;
    shared = shared.slice(0, i);
    if (!shared) return names;
  }

  // Back to the last separator, so a word that only happens to start the
  // same in every stem ("Drum", "Drums Room") isn't cut in half.
  let cut = shared.length;
  while (cut > 0 && !SEPARATOR.test(shared[cut - 1])) cut--;
  if (cut === 0) return names;

  const short = names.map((name) => name.slice(cut).replace(/^[\s\-_.·:|]+/, ""));
  // Any stem left with nothing (its whole name was the shared part) means the
  // cut is wrong for this set -- show them as they are.
  return short.some((name) => name.length === 0) ? names : short;
}
