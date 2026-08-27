/**
 * Portable One Account login engine.
 * Source of truth: GEMA. Port this file — do not copy Tailwind/shadcn.
 *
 * Username (no @) → OneGrinders local-first, then API, then mirrored backup.
 * Email → Supabase password.
 *
 * Change 2: OneGrinders writes GEMA person + distributor only. Never Academy BASE or Lifestyle cards.
 */
export const ONEGRINDERS_PRODUCT_WRITES = ["gema.profiles", "gema.members"] as const;

export const THROTTLE_MAX_FAILURES = 5;
export const THROTTLE_WINDOW_MINUTES = 15;

export const BACKUP_WRONG_PASSWORD =
  "Our main login service is temporarily offline. Please try the password you originally " +
  "registered with the guild. If that doesn't work, use “Forgot password?” or contact your admin.";

export const BACKUP_NO_ACCOUNT =
  "Login is temporarily offline for new members. Please try again in a while, " +
  "or contact your admin to get access now.";

export type ProvisionKind = "configuration" | "credentials" | "remote" | "provisioning";

export class SharedLoginError extends Error {
  readonly kind: ProvisionKind;
  constructor(message: string, kind: ProvisionKind) {
    super(message);
    this.name = "SharedLoginError";
    this.kind = kind;
  }
}

export function looksLikeEmail(identifier: string) {
  return identifier.includes("@");
}

export function normalizeIdentifier(identifier: string) {
  return identifier.trim().toLowerCase();
}

export type LoginPorts = {
  isThrottled: (identifier: string) => Promise<boolean>;
  recordFailedLogin: (identifier: string) => Promise<void>;
  lookupEmailByUsername: (username: string) => Promise<string | null>;
  signInWithPassword: (email: string, password: string) => Promise<boolean>;
  provisionOneGrinders: (
    username: string,
    password: string,
  ) => Promise<{ email: string; password: string }>;
};

export type SharedLoginResult =
  | {
      ok: true;
      phase: "session";
      backupLogin: boolean;
      backgroundSync: { username: string; password: string } | null;
    }
  | {
      ok: true;
      phase: "password";
      email: string;
      password: string;
      backupLogin: boolean;
      backgroundSync: { username: string; password: string } | null;
    }
  | { ok: false; error: string };

export function passwordSignInError(backupLogin: boolean) {
  return backupLogin ? BACKUP_WRONG_PASSWORD : "Invalid email or password.";
}

/**
 * Resolve username-or-email + password into a session or a password sign-in.
 * App-specific landing (Lifestyle card, GEMA dashboard, Academy /academy)
 * stays in the caller.
 */
export async function resolveSharedLogin(
  identifierRaw: string,
  password: string,
  ports: LoginPorts,
): Promise<SharedLoginResult> {
  const trimmed = identifierRaw.trim();
  const identifier = normalizeIdentifier(trimmed);
  if (!identifier) {
    return { ok: false, error: "Username or email is required." };
  }
  if (!password) {
    return { ok: false, error: "Password is required." };
  }

  if (await ports.isThrottled(identifier)) {
    return {
      ok: false,
      error: `Too many failed attempts. Please wait ${THROTTLE_WINDOW_MINUTES} minutes and try again.`,
    };
  }

  let email = trimmed;
  let nextPassword = password;
  let backupLogin = false;

  if (!looksLikeEmail(identifier)) {
    const localEmail = await ports.lookupEmailByUsername(identifier);
    if (localEmail) {
      const localOk = await ports.signInWithPassword(localEmail, nextPassword);
      if (localOk) {
        return {
          ok: true,
          phase: "session",
          backupLogin: false,
          backgroundSync: { username: identifier, password: nextPassword },
        };
      }
    }

    try {
      const provisioned = await ports.provisionOneGrinders(identifier, nextPassword);
      email = provisioned.email;
      nextPassword = provisioned.password;
    } catch (error) {
      if (error instanceof SharedLoginError && error.kind === "remote") {
        const fallbackEmail = await ports.lookupEmailByUsername(identifier);
        if (!fallbackEmail) {
          return { ok: false, error: BACKUP_NO_ACCOUNT };
        }
        email = fallbackEmail;
        backupLogin = true;
      } else if (error instanceof SharedLoginError) {
        if (error.kind === "credentials") {
          await ports.recordFailedLogin(identifier);
        }
        return { ok: false, error: error.message };
      } else {
        return { ok: false, error: "Unable to verify this login right now." };
      }
    }
  }

  return {
    ok: true,
    phase: "password",
    email,
    password: nextPassword,
    backupLogin,
    backgroundSync: null,
  };
}
