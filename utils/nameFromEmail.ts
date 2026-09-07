/**
 * A first guess at somebody's name, taken from their email address.
 *
 * Passwordless sign-up collects one thing: an address. Without this, every new
 * account is called "Musician" until the user goes and fixes it, which most
 * never will -- so the profile, and anywhere else a name appears, reads as
 * unfinished for the entire life of the account.
 *
 * A guess, explicitly. It is written to the account as an ordinary display name
 * the user can change at any time, not as anything derived or locked.
 */

const MAX_LENGTH = 64;

/** Separators people actually use in an address's local part. */
const WORD_BREAK = /[._\-]+/;

const titleCase = (word: string) =>
  word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();

export function nameFromEmail(email: string): string | undefined {
  const local = email.trim().toLowerCase().split("@")[0];
  if (!local) return undefined;

  // Plus-addressing is a filing tag, not part of who they are:
  // "henry+stembit@gmail.com" is Henry.
  const withoutTag = local.split("+")[0];

  const words = withoutTag
    .split(WORD_BREAK)
    .map((word) => word.replace(/[^a-z0-9]/g, ""))
    // Numbers in an address are almost always disambiguation rather than name
    // ("henry.nyator.92"), so a token that is only digits is dropped -- but a
    // word that merely contains them is kept, since that may be the name.
    .filter((word) => word.length > 0 && !/^\d+$/.test(word))
    .map(titleCase);

  if (words.length === 0) return undefined;

  const name = words.join(" ");
  // Long enough for any real name; short enough that a machine-generated
  // address doesn't become a paragraph.
  return name.length > MAX_LENGTH ? name.slice(0, MAX_LENGTH).trim() : name;
}

/**
 * The same guess, split the way Clerk stores names.
 *
 * Everything after the first word is the surname, which is what makes
 * "henry.nyator" round-trip as "Henry Nyator" rather than as a first name with
 * a space in it.
 */
export function clerkNameFromEmail(
  email: string
): { firstName: string; lastName: string } | undefined {
  const name = nameFromEmail(email);
  if (!name) return undefined;

  const [firstName, ...rest] = name.split(" ");
  return { firstName, lastName: rest.join(" ") };
}
