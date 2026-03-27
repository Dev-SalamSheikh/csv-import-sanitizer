/**
 * Header normalization for CSV imports.
 *
 * Normalizes raw CSV headers by trimming whitespace, applying casing rules,
 * replacing special characters, and mapping aliases to canonical field names.
 *
 * @module normalizeHeaders
 */

import type { NormalizeHeadersOptions } from './types';
import { isDangerousKey } from './utils/security';

/** Default options for header normalization. */
const DEFAULT_OPTIONS: Required<NormalizeHeadersOptions> = {
  casing: 'lowercase',
  aliases: {},
  replaceSpecialChars: true,
};

/**
 * Normalize an array of raw CSV header strings.
 *
 * Processing steps:
 * 1. Trim whitespace
 * 2. Apply casing (lowercase, uppercase, or none)
 * 3. Replace spaces and special characters with underscores (optional)
 * 4. Apply alias mapping to rename headers to canonical names
 * 5. Reject dangerous keys that could cause prototype pollution
 *
 * @param headers - Array of raw header strings from CSV parsing.
 * @param options - Normalization options.
 * @returns Object containing normalized headers and any dangerous keys that were found.
 *
 * @example
 * ```ts
 * const result = normalizeHeaders(
 *   ['  Email Address ', 'First Name', '__proto__'],
 *   { casing: 'lowercase', aliases: { email_address: 'email' } }
 * );
 * // result.headers → ['email', 'first_name', '__proto__']
 * // result.dangerousKeys → ['__proto__']
 * ```
 */
export function normalizeHeaders(
  headers: string[],
  options: NormalizeHeadersOptions = {},
): { headers: string[]; dangerousKeys: string[] } {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  const dangerousKeys: string[] = [];

  const normalized = headers.map((header) => {
    // Step 1: Trim
    let h = header.trim();

    // Step 2: Apply casing
    switch (opts.casing) {
      case 'lowercase':
        h = h.toLowerCase();
        break;
      case 'uppercase':
        h = h.toUpperCase();
        break;
      case 'none':
        break;
    }

    // Step 3: Check for dangerous keys BEFORE special char replacement
    // This catches __proto__, constructor, prototype before underscores are stripped.
    if (isDangerousKey(h)) {
      dangerousKeys.push(h);
    }

    // Step 4: Replace special characters with underscores
    if (opts.replaceSpecialChars) {
      // Replace any non-alphanumeric, non-underscore character with underscore
      h = h.replace(/[^a-zA-Z0-9_]/g, '_');
      // Collapse multiple underscores
      h = h.replace(/_+/g, '_');
      // Remove leading/trailing underscores
      h = h.replace(/^_+|_+$/g, '');
    }

    // Step 5: Apply alias mapping
    const alias = opts.aliases[h];
    if (alias !== undefined) {
      h = alias;
    }

    return h;
  });

  return { headers: normalized, dangerousKeys };
}
