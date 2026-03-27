/**
 * Main CSV sanitization pipeline.
 *
 * Orchestrates parsing, header normalization, cell sanitization,
 * schema validation, duplicate detection, and security checks
 * into a single high-level function.
 *
 * @module sanitizeCsv
 */

import Papa from 'papaparse';
import type {
  SanitizeCsvOptions,
  SanitizeResult,
  SanitizedRecord,
  RowError,
  SanitizeValueOptions,
} from './types';
import { normalizeHeaders } from './normalizeHeaders';
import { validateRows } from './validateRows';
import { detectDuplicates } from './detectDuplicates';
import { escapeFormulaInjection, stripControlCharacters, checkSizeLimits } from './utils/security';

/** Default value sanitization options. */
const DEFAULT_VALUE_OPTIONS: Required<SanitizeValueOptions> = {
  normalizeEmptyToNull: true,
  preserveLineBreaks: false,
  escapeFormulas: true,
};

/**
 * Sanitize, validate, and transform CSV string input.
 *
 * This is the primary entry point for the library. It performs the
 * following pipeline:
 *
 * 1. **Size limit checks** — reject excessively large input early
 * 2. **CSV parsing** — via papaparse (handles RFC 4180, quoted fields, BOM, etc.)
 * 3. **Header normalization** — trim, casing, special chars, aliases, prototype pollution check
 * 4. **Cell sanitization** — trim, control chars, formula injection, empty→null
 * 5. **Column filtering** — pick allowed columns, remove unknown columns
 * 6. **Schema validation** — required fields, type coercion, enum, length, custom validators
 * 7. **Duplicate detection** — flag duplicate rows based on key fields
 *
 * @param input - The raw CSV string to sanitize.
 * @param options - Configuration for sanitization behavior.
 * @returns A `SanitizeResult` with valid/invalid rows, errors, and summary stats.
 *
 * @example
 * ```ts
 * import { sanitizeCsv } from 'csv-import-sanitizer';
 *
 * const result = sanitizeCsv(
 *   'Email,Name,Age\ntest@example.com,Alice,25\n,Bob,abc',
 *   {
 *     headers: { casing: 'lowercase' },
 *     schema: {
 *       email: { type: 'string', required: true },
 *       name: { type: 'string', required: true },
 *       age: { type: 'number', min: 0 },
 *     },
 *     duplicateFields: ['email'],
 *   }
 * );
 *
 * console.log(result.validRows);   // [{ email: 'test@example.com', name: 'Alice', age: 25 }]
 * console.log(result.invalidRows); // [{ email: null, name: 'Bob', age: null }]
 * console.log(result.errors);      // [{ row: 2, column: 'email', code: 'REQUIRED_FIELD', ... }]
 * ```
 */
