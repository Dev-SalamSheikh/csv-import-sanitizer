import { describe, it, expect } from 'vitest';
import { validateRows } from '../src/validateRows';
import type { Schema } from '../src/types';

describe('validateRows', () => {
  const basicSchema: Schema = {
    email: { type: 'string', required: true },
    name: { type: 'string', required: true },
    age: { type: 'number', min: 0, max: 150 },
  };

  it('should pass valid rows', () => {
    const result = validateRows(
      [{ email: 'test@example.com', name: 'Alice', age: '25' }],
      basicSchema,
    );
    expect(result.validRows).toHaveLength(1);
    expect(result.invalidRows).toHaveLength(0);
    expect(result.validRows[0]).toEqual({
      email: 'test@example.com',
      name: 'Alice',
      age: 25,
    });
  });

  it('should report required field errors', () => {
    const result = validateRows([{ email: '', name: 'Bob', age: '30' }], basicSchema);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]!.code).toBe('REQUIRED_FIELD');
    expect(result.errors[0]!.column).toBe('email');
  });

  it('should report missing required fields (null)', () => {
    const result = validateRows([{ email: null, name: 'Bob', age: '30' }], basicSchema);
    expect(result.errors[0]!.code).toBe('REQUIRED_FIELD');
  });

  it('should report type coercion errors', () => {
    const result = validateRows([{ email: 'a@b.com', name: 'Alice', age: 'abc' }], basicSchema);
    expect(result.invalidRows).toHaveLength(1);
    expect(result.errors[0]!.code).toBe('INVALID_TYPE');
    expect(result.errors[0]!.column).toBe('age');
  });

  it('should coerce numbers correctly', () => {
    const result = validateRows([{ email: 'a@b.com', name: 'Bob', age: '42' }], basicSchema);
    expect(result.validRows[0]!.age).toBe(42);
  });

  it('should validate min/max for numbers', () => {
    const result = validateRows([{ email: 'a@b.com', name: 'Bob', age: '-5' }], basicSchema);
    expect(result.errors[0]!.code).toBe('MIN_VALUE');

    const result2 = validateRows([{ email: 'a@b.com', name: 'Bob', age: '200' }], basicSchema);
    expect(result2.errors[0]!.code).toBe('MAX_VALUE');
  });

  it('should validate enum values', () => {
    const schema: Schema = {
      status: { type: 'string', enum: ['active', 'inactive'] },
    };
    const result = validateRows([{ status: 'pending' }], schema);
    expect(result.errors[0]!.code).toBe('ENUM_MISMATCH');
  });

  it('should pass valid enum values', () => {
    const schema: Schema = {
      status: { type: 'string', enum: ['active', 'inactive'] },
    };
    const result = validateRows([{ status: 'active' }], schema);
    expect(result.validRows).toHaveLength(1);
  });

  it('should validate minLength and maxLength', () => {
    const schema: Schema = {
      code: { type: 'string', minLength: 3, maxLength: 10 },
    };

    const result1 = validateRows([{ code: 'ab' }], schema);
    expect(result1.errors[0]!.code).toBe('MIN_LENGTH');

    const result2 = validateRows([{ code: 'abcdefghijk' }], schema);
    expect(result2.errors[0]!.code).toBe('MAX_LENGTH');

    const result3 = validateRows([{ code: 'abcde' }], schema);
    expect(result3.validRows).toHaveLength(1);
  });

  it('should coerce booleans', () => {
    const schema: Schema = { active: { type: 'boolean' } };
    const result = validateRows(
      [{ active: 'true' }, { active: 'false' }, { active: 'yes' }, { active: '1' }],
      schema,
    );
    expect(result.validRows).toHaveLength(4);
    expect(result.validRows[0]!.active).toBe(true);
    expect(result.validRows[1]!.active).toBe(false);
    expect(result.validRows[2]!.active).toBe(true);
    expect(result.validRows[3]!.active).toBe(true);
  });

  it('should coerce dates', () => {
    const schema: Schema = { date: { type: 'date' } };
    const result = validateRows([{ date: '2024-01-15' }], schema);
    expect(result.validRows).toHaveLength(1);
    expect(typeof result.validRows[0]!.date).toBe('string');
    expect((result.validRows[0]!.date as string).startsWith('2024-01-15')).toBe(true);
  });

  it('should reject invalid dates', () => {
    const schema: Schema = { date: { type: 'date', required: true } };
    const result = validateRows([{ date: 'not-a-date' }], schema);
    expect(result.errors[0]!.code).toBe('INVALID_TYPE');
  });

  it('should run custom validators', () => {
    const schema: Schema = {
      email: {
        type: 'string',
        validate: (v) => {
          if (typeof v === 'string' && v.includes('@')) return true;
          return 'Must be a valid email address.';
        },
      },
    };
    const result = validateRows([{ email: 'notanemail' }], schema);
    expect(result.errors[0]!.code).toBe('CUSTOM_VALIDATION');
    expect(result.errors[0]!.message).toBe('Must be a valid email address.');
  });

  it('should skip validation for optional empty fields', () => {
    const schema: Schema = {
      nickname: { type: 'string', minLength: 3 },
    };
    const result = validateRows([{ nickname: '' }], schema);
    expect(result.validRows).toHaveLength(1);
  });

  it('should use custom row offset for error reporting', () => {
    const schema: Schema = { email: { type: 'string', required: true } };
    const result = validateRows([{ email: '' }], schema, 5);
    expect(result.errors[0]!.row).toBe(5);
  });

  it('should handle multiple errors per row', () => {
    const schema: Schema = {
      email: { type: 'string', required: true },
      name: { type: 'string', required: true },
    };
    const result = validateRows([{ email: '', name: '' }], schema);
    expect(result.errors).toHaveLength(2);
    expect(result.invalidRows).toHaveLength(1);
  });
});
