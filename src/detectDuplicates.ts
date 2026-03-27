/**
 * Duplicate row detection for CSV data.
 *
 * Identifies duplicate rows based on configurable key fields,
 * keeping the first occurrence and flagging subsequent duplicates.
 *
 * @module detectDuplicates
 */

import type { SanitizedRecord, DuplicateResult } from './types';

/**
 * Detect duplicate rows based on the specified key fields.
 *
 * Rows are considered duplicates if ALL specified key fields have identical
 * values (compared as lowercased, trimmed strings). The first occurrence
 * of each unique combination is kept; subsequent occurrences are flagged.
 *
 * @param rows - Array of sanitized record objects.
 * @param keyFields - Field names to use as the composite duplicate key.
 * @returns Result containing unique rows, duplicate rows, and duplicate indices.
 *
 * @example
 * ```ts
 * const result = detectDuplicates(
 *   [
 *     { email: 'a@test.com', name: 'Alice' },
 *     { email: 'b@test.com', name: 'Bob' },
 *     { email: 'a@test.com', name: 'Alice Copy' },
 *   ],
 *   ['email']
 * );
 * // result.duplicateIndices → [2]
 * // result.uniqueRows.length → 2
 * // result.duplicateRows.length → 1
 * ```
 */
export function detectDuplicates(rows: SanitizedRecord[], keyFields: string[]): DuplicateResult {
  if (keyFields.length === 0) {
    return {
      uniqueRows: [...rows],
      duplicateRows: [],
      duplicateIndices: [],
    };
  }

  const seen = new Map<string, number>();
  const uniqueRows: SanitizedRecord[] = [];
  const duplicateRows: SanitizedRecord[] = [];
  const duplicateIndices: number[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const key = buildCompositeKey(row, keyFields);

    if (seen.has(key)) {
      duplicateRows.push(row);
      duplicateIndices.push(i);
    } else {
      seen.set(key, i);
      uniqueRows.push(row);
    }
  }

  return { uniqueRows, duplicateRows, duplicateIndices };
}

/**
 * Build a composite key string from specified fields of a row.
 * Values are normalized to lowercase trimmed strings for comparison.
 * @internal
 */
function buildCompositeKey(row: SanitizedRecord, fields: string[]): string {
  return fields
    .map((field) => {
      const value = row[field];
      if (value === null || value === undefined) return '\x00NULL\x00';
      return String(value).trim().toLowerCase();
    })
    .join('\x00|\x00');
}
