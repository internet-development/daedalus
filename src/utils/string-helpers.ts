/**
 * Converts a string to a URL-safe slug.
 */
export function toSlug(input: string): string {
  return input.toLowerCase().replace(/ /g, '-');
}
