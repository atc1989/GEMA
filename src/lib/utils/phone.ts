/**
 * Candidate strings a stored PH mobile number may have been saved as, so
 * "09..." finds "+639..." registrations and vice versa. Shared by the /passes
 * lookup and the referral action behind it so both match the same rows.
 * ponytail: covers 0/63/+63 prefixes; stored numbers with spaces or dashes
 * won't match — normalize at registration write time if that shows up.
 */
export function phoneVariants(input: string): string[] {
  const digits = input.replace(/\D/g, "");
  const variants = new Set([input, digits]);
  if (digits.startsWith("0")) {
    variants.add(`+63${digits.slice(1)}`);
    variants.add(`63${digits.slice(1)}`);
  } else if (digits.startsWith("63")) {
    variants.add(`+${digits}`);
    variants.add(`0${digits.slice(2)}`);
  } else if (digits.length === 10 && digits.startsWith("9")) {
    variants.add(`0${digits}`);
    variants.add(`+63${digits}`);
  }
  return [...variants].filter(Boolean);
}

/** Escapes ilike wildcards so a name containing "%" or "_" can't match everything. */
export function escapeIlike(value: string): string {
  return value.replace(/[\\%_]/g, "\\$&");
}
