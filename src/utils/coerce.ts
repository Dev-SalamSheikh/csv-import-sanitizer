/**
 * Type coercion utilities for schema-based validation.
 *
 * All coercion functions accept `unknown` input and attempt to convert
 * to the target type. They return `{ success: true, value }` on success
 * or `{ success: false }` on failure.
 */

export type CoercionResult<T> = { success: true; value: T } | { success: false };

/**
 * Coerce a value to string.
 * Null/undefined → success: false, everything else → String(value).
 */
export function coerceToString(value: unknown): CoercionResult<string> {
  if (value === null || value === undefined) {
    return { success: false };
  }
  return { success: true, value: String(value) };
}

/**
 * Coerce a value to number.
 * Accepts numeric strings, rejects NaN/Infinity/empty strings.
 */
export function coerceToNumber(value: unknown): CoercionResult<number> {
  if (value === null || value === undefined || value === '') {
    return { success: false };
  }
  const num = Number(value);
  if (Number.isNaN(num) || !Number.isFinite(num)) {
    return { success: false };
  }
  return { success: true, value: num };
}

/**
 * Coerce a value to boolean.
 * Recognizes: true/false, 'true'/'false', '1'/'0', 'yes'/'no' (case-insensitive).
 */
export function coerceToBoolean(value: unknown): CoercionResult<boolean> {
  if (typeof value === 'boolean') {
    return { success: true, value };
  }
  if (typeof value === 'number') {
    if (value === 1) return { success: true, value: true };
    if (value === 0) return { success: true, value: false };
    return { success: false };
  }
  if (typeof value === 'string') {
    const lower = value.toLowerCase().trim();
    if (lower === 'true' || lower === '1' || lower === 'yes') {
      return { success: true, value: true };
    }
    if (lower === 'false' || lower === '0' || lower === 'no') {
      return { success: true, value: false };
    }
  }
  return { success: false };
}

/**
 * Coerce a value to a Date.
 * Accepts ISO 8601 strings and common date formats.
 * Returns the ISO string representation on success.
 */
export function coerceToDate(value: unknown): CoercionResult<string> {
  if (value === null || value === undefined || value === '') {
    return { success: false };
  }
  const str = String(value).trim();
  const date = new Date(str);
  if (Number.isNaN(date.getTime())) {
    return { success: false };
  }
  return { success: true, value: date.toISOString() };
}
