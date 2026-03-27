# csv-import-sanitizer

> Secure, production-ready utility to sanitize, normalize, validate, and transform CSV import data for SaaS applications.

[![CI](https://github.com/Dev-SalamSheikh/csv-import-sanitizer/actions/workflows/ci.yml/badge.svg)](https://github.com/YDev-SalamSheikh/csv-import-sanitizer/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/csv-import-sanitizer)](https://www.npmjs.com/package/csv-import-sanitizer)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## Features

- 🧹 **Header normalization** — trim, casing, special char replacement, alias mapping
- 🔒 **Security** — CSV formula injection defense, prototype pollution prevention, control character stripping
- ✅ **Schema validation** — required fields, type coercion, enum, min/max, custom validators
- 🔍 **Duplicate detection** — configurable composite key matching
- 📊 **Row-level error reporting** — never crashes; reports every issue with row number, column, error code
- 📦 **Dual ESM/CJS** — works everywhere with full TypeScript type definitions

## Installation

```bash
npm install csv-import-sanitizer
```

## Quick Start

```typescript
import { sanitizeCsv } from 'csv-import-sanitizer';

const csv = `Email,First Name,Age,Status
test@example.com, Alice , 25, active
, Bob, abc, pending
test@example.com, Alice2, 30, active`;

const result = sanitizeCsv(csv, {
  headers: {
    casing: 'lowercase',
    aliases: { email: 'email' },
  },
  schema: {
    email: { type: 'string', required: true },
    first_name: { type: 'string', required: true },
    age: { type: 'number', min: 0, max: 150 },
    status: { type: 'string', enum: ['active', 'inactive', 'pending'] },
  },
  duplicateFields: ['email'],
});

console.log(result.validRows);
// [{ email: 'test@example.com', first_name: 'Alice', age: 25, status: 'active' }]

console.log(result.summary);
// { totalRows: 3, validRows: 1, invalidRows: 2, duplicateRows: 1, errorsCount: 3 }
```

## API

### `sanitizeCsv(input, options?)`

The main entry point. Parses, sanitizes, validates, and deduplicates CSV data.

**Parameters:**

| Param | Type | Description |
|-------|------|-------------|
| `input` | `string` | Raw CSV string |
| `options` | `SanitizeCsvOptions` | Configuration (see below) |

**Returns:** `SanitizeResult`

```typescript
interface SanitizeResult {
  validRows: Record<string, unknown>[];
  invalidRows: Record<string, unknown>[];
  errors: RowError[];
  summary: SummaryStats;
}
```

---

### `normalizeHeaders(headers, options?)`

Normalize an array of raw header strings.

```typescript
import { normalizeHeaders } from 'csv-import-sanitizer';

const { headers } = normalizeHeaders(
  ['  Email Address ', 'First Name', 'phone #'],
  { casing: 'lowercase', aliases: { email_address: 'email' } }
);
// headers → ['email', 'first_name', 'phone']
```

---

### `validateRows(rows, schema, rowOffset?)`

Validate row records against a schema.

```typescript
import { validateRows } from 'csv-import-sanitizer';

const result = validateRows(
  [{ email: 'test@test.com', age: '25' }],
  {
    email: { type: 'string', required: true },
    age: { type: 'number', min: 0 },
  }
);
// result.validRows[0].age === 25 (coerced)
```

---

### `detectDuplicates(rows, keyFields)`

Detect duplicate rows based on composite key fields.

```typescript
import { detectDuplicates } from 'csv-import-sanitizer';

const result = detectDuplicates(
  [
    { email: 'a@test.com', name: 'Alice' },
    { email: 'b@test.com', name: 'Bob' },
    { email: 'a@test.com', name: 'Alice Copy' },
  ],
  ['email']
);
// result.duplicateIndices → [2]
```

## Options Reference

### `SanitizeCsvOptions`

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `headers.casing` | `'lowercase' \| 'uppercase' \| 'none'` | `'lowercase'` | Header casing |
| `headers.aliases` | `Record<string, string>` | `{}` | Alias map (raw → canonical) |
| `headers.replaceSpecialChars` | `boolean` | `true` | Replace special chars with `_` |
| `values.normalizeEmptyToNull` | `boolean` | `true` | Convert empty strings to `null` |
| `values.preserveLineBreaks` | `boolean` | `false` | Keep `\n`, `\r`, `\t` in cells |
| `values.escapeFormulas` | `boolean` | `true` | Escape `=`, `+`, `-`, `@` prefixes |
| `schema` | `Schema` | — | Validation schema |
| `limits.maxRows` | `number` | — | Max data rows |
| `limits.maxColumns` | `number` | — | Max columns |
| `limits.maxFileSizeBytes` | `number` | — | Max input size in bytes |
| `allowedColumns` | `string[]` | — | Whitelist of columns to keep |
| `removeUnknownColumns` | `boolean` | `false` | Strip columns not in schema |
| `duplicateFields` | `string[]` | — | Fields for duplicate detection |
| `delimiter` | `string` | auto | CSV delimiter |

### `SchemaField`

| Property | Type | Description |
|----------|------|-------------|
| `type` | `'string' \| 'number' \| 'boolean' \| 'date'` | Type coercion target |
| `required` | `boolean` | Must be non-empty |
| `enum` | `(string \| number \| boolean)[]` | Allowed values |
| `minLength` / `maxLength` | `number` | String length bounds |
| `min` / `max` | `number` | Number range bounds |
| `validate` | `(value) => true \| string` | Custom validator |

## Security

This library defends against common CSV import attack vectors:

- **Formula injection**: Cells starting with `=`, `+`, `-`, `@` are prefixed with `'` to prevent spreadsheet formula execution
- **Prototype pollution**: Headers like `__proto__`, `constructor`, `prototype` are detected and excluded from output
- **Control characters**: Null bytes and non-printable characters (U+0000–U+001F, U+007F) are stripped
- **Size limits**: Configurable row, column, and byte limits to prevent resource exhaustion
- **No eval**: The library never uses `eval()`, `new Function()`, or any dynamic code execution

## Dependencies

This package has a single runtime dependency:

- **[papaparse](https://www.papaparse.com/)** — A fast, lightweight CSV parser that correctly handles RFC 4180 edge cases (quoted fields, newlines in cells, BOM, etc.). It has zero dependencies of its own and is used by thousands of packages.

## License

MIT
