/**
 * Header casing options for normalization.
 */
export type HeaderCasing = 'lowercase' | 'uppercase' | 'none';

/**
 * Supported schema field types for coercion and validation.
 */
export type FieldType = 'string' | 'number' | 'boolean' | 'date';

/**
 * Schema definition for a single field/column.
 */
export interface SchemaField {
  /** The field type for coercion. Defaults to 'string'. */
  type?: FieldType;
  /** Whether the field is required (non-null, non-empty). */
  required?: boolean;
  /** Allowed enum values. Validation fails if value is not in this list. */
  enum?: ReadonlyArray<string | number | boolean>;
  /** Minimum length for string fields. */
  minLength?: number;
  /** Maximum length for string fields. */
  maxLength?: number;
  /** Minimum value for number fields. */
  min?: number;
  /** Maximum value for number fields. */
  max?: number;
  /**
   * Custom validator function. Return `true` if valid, or a string error message if invalid.
   */
  validate?: (value: unknown) => true | string;
}

/**
 * Schema map: field name -> validation rules.
 */
export type Schema = Record<string, SchemaField>;

/**
 * Options for header normalization.
 */
export interface NormalizeHeadersOptions {
  /** Casing to apply. Defaults to 'lowercase'. */
  casing?: HeaderCasing;
  /** Map of aliases: key is the raw/original header, value is the canonical name. */
  aliases?: Record<string, string>;
  /** If true, replace spaces and special characters with underscores. Defaults to true. */
  replaceSpecialChars?: boolean;
}

/**
 * Options for cell value sanitization.
 */
export interface SanitizeValueOptions {
  /** Convert empty strings to null. Defaults to true. */
  normalizeEmptyToNull?: boolean;
  /** Preserve line breaks in cell values. Defaults to false. */
  preserveLineBreaks?: boolean;
  /** Escape CSV formula injection characters. Defaults to true. */
  escapeFormulas?: boolean;
}

/**
 * Limits to prevent processing excessively large input.
 */
export interface SizeLimits {
  /** Maximum number of rows (excluding header). */
  maxRows?: number;
  /** Maximum number of columns. */
  maxColumns?: number;
  /** Maximum input string size in bytes. */
  maxFileSizeBytes?: number;
}

/**
 * Full options for the sanitizeCsv function.
 */
export interface SanitizeCsvOptions {
  /** Header normalization options. */
  headers?: NormalizeHeadersOptions;
  /** Cell value sanitization options. */
  values?: SanitizeValueOptions;
  /** Schema for validation and type coercion. */
  schema?: Schema;
  /** Size limits. */
  limits?: SizeLimits;
  /** If provided, only these columns are kept in output. */
  allowedColumns?: string[];
  /** If true, remove columns not listed in allowedColumns or schema. Defaults to false. */
  removeUnknownColumns?: boolean;
  /** Fields to use for duplicate detection. If set, duplicates are flagged. */
  duplicateFields?: string[];
  /** CSV delimiter character. Defaults to ',' (auto-detected by papaparse). */
  delimiter?: string;
}

/**
 * Error code constants for categorizing row-level errors.
 */
export type ErrorCode =
  | 'REQUIRED_FIELD'
  | 'INVALID_TYPE'
  | 'ENUM_MISMATCH'
  | 'MIN_LENGTH'
  | 'MAX_LENGTH'
  | 'MIN_VALUE'
  | 'MAX_VALUE'
  | 'CUSTOM_VALIDATION'
  | 'PARSE_ERROR'
  | 'SIZE_LIMIT_EXCEEDED'
  | 'DANGEROUS_KEY'
  | 'DUPLICATE_ROW';

/**
 * A single error associated with a specific row and optionally a column.
 */
export interface RowError {
  /** 1-based row number in the original CSV (after header). */
  row: number;
  /** Column name, if applicable. */
  column?: string;
  /** Machine-readable error code. */
  code: ErrorCode;
  /** Human-readable error message. */
  message: string;
}

/**
 * A parsed and sanitized row record.
 */
export type SanitizedRecord = Record<string, unknown>;

/**
 * Summary statistics for the sanitization result.
 */
export interface SummaryStats {
  totalRows: number;
  validRows: number;
  invalidRows: number;
  duplicateRows: number;
  errorsCount: number;
}

/**
 * The result returned by sanitizeCsv().
 */
export interface SanitizeResult {
  /** Rows that passed all validation. */
  validRows: SanitizedRecord[];
  /** Rows that failed validation, with their original data preserved. */
  invalidRows: SanitizedRecord[];
  /** All errors encountered during processing. */
  errors: RowError[];
  /** Summary statistics. */
  summary: SummaryStats;
}

/**
 * Result returned by detectDuplicates().
 */
export interface DuplicateResult {
  /** Unique rows (first occurrence kept). */
  uniqueRows: SanitizedRecord[];
  /** Duplicate rows. */
  duplicateRows: SanitizedRecord[];
  /** Row indices (0-based) of duplicates. */
  duplicateIndices: number[];
}

/**
 * Result returned by validateRows().
 */
export interface ValidationResult {
  /** Rows that passed validation. */
  validRows: SanitizedRecord[];
  /** Rows that failed validation. */
  invalidRows: SanitizedRecord[];
  /** Validation errors. */
  errors: RowError[];
}
