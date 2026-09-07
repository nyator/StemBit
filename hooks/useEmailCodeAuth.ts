import { isClerkAPIResponseError } from "@clerk/expo";
// The /legacy entrypoint, not the package root.
//
// @clerk/expo 4's default useSignIn/useSignUp return Clerk's newer signal-based
// API: signIn.emailCode.sendCode(), results as { error } rather than throws, and
// no isLoaded or setActive. It is a nicer shape, but it is still stabilising
// (several of its fields are marked @internal) and essentially every Clerk
// guide and answer currently describes the resource API below -- which matters
// most at the moment something breaks and the docs need to match the code.
//
// Worth revisiting once the signals API is the documented default.
import { useSignIn, useSignUp } from "@clerk/expo/legacy";

import { clerkNameFromEmail } from "../utils/nameFromEmail";

/**
 * Which Clerk flow a pending code belongs to.
 *
 * It matters because the two verify through different calls -- a sign-in
 * attempts a first factor, a sign-up attempts an email-address verification --
 * and by the time somebody is typing six digits, nothing on screen remembers
 * which one started it. The code screen carries this back.
 */
export type EmailAuthMode = "sign_in" | "sign_up";

/** Clerk's code for "no account with that identifier". */
const NOT_FOUND = "form_identifier_not_found";
/** Clerk's code for "that address already has an account". */
const ALREADY_EXISTS = "form_identifier_exists";

const clerkMessage = (error: unknown, fallback: string) => {
  if (isClerkAPIResponseError(error)) {
    // longMessage is the sentence written for humans; message is the terse one.
    return error.errors[0]?.longMessage ?? error.errors[0]?.message ?? fallback;
  }
  return fallback;
};

const codeOf = (error: unknown) =>
  isClerkAPIResponseError(error) ? error.errors[0]?.code : undefined;

/**
 * Passwordless email-code auth, as the two steps the UI actually has.
 *
 * Both screens that can start a code (sign in, create account) end up in the
 * same place, so the flow lives here rather than being written twice and
 * drifting. There are no passwords anywhere in it -- Clerk sends a six-digit
 * code, the user types it back, and that is the whole proof.
 */
