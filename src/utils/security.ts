/**
 * Security utilities for CSV sanitization.
 *
 * Defends against:
 * - CSV formula injection
 * - Prototype pollution via dangerous keys
 * - Control character attacks
 * - Excessively large input
 */

import type { SizeLimits } from '../types';

/** Characters that can trigger formula execution in spreadsheet applications. */
const FORMULA_PREFIXES = new Set(['=', '+', '-', '@']);

/** Keys that could lead to prototype pollution if used as object properties. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Escape a cell value that starts with a formula-triggering character.
 * Prefixes the value with a single quote to neutralize formula execution.
 *
 * @param value - The cell value to check and escape.
 * @returns The escaped value, or the original if no escaping is needed.
 *
 * @example
 * ```ts
 * escapeFormulaInjection("=CMD('calc')"); // "'=CMD('calc')"
 * escapeFormulaInjection("hello");         // "hello"
 * ```
 */
export function escapeFormulaInjection(value: string): string {
  if (value.length === 0) return value;
  const firstChar = value.charAt(0);
  if (firstChar !== undefined && FORMULA_PREFIXES.has(firstChar)) {
    return `'${value}`;
  }
  return value;
}

/**
 * Check if a key is a dangerous prototype pollution key.
 *
 * @param key - The object key to check.
 * @returns `true` if the key is dangerous.
 */
export function isDangerousKey(key: string): boolean {
  return DANGEROUS_KEYS.has(key);
}

/**
 * Strip dangerous control characters from a string value.
 * Removes null bytes, and non-printable control chars (U+0000–U+001F, U+007F)
 * while optionally preserving tabs (\t), newlines (\n), and carriage returns (\r).
 *
 * @param value - The string to clean.
 * @param preserveLineBreaks - If true, preserve \n, \r, and \t. Defaults to false.
 * @returns The cleaned string.
 */
export function stripControlCharacters(value: string, preserveLineBreaks = false): string {
  if (preserveLineBreaks) {
    // Remove all control chars except \t (0x09), \n (0x0A), \r (0x0D)
    // eslint-disable-next-line no-control-regex
    return value.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  }
  // Remove all control chars
  // eslint-disable-next-line no-control-regex
  return value.replace(/[\x00-\x1F\x7F]/g, '');
}

/**
 * Validate that the input doesn't exceed configured size limits.
 * Throws an error if any limit is exceeded.
 *
 * @param input - The raw CSV string.
 * @param rowCount - Number of data rows (excluding header).
 * @param columnCount - Number of columns.
 * @param limits - The configured size limits.
 * @returns An array of error messages. Empty if all limits pass.
 */
export function checkSizeLimits(
  input: string,
  rowCount: number,
  columnCount: number,
  limits: SizeLimits,
): string[] {
  const errors: string[] = [];

  if (limits.maxFileSizeBytes !== undefined) {
    const byteSize = new TextEncoder().encode(input).length;
    if (byteSize > limits.maxFileSizeBytes) {
      errors.push(
        `Input size (${byteSize} bytes) exceeds maximum allowed (${limits.maxFileSizeBytes} bytes).`,
      );
    }
  }

  if (limits.maxRows !== undefined && rowCount > limits.maxRows) {
    errors.push(`Row count (${rowCount}) exceeds maximum allowed (${limits.maxRows}).`);
  }

  if (limits.maxColumns !== undefined && columnCount > limits.maxColumns) {
    errors.push(
      `Column count (${columnCount}) exceeds maximum allowed (${limits.maxColumns}).`,
    );
  }

  return errors;
}
