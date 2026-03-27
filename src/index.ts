/**
 * csv-import-sanitizer
 *
 * Secure, production-ready utility to sanitize, normalize, validate,
 * and transform CSV import data for SaaS applications.
 *
 * @packageDocumentation
 */

export { sanitizeCsv } from './sanitizeCsv';
export { normalizeHeaders } from './normalizeHeaders';
export { validateRows } from './validateRows';
export { detectDuplicates } from './detectDuplicates';

// Re-export all types
export type {
  SanitizeCsvOptions,
  SanitizeResult,
  SanitizedRecord,
  SanitizeValueOptions,
  NormalizeHeadersOptions,
  HeaderCasing,
  Schema,
  SchemaField,
  FieldType,
  SizeLimits,
  RowError,
  ErrorCode,
  SummaryStats,
  ValidationResult,
  DuplicateResult,
} from './types';
