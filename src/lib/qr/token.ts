import "server-only";

import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

import type { RegistrationKind } from "@/lib/database/types";

/**
 * Signed QR payload utilities.
 *
 * A registration QR encodes a compact, tamper-evident token:
 *   v1.<base64url(payloadJson)>.<base64url(hmacSha256)>
 *
 * The payload carries the IDs the scanner needs plus a random nonce. The HMAC
 * signature (keyed by QR_SIGNING_SECRET) lets the server detect tampering
 * before it ever touches the database. The full token string is also stored as
 * event_registrations.qr_payload, so a valid scan must BOTH verify the
 * signature and match a stored registration row.
 */

const VERSION = "v1";

export type QrPayload = {
  /** registration_id */
  rid: string;
  /** event_id */
  eid: string;
  /** attendee id (member_id or prospect_id) */
  aid: string;
  /** registration kind */
  k: RegistrationKind;
  /** random nonce for uniqueness/secrecy */
  n: string;
};

export type DecodedQr = {
  registrationId: string;
  eventId: string;
  attendeeId: string;
  kind: RegistrationKind;
};

function getSecret(): string {
  const secret = process.env.QR_SIGNING_SECRET;
  if (secret && secret.length >= 16) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("QR_SIGNING_SECRET must be set (>=16 chars) in production.");
  }
  // Dev-only fallback so the flow is testable without extra setup.
  return "gema-dev-qr-signing-secret-change-me";
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}

function fromB64url(input: string): Buffer {
  return Buffer.from(input.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function sign(payloadSegment: string): string {
  return b64url(createHmac("sha256", getSecret()).update(payloadSegment).digest());
}

/**
 * Builds a signed QR token for a registration. Use the returned string as the
 * QR contents AND persist it as event_registrations.qr_payload.
 */
export function createRegistrationQrToken(input: {
  registrationId: string;
  eventId: string;
  attendeeId: string;
  kind: RegistrationKind;
}): string {
  const payload: QrPayload = {
    rid: input.registrationId,
    eid: input.eventId,
    aid: input.attendeeId,
    k: input.kind,
    n: randomBytes(8).toString("hex"),
  };
  const payloadSegment = b64url(JSON.stringify(payload));
  return `${VERSION}.${payloadSegment}.${sign(payloadSegment)}`;
}

/**
 * Verifies a scanned token's signature and shape. Returns the decoded IDs, or
 * null when the token is malformed, the wrong version, or fails the HMAC check.
 */
export function verifyRegistrationQrToken(token: string): DecodedQr | null {
  if (typeof token !== "string") return null;
  const parts = token.trim().split(".");
  if (parts.length !== 3) return null;

  const [version, payloadSegment, signature] = parts;
  if (version !== VERSION) return null;

  const expected = sign(payloadSegment);
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  try {
    const payload = JSON.parse(fromB64url(payloadSegment).toString("utf8")) as QrPayload;
    if (!payload.rid || !payload.eid || !payload.aid || !payload.k) return null;
    return {
      registrationId: payload.rid,
      eventId: payload.eid,
      attendeeId: payload.aid,
      kind: payload.k,
    };
  } catch {
    return null;
  }
}
