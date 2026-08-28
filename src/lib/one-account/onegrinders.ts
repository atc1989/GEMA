/**
 * OneGrinders Guild is the username verifier for every GutGuard app. Nothing in
 * this file touches Supabase or Next — it verifies credentials against the
 * guild API and normalises the account it returns.
 */

const DEFAULT_LOGIN_ENDPOINT = "https://onegrindersguild.ph/api/v1/auth/login.php";
const EXTERNAL_EMAIL_DOMAIN = "onegrindersguild.local";

function loginEndpoint() {
  return process.env.ONEGRINDERS_LOGIN_URL ?? DEFAULT_LOGIN_ENDPOINT;
}

type ExternalLoginUser = {
  id: number;
  role_id: number;
  username: string;
  profile_photo: string | null;
  referrer: string | null;
  status: string;
  created_at: string | null;
};

type ExternalLoginProfile = {
  id: number;
  username: string;
  first_name: string | null;
  middle_name: string | null;
  last_name: string | null;
  full_name: string | null;
  display_name: string | null;
  rank_title: string | null;
  city: string | null;
  province: string | null;
};

export type ExternalLoginAccount = {
  user: ExternalLoginUser;
  profile: ExternalLoginProfile;
};

type ExternalLoginResponse = {
  ok?: boolean;
  message?: string;
  data?: {
    authenticated?: boolean;
    account?: ExternalLoginAccount;
  };
};

export type ExternalLoginProvisionResult = {
  email: string;
  password: string;
};

export type ExternalLoginErrorKind =
  | "configuration"
  | "credentials"
  | "remote"
  | "provisioning";

export class ExternalLoginError extends Error {
  // Assigned in the body, not as a parameter property: Node's strip-only
  // TypeScript mode runs the mirrored tests and rejects parameter properties.
  readonly kind: ExternalLoginErrorKind;

  constructor(message: string, kind: ExternalLoginErrorKind) {
    super(message);
    this.kind = kind;
  }
}

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function externalEmailForUsername(username: string) {
  const safeUsername = normalizeUsername(username).replace(/[^a-z0-9._-]/g, "-");
  return `${safeUsername}@${EXTERNAL_EMAIL_DOMAIN}`;
}

/** Synthetic addresses can't receive mail (no reset links, no notifications). */
export function isSyntheticExternalEmail(email: string) {
  return email.toLowerCase().endsWith(`@${EXTERNAL_EMAIL_DOMAIN}`);
}

export function memberCodeForExternalUser(userId: number) {
  return `OGG-${String(userId).padStart(6, "0")}`;
}

function normalizeStatus(status: string) {
  return status.trim().toUpperCase();
}

export function profilePhotoUrl(path: string | null) {
  if (!path) return null;
  if (/^https?:\/\//i.test(path)) return path;
  return new URL(path, "https://onegrindersguild.ph").toString();
}

export function externalTimestamp(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value.replace(" ", "T"));
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

/**
 * The name parts are authoritative: the external DB's stored full_name column
 * has drifted on some rows (held another member's name), so only fall back to
 * it when the parts are empty.
 */
export function externalFullName(account: ExternalLoginAccount) {
  const { profile, user } = account;
  const fromParts = [profile.first_name, profile.middle_name, profile.last_name]
    .map((part) => part?.trim())
    .filter(Boolean)
    .join(" ");
  return (
    fromParts ||
    profile.full_name?.trim() ||
    profile.display_name?.trim() ||
    user.username
  );
}

export function externalUserMetadata(account: ExternalLoginAccount) {
  return {
    provider: "onegrindersguild",
    external_user_id: account.user.id,
    external_profile_id: account.profile.id,
    username: account.user.username,
    full_name: externalFullName(account),
  };
}

export async function verifyExternalCredentials(username: string, password: string) {
  const apiKey = process.env.ONEGRINDERS_API_KEY;
  if (!apiKey) {
    throw new ExternalLoginError(
      "External login is not configured. Add ONEGRINDERS_API_KEY on the server.",
      "configuration",
    );
  }

  let response: Response;
  try {
    response = await fetch(loginEndpoint(), {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        "X-API-Key": apiKey,
      },
      body: JSON.stringify({ username: normalizeUsername(username), password }),
      cache: "no-store",
      // The upstream currently stalls 28-31s per login (internal ~30s timeout
      // bug on their side) but then succeeds. Returning members never wait —
      // the local-mirror fast path skips this call — so only first-time logins
      // and changed passwords pay this, and for them a slow success beats a
      // fast refusal. 45s leaves headroom over the observed worst case while
      // staying inside the login page's maxDuration = 60.
      // Drop back to ~8s once the external API is fast again.
      signal: AbortSignal.timeout(45_000),
    });
  } catch {
    throw new ExternalLoginError("Login service is temporarily unavailable.", "remote");
  }

  let data: ExternalLoginResponse | null = null;
  try {
    data = (await response.json()) as ExternalLoginResponse;
  } catch {
    throw new ExternalLoginError("Login service returned an invalid response.", "remote");
  }

  if (response.status === 401) {
    throw new ExternalLoginError("Invalid username or password.", "credentials");
  }

  if (!response.ok || !data?.ok || !data.data?.authenticated || !data.data.account) {
    throw new ExternalLoginError(data?.message ?? "Login verification failed.", "remote");
  }

  const account = data.data.account;
  if (normalizeStatus(account.user.status) !== "ACTIVE") {
    throw new ExternalLoginError("This external account is not active.", "credentials");
  }

  return account;
}
