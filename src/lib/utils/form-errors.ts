import type { FieldErrors as RhfFieldErrors, FieldValues } from "react-hook-form";

type ErrorNode = { message?: unknown } & Record<string, unknown>;

/**
 * First validation message anywhere in an RHF error tree, nested fields
 * included.
 *
 * react-hook-form blocks the submit handler whenever *any* registered field
 * fails, but a form only shows the errors it renders. Hidden inputs — the ones
 * carrying ids, uploaded media `kind`, poster URLs — have nowhere to render,
 * so without this the submit button just goes quiet. Forms pass the message to
 * their own error banner.
 */
export function firstFieldErrorMessage<T extends FieldValues>(
  errors: RhfFieldErrors<T>,
): string | undefined {
  const seen = new Set<unknown>();

  const walk = (node: unknown): string | undefined => {
    if (!node || typeof node !== "object" || seen.has(node)) return undefined;
    seen.add(node);

    const record = node as ErrorNode;
    if (typeof record.message === "string" && record.message) return record.message;

    for (const [key, value] of Object.entries(record)) {
      // `ref` points back at the DOM node, and `types` repeats the message.
      if (key === "ref" || key === "types") continue;
      const found = walk(value);
      if (found) return found;
    }
    return undefined;
  };

  return walk(errors);
}
