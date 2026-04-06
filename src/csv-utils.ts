/**
 * Escapes a value for safe inclusion in a CSV field.
 *
 * Values that contain commas, double-quotes, or newlines are wrapped in double
 * quotes, with any embedded double-quotes doubled per RFC 4180. Values that
 * need no escaping are returned as-is.
 */
export function escapeCsv(value: string | number): string {
  const text = String(value);
  if (!/[",\n]/.test(text)) {
    return text;
  }

  return `"${text.replace(/"/g, '""')}"`;
}