export function useEmailCodeAuth() {
  const { signIn, setActive: setSignInActive, isLoaded: signInLoaded } = useSignIn();
  const { signUp, setActive: setSignUpActive, isLoaded: signUpLoaded } = useSignUp();

  // Clerk loads its client asynchronously. Calling into either resource before
  // that resolves throws, so every screen gates its submit on this.
  const isLoaded = signInLoaded && signUpLoaded;

  /**
   * Send a code, creating the account if there isn't one.
   *
   * Sign-in is tried first and sign-up is the fallback, rather than asking the
   * user which they are. With a password that question is unavoidable -- the
   * two forms need different fields. With a code they are identical: an email
   * box and a code box either way, so making somebody pick the right door first
   * is a question the product does not need answered.
   *
   * `preferred` only decides which is attempted first, so the Create Account
   * screen still reports "you already have an account" rather than silently
   * signing them in.
   */
  const sendCode = async (
    email: string,
    preferred: EmailAuthMode = "sign_in"
  ): Promise<EmailAuthMode> => {
    if (!isLoaded) throw new Error("Auth isn't ready yet. Try again in a moment.");

    const identifier = email.trim().toLowerCase();

    const startSignIn = async () => {
      // Two steps rather than create({ strategy, identifier }): create() alone
      // tells us which factors this address actually supports, so preparing a
      // code is something we know will work rather than something we hope will.
      const attempt = await signIn.create({ identifier });
      const factor = attempt.supportedFirstFactors?.find(
        (f) => f.strategy === "email_code"
      );
      if (!factor) {
        throw new Error(
          "This account can't sign in with an email code. Check your Clerk instance has Email code enabled."
        );
      }
      await signIn.prepareFirstFactor({
        strategy: "email_code",
        emailAddressId: factor.emailAddressId,
      });
    };

    const startSignUp = async () => {
      await signUp.create({ emailAddress: identifier });

      // Seed a display name from the address, so a new account isn't called
      // "Musician" until somebody goes and fixes it. It is an ordinary name
      // they can change in Settings whenever they like.
      //
      // Separate from create() and swallowed on failure on purpose: if the
      // Clerk instance has the Name field switched off, passing firstName to
      // create() rejects the whole call -- and failing to guess a nice name is
      // not a reason to stop somebody signing up.
      const guessed = clerkNameFromEmail(identifier);
      if (guessed) {
        try {
          await signUp.update(guessed);
        } catch (nameError) {
          console.warn("Could not seed a display name", nameError);
        }
      }

      await signUp.prepareEmailAddressVerification({ strategy: "email_code" });
    };

    if (preferred === "sign_in") {
      try {
        await startSignIn();
        return "sign_in";
      } catch (error) {
        if (codeOf(error) !== NOT_FOUND) {
          throw new Error(clerkMessage(error, "Couldn't send a code. Try again."));
        }
        // No account yet -- make one. This is the ordinary path for a new user
        // typing their address into the sign-in screen, not an error.
        try {
          await startSignUp();
          return "sign_up";
        } catch (signUpError) {
          throw new Error(
            clerkMessage(signUpError, "Couldn't create an account with that email.")
          );
        }
      }
    }

    try {
      await startSignUp();
      return "sign_up";
    } catch (error) {
      if (codeOf(error) !== ALREADY_EXISTS) {
        throw new Error(clerkMessage(error, "Couldn't send a code. Try again."));
      }
      // They already have an account, so this is a sign-in wearing a Create
      // Account label. Sending them a code is the right answer either way.
      try {
        await startSignIn();
        return "sign_in";
      } catch (signInError) {
        throw new Error(clerkMessage(signInError, "Couldn't send a code. Try again."));
      }
    }
  };

  /**
   * Exchange the typed code for an active session.
   *
   * Anything short of `complete` is treated as a failure. Clerk can legitimately
   * return `needs_second_factor` or `missing_requirements`, and this app has no
   * screens for either -- so surfacing "that didn't work" beats leaving somebody
   * on a spinner in a state the UI cannot advance.
   */
  const verifyCode = async (code: string, mode: EmailAuthMode): Promise<void> => {
    if (!isLoaded) throw new Error("Auth isn't ready yet. Try again in a moment.");

    const digits = code.trim();

    try {
      if (mode === "sign_in") {
        const attempt = await signIn.attemptFirstFactor({
          strategy: "email_code",
          code: digits,
        });
        if (attempt.status !== "complete" || !attempt.createdSessionId) {
          // The code was accepted -- a wrong one throws rather than landing
          // here -- so this is Clerk wanting another step the app has no screen
          // for. Naming the status is the difference between a bug report and
          // a dashboard setting somebody can go and change.
          console.error("Sign-in stalled", {
            status: attempt.status,
            secondFactors: attempt.supportedSecondFactors?.map((f) => f.strategy),
          });
          throw new Error(
            `Sign-in needs another step Clerk calls "${attempt.status}", which this app has no screen for. Turn it off in the Clerk Dashboard.`
          );
        }
        await setSignInActive({ session: attempt.createdSessionId });
        return;
      }

      const attempt = await signUp.attemptEmailAddressVerification({ code: digits });
      if (attempt.status !== "complete" || !attempt.createdSessionId) {
        // Overwhelmingly the cause: the Clerk instance still requires a
        // password, a name or a username, so verifying the address leaves the
        // sign-up at missing_requirements with nothing left for it to collect.
        const missing = attempt.missingFields?.join(", ");
        console.error("Sign-up stalled", {
          status: attempt.status,
          missingFields: attempt.missingFields,
          unverifiedFields: attempt.unverifiedFields,
        });
        throw new Error(
          missing
            ? `Your Clerk instance still requires: ${missing}. Turn those off under Configure -> Email, phone, username so email alone is enough.`
            : `Sign-up stopped at "${attempt.status}" with nothing left to collect.`
        );
      }
      await setSignUpActive({ session: attempt.createdSessionId });
    } catch (error) {
      if (error instanceof Error && !isClerkAPIResponseError(error)) throw error;
      throw new Error(
        clerkMessage(error, "That code isn't right, or it has expired.")
      );
    }
  };

  return { sendCode, verifyCode, isLoaded };
}
