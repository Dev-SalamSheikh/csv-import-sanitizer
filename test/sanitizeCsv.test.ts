import { describe, it, expect } from 'vitest';
import { sanitizeCsv } from '../src/sanitizeCsv';

describe('sanitizeCsv', () => {
  describe('basic parsing', () => {
    it('should parse a simple CSV', () => {
      const csv = 'Name,Email\nAlice,alice@test.com\nBob,bob@test.com';
      const result = sanitizeCsv(csv);
      expect(result.validRows).toHaveLength(2);
      expect(result.validRows[0]).toEqual({ name: 'Alice', email: 'alice@test.com' });
      expect(result.summary.totalRows).toBe(2);
    });

    it('should handle empty input', () => {
      const result = sanitizeCsv('');
      expect(result.validRows).toHaveLength(0);
      expect(result.summary.totalRows).toBe(0);
    });

    it('should handle header-only input', () => {
      const result = sanitizeCsv('Name,Email');
      expect(result.validRows).toHaveLength(0);
      expect(result.summary.totalRows).toBe(0);
    });

    it('should handle CSV with extra whitespace in cells', () => {
      const csv = 'Name,Email\n  Alice  ,  alice@test.com  ';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]).toEqual({ name: 'Alice', email: 'alice@test.com' });
    });

    it('should handle quoted fields', () => {
      const csv = 'Name,Bio\nAlice,"Hello, World"\nBob,"Line1\nLine2"';
      const result = sanitizeCsv(csv, { values: { preserveLineBreaks: true } });
      expect(result.validRows[0]!.bio).toBe('Hello, World');
    });
  });

  describe('header normalization', () => {
    it('should normalize headers', () => {
      const csv = '  Email Address ,First Name\ntest@test.com,Alice';
      const result = sanitizeCsv(csv);
      expect(Object.keys(result.validRows[0]!)).toEqual(['email_address', 'first_name']);
    });

    it('should apply header aliases', () => {
      const csv = 'Email Address,Name\ntest@test.com,Alice';
      const result = sanitizeCsv(csv, {
        headers: { aliases: { email_address: 'email' } },
      });
      expect(result.validRows[0]!.email).toBe('test@test.com');
    });
  });

  describe('cell sanitization', () => {
    it('should normalize empty strings to null by default', () => {
      const csv = 'Name,Email\nAlice,';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.email).toBeNull();
    });

    it('should preserve empty strings when configured', () => {
      const csv = 'Name,Email\nAlice,';
      const result = sanitizeCsv(csv, { values: { normalizeEmptyToNull: false } });
      expect(result.validRows[0]!.email).toBe('');
    });

    it('should escape formula injection by default', () => {
      const csv = 'Name,Formula\nAlice,=CMD("calc")';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.formula).toBe('\'=CMD("calc")');
    });

    it('should not escape formulas when disabled', () => {
      const csv = 'Name,Formula\nAlice,=SUM(A1)';
      const result = sanitizeCsv(csv, { values: { escapeFormulas: false } });
      expect(result.validRows[0]!.formula).toBe('=SUM(A1)');
    });

    it('should strip control characters', () => {
      const csv = 'Name\nAlice\x00\x01Bob';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.name).toBe('AliceBob');
    });
  });

  describe('schema validation', () => {
    it('should validate and coerce types', () => {
      const csv = 'Email,Age\ntest@test.com,25';
      const result = sanitizeCsv(csv, {
        schema: {
          email: { type: 'string', required: true },
          age: { type: 'number' },
        },
      });
      expect(result.validRows).toHaveLength(1);
      expect(result.validRows[0]!.age).toBe(25);
    });

    it('should reject invalid rows', () => {
      const csv = 'Email,Age\n,25\ntest@test.com,abc';
      const result = sanitizeCsv(csv, {
        schema: {
          email: { type: 'string', required: true },
          age: { type: 'number' },
        },
      });
      expect(result.validRows).toHaveLength(0);
      expect(result.invalidRows).toHaveLength(2);
      expect(result.errors.length).toBeGreaterThanOrEqual(2);
    });
  });

  describe('column filtering', () => {
    it('should pick only allowed columns', () => {
      const csv = 'Name,Email,Secret\nAlice,alice@test.com,password123';
      const result = sanitizeCsv(csv, { allowedColumns: ['name', 'email'] });
      expect(Object.keys(result.validRows[0]!)).toEqual(['name', 'email']);
      expect(result.validRows[0]!).not.toHaveProperty('secret');
    });

    it('should remove unknown columns when schema is defined', () => {
      const csv = 'Name,Email,Extra\nAlice,a@b.com,junk';
      const result = sanitizeCsv(csv, {
        removeUnknownColumns: true,
        schema: { name: { type: 'string' }, email: { type: 'string' } },
      });
      expect(Object.keys(result.validRows[0]!)).toEqual(['name', 'email']);
    });
  });

  describe('duplicate detection', () => {
    it('should detect duplicate rows', () => {
      const csv = 'Email,Name\na@test.com,Alice\nb@test.com,Bob\na@test.com,Alice2';
      const result = sanitizeCsv(csv, { duplicateFields: ['email'] });
      expect(result.validRows).toHaveLength(2);
      expect(result.invalidRows).toHaveLength(1);
      expect(result.summary.duplicateRows).toBe(1);
    });
  });

  describe('size limits', () => {
    it('should reject input exceeding row limit', () => {
      const rows = Array(11).fill('value').join('\n');
      const csv = `Header\n${rows}`;
      const result = sanitizeCsv(csv, { limits: { maxRows: 5 } });
      expect(result.errors.some((e) => e.code === 'SIZE_LIMIT_EXCEEDED')).toBe(true);
      expect(result.validRows).toHaveLength(0);
    });

    it('should reject input exceeding column limit', () => {
      const headers = Array(20)
        .fill('col')
        .map((c, i) => `${c}${i}`)
        .join(',');
      const csv = `${headers}\n${'v,'.repeat(19)}v`;
      const result = sanitizeCsv(csv, { limits: { maxColumns: 5 } });
      expect(result.errors.some((e) => e.code === 'SIZE_LIMIT_EXCEEDED')).toBe(true);
    });

    it('should reject input exceeding file size limit', () => {
      const csv = `Name\n${'x'.repeat(10000)}`;
      const result = sanitizeCsv(csv, { limits: { maxFileSizeBytes: 100 } });
      expect(result.errors.some((e) => e.code === 'SIZE_LIMIT_EXCEEDED')).toBe(true);
    });
  });

  describe('security', () => {
    it('should handle prototype pollution headers', () => {
      const csv = '__proto__,email\nevil,test@test.com';
      const result = sanitizeCsv(csv);
      expect(result.errors.some((e) => e.code === 'DANGEROUS_KEY')).toBe(true);
      // Dangerous key should not appear in output
      expect(result.validRows[0]!).not.toHaveProperty('__proto__');
      expect(result.validRows[0]!.email).toBe('test@test.com');
    });

    it('should handle constructor key in headers', () => {
      const csv = 'constructor,email\nevil,test@test.com';
      const result = sanitizeCsv(csv);
      expect(result.errors.some((e) => e.code === 'DANGEROUS_KEY')).toBe(true);
    });

    it('should handle null bytes in values', () => {
      const csv = 'Name\nhello\x00world';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.name).toBe('helloworld');
    });

    it('should escape all formula prefixes', () => {
      const csv = 'Val\n=evil\n+evil\n-evil\n@evil';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.val).toBe("'=evil");
      expect(result.validRows[1]!.val).toBe("'+evil");
      expect(result.validRows[2]!.val).toBe("'-evil");
      expect(result.validRows[3]!.val).toBe("'@evil");
    });
  });

  describe('malformed CSV', () => {
    it('should handle rows with fewer columns than headers', () => {
      const csv = 'Name,Email,Age\nAlice';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.name).toBe('Alice');
      expect(result.validRows[0]!.email).toBeNull();
    });

    it('should handle rows with more columns than headers (extra data ignored)', () => {
      const csv = 'Name\nAlice,extra1,extra2';
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.name).toBe('Alice');
    });

    it('should handle entirely empty rows (skipped)', () => {
      const csv = 'Name\nAlice\n\n\nBob';
      const result = sanitizeCsv(csv);
      expect(result.validRows).toHaveLength(2);
    });

    it('should handle giant field values', () => {
      const bigValue = 'x'.repeat(100000);
      const csv = `Name\n${bigValue}`;
      const result = sanitizeCsv(csv);
      expect(result.validRows[0]!.name).toBe(bigValue);
    });
  });

  describe('summary stats', () => {
    it('should return accurate summary', () => {
      const csv = 'Email,Name\na@test.com,Alice\nb@test.com,Bob\na@test.com,Alice2\n,Missing';
      const result = sanitizeCsv(csv, {
        schema: { email: { type: 'string', required: true }, name: { type: 'string' } },
        duplicateFields: ['email'],
      });
      expect(result.summary.totalRows).toBe(4);
      expect(result.summary.validRows + result.summary.invalidRows).toBe(4);
    });
  });
});
