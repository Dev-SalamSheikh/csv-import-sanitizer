/**
 * Schema-based row validation for CSV data.
 *
 * Validates each row against a schema definition, performing type coercion,
 * required field checks, enum validation, length/range constraints,
 * and custom validator execution.
 *
 * @module validateRows
 */

import type { Schema, SchemaField, SanitizedRecord, RowError, ValidationResult } from './types';
import { coerceToString, coerceToNumber, coerceToBoolean, coerceToDate } from './utils/coerce';

/**
 * Validate and coerce an array of row records against a schema.
 *
 * Each row is independently validated. If any field fails validation,
 * the entire row is placed in `invalidRows` and errors are collected.
 * Type coercion is applied to valid fields in-place.
 *
 * @param rows - Array of sanitized record objects.
 * @param schema - Schema definition mapping field names to validation rules.
 * @param rowOffset - Starting row number for error reporting (1-based). Defaults to 1.
 * @returns Validation result containing valid rows, invalid rows, and errors.
 *
 * @example
 * ```ts
 * const result = validateRows(
 *   [{ email: 'test@example.com', age: '25' }],
 *   {
 *     email: { type: 'string', required: true },
 *     age: { type: 'number', min: 0, max: 150 },
 *   }
 * );
 * // result.validRows → [{ email: 'test@example.com', age: 25 }]
 * ```
 */
export function validateRows(
  rows: SanitizedRecord[],
  schema: Schema,
  rowOffset = 1,
): ValidationResult {
  const validRows: SanitizedRecord[] = [];
  const invalidRows: SanitizedRecord[] = [];
  const errors: RowError[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]!;
    const rowNumber = i + rowOffset;
    const rowErrors: RowError[] = [];
    const coercedRow: SanitizedRecord = { ...row };

    for (const [field, fieldSchema] of Object.entries(schema)) {
      const fieldErrors = validateField(coercedRow, field, fieldSchema, rowNumber);
      rowErrors.push(...fieldErrors);
    }

    if (rowErrors.length === 0) {
      validRows.push(coercedRow);
    } else {
      invalidRows.push(row);
      errors.push(...rowErrors);
    }
  }

  return { validRows, invalidRows, errors };
}

/**
 * Validate a single field on a row.
 * @internal
 */
function validateField(
  row: SanitizedRecord,
  field: string,
  schema: SchemaField,
  rowNumber: number,
): RowError[] {
  const errors: RowError[] = [];
  const rawValue = row[field];
  const type = schema.type ?? 'string';

  // Check required
  if (schema.required) {
    if (rawValue === null || rawValue === undefined || rawValue === '') {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'REQUIRED_FIELD',
        message: `Field "${field}" is required but is empty or missing.`,
      });
      return errors; // Skip further validation if required field is missing
    }
  }

  // Skip further validation if value is null/undefined/empty (and not required)
  if (rawValue === null || rawValue === undefined || rawValue === '') {
    return errors;
  }

  // Type coercion
  const coerced = coerceValue(rawValue, type);
  if (!coerced.success) {
    errors.push({
      row: rowNumber,
      column: field,
      code: 'INVALID_TYPE',
      message: `Field "${field}" cannot be coerced to type "${type}". Value: "${String(rawValue)}".`,
    });
    return errors;
  }

  // Store coerced value back
  row[field] = coerced.value;
  const value = coerced.value;

  // Enum check
  if (schema.enum !== undefined && schema.enum.length > 0) {
    if (!schema.enum.includes(value as string | number | boolean)) {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'ENUM_MISMATCH',
        message: `Field "${field}" value "${String(value)}" is not in allowed values: [${schema.enum.join(', ')}].`,
      });
    }
  }

  // String length checks
  if (type === 'string' && typeof value === 'string') {
    if (schema.minLength !== undefined && value.length < schema.minLength) {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'MIN_LENGTH',
        message: `Field "${field}" length (${value.length}) is below minimum (${schema.minLength}).`,
      });
    }
    if (schema.maxLength !== undefined && value.length > schema.maxLength) {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'MAX_LENGTH',
        message: `Field "${field}" length (${value.length}) exceeds maximum (${schema.maxLength}).`,
      });
    }
  }

  // Number range checks
  if (type === 'number' && typeof value === 'number') {
    if (schema.min !== undefined && value < schema.min) {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'MIN_VALUE',
        message: `Field "${field}" value (${value}) is below minimum (${schema.min}).`,
      });
    }
    if (schema.max !== undefined && value > schema.max) {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'MAX_VALUE',
        message: `Field "${field}" value (${value}) exceeds maximum (${schema.max}).`,
      });
    }
  }

  // Custom validator
  if (schema.validate) {
    const result = schema.validate(value);
    if (result !== true) {
      errors.push({
        row: rowNumber,
        column: field,
        code: 'CUSTOM_VALIDATION',
        message: typeof result === 'string' ? result : `Field "${field}" failed custom validation.`,
      });
    }
  }

  return errors;
}

/**
 * Coerce a value to the target type.
 * @internal
 */
function coerceValue(
  value: unknown,
  type: string,
): { success: true; value: unknown } | { success: false } {
  switch (type) {
    case 'string':
      return coerceToString(value);
    case 'number':
      return coerceToNumber(value);
    case 'boolean':
      return coerceToBoolean(value);
    case 'date':
      return coerceToDate(value);
    default:
      return coerceToString(value);
  }
}