export function sanitizeCsv(input: string, options: SanitizeCsvOptions = {}): SanitizeResult {
  const errors: RowError[] = [];
  const valueOpts = { ...DEFAULT_VALUE_OPTIONS, ...options.values };

  // ---------- Step 1: Parse CSV ----------
  const parseResult = Papa.parse<string[]>(input, {
    header: false,
    skipEmptyLines: 'greedy',
    delimiter: options.delimiter,
  });

  // Collect parse errors
  for (const err of parseResult.errors) {
    errors.push({
      row: (err.row ?? 0) + 1,
      code: 'PARSE_ERROR',
      message: `CSV parse error: ${err.message}`,
    });
  }

  const rawRows = parseResult.data;
  if (rawRows.length === 0) {
    return buildEmptyResult(errors);
  }

  // Extract raw headers and data rows
  const rawHeaders = rawRows[0]!;
  const dataRows = rawRows.slice(1);

  // ---------- Step 2: Size limit checks ----------
  if (options.limits) {
    const limitErrors = checkSizeLimits(input, dataRows.length, rawHeaders.length, options.limits);
    if (limitErrors.length > 0) {
      for (const msg of limitErrors) {
        errors.push({ row: 0, code: 'SIZE_LIMIT_EXCEEDED', message: msg });
      }
      return buildEmptyResult(errors);
    }
  }

  // ---------- Step 3: Normalize headers ----------
  const { headers: normalizedHeaders, dangerousKeys } = normalizeHeaders(
    rawHeaders,
    options.headers,
  );

  // Report dangerous keys
  for (const key of dangerousKeys) {
    errors.push({
      row: 0,
      code: 'DANGEROUS_KEY',
      message: `Header "${key}" is a dangerous key and may cause prototype pollution. It will be included but should be handled carefully.`,
    });
  }

  // ---------- Step 4: Build record objects + sanitize cell values ----------
  const records: SanitizedRecord[] = [];
  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i]!;
    const record: SanitizedRecord = Object.create(null);

    for (let j = 0; j < normalizedHeaders.length; j++) {
      const header = normalizedHeaders[j]!;

      // Skip dangerous keys in output
      if (dangerousKeys.includes(header)) {
        continue;
      }

      const rawValue = j < row.length ? row[j]! : '';
      record[header] = sanitizeCellValue(rawValue, valueOpts);
    }

    records.push(record);
  }

  // ---------- Step 5: Column filtering ----------
  let filteredRecords = records;
  if (options.allowedColumns && options.allowedColumns.length > 0) {
    const allowed = new Set(options.allowedColumns);
    filteredRecords = records.map((record) => {
      const filtered: SanitizedRecord = Object.create(null);
      for (const key of Object.keys(record)) {
        if (allowed.has(key)) {
          filtered[key] = record[key];
        }
      }
      return filtered;
    });
  } else if (options.removeUnknownColumns && options.schema) {
    const schemaKeys = new Set(Object.keys(options.schema));
    filteredRecords = records.map((record) => {
      const filtered: SanitizedRecord = Object.create(null);
      for (const key of Object.keys(record)) {
        if (schemaKeys.has(key)) {
          filtered[key] = record[key];
        }
      }
      return filtered;
    });
  }

  // ---------- Step 6: Schema validation ----------
  let validRows: SanitizedRecord[] = filteredRecords;
  let invalidRows: SanitizedRecord[] = [];

  if (options.schema) {
    const validationResult = validateRows(filteredRecords, options.schema);
    validRows = validationResult.validRows;
    invalidRows = validationResult.invalidRows;
    errors.push(...validationResult.errors);
  }

  // ---------- Step 7: Duplicate detection ----------
  let duplicateCount = 0;
  if (options.duplicateFields && options.duplicateFields.length > 0) {
    const dupResult = detectDuplicates(validRows, options.duplicateFields);
    validRows = dupResult.uniqueRows;
    duplicateCount = dupResult.duplicateRows.length;

    for (const dupRow of dupResult.duplicateRows) {
      invalidRows.push(dupRow);
      errors.push({
        row: 0, // We don't track original row number after filtering
        code: 'DUPLICATE_ROW',
        message: `Duplicate row detected on fields: [${options.duplicateFields.join(', ')}].`,
      });
    }
  }

  // ---------- Build result ----------
  return {
    validRows,
    invalidRows,
    errors,
    summary: {
      totalRows: dataRows.length,
      validRows: validRows.length,
      invalidRows: invalidRows.length,
      duplicateRows: duplicateCount,
      errorsCount: errors.length,
    },
  };
}

/**
 * Sanitize a single cell value.
 * @internal
 */
function sanitizeCellValue(value: string, options: Required<SanitizeValueOptions>): string | null {
  // Trim whitespace
  let sanitized = value.trim();

  // Strip control characters
  sanitized = stripControlCharacters(sanitized, options.preserveLineBreaks);

  // Escape formula injection
  if (options.escapeFormulas) {
    sanitized = escapeFormulaInjection(sanitized);
  }

  // Normalize empty to null
  if (options.normalizeEmptyToNull && sanitized === '') {
    return null;
  }

  return sanitized;
}

/**
 * Build an empty result with only errors.
 * @internal
 */
function buildEmptyResult(errors: RowError[]): SanitizeResult {
  return {
    validRows: [],
    invalidRows: [],
    errors,
    summary: {
      totalRows: 0,
      validRows: 0,
      invalidRows: 0,
      duplicateRows: 0,
      errorsCount: errors.length,
    },
  };
}
