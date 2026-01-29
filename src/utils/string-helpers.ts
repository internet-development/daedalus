/**
 * Converts a string to a URL-safe slug.
 */
export function toSlug(input: string): string {
  return input
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/ /g, '-');
}
