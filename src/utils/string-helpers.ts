export interface SlugOptions {
  /** Maximum length of the resulting slug */
  maxLength?: number;
}

/**
 * Converts a string to a URL-safe slug.
 *
 * @param input - The string to convert
 * @param options - Optional configuration
 * @returns A URL-safe slug
 */
export function toSlug(input: string, options: SlugOptions = {}): string {
  let slug = input
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '') // Remove special characters
    .replace(/\s+/g, '-') // Replace whitespace with hyphens
    .replace(/-+/g, '-') // Collapse multiple hyphens
    .replace(/^-|-$/g, ''); // Remove leading/trailing hyphens

  if (options.maxLength && slug.length > options.maxLength) {
    // Truncate at word boundary if possible
    const truncated = slug.slice(0, options.maxLength);
    const lastHyphen = truncated.lastIndexOf('-');
    if (lastHyphen > 0 && lastHyphen > options.maxLength * 0.5) {
      slug = truncated.slice(0, lastHyphen);
    } else {
      slug = truncated.replace(/-$/, '');
    }
  }

  return slug;
}
