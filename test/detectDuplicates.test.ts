import { describe, it, expect } from 'vitest';
import { detectDuplicates } from '../src/detectDuplicates';

describe('detectDuplicates', () => {
  it('should detect duplicates based on a single key field', () => {
    const rows = [
      { email: 'a@test.com', name: 'Alice' },
      { email: 'b@test.com', name: 'Bob' },
      { email: 'a@test.com', name: 'Alice Copy' },
    ];
    const result = detectDuplicates(rows, ['email']);
    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateRows).toHaveLength(1);
    expect(result.duplicateIndices).toEqual([2]);
    expect(result.duplicateRows[0]!.name).toBe('Alice Copy');
  });

  it('should detect duplicates based on composite keys', () => {
    const rows = [
      { first: 'John', last: 'Doe' },
      { first: 'Jane', last: 'Doe' },
      { first: 'John', last: 'Doe' },
    ];
    const result = detectDuplicates(rows, ['first', 'last']);
    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateIndices).toEqual([2]);
  });

  it('should be case-insensitive', () => {
    const rows = [
      { email: 'Test@Example.com' },
      { email: 'test@example.com' },
    ];
    const result = detectDuplicates(rows, ['email']);
    expect(result.duplicateRows).toHaveLength(1);
  });

  it('should return all rows as unique when no duplicates exist', () => {
    const rows = [{ email: 'a@test.com' }, { email: 'b@test.com' }, { email: 'c@test.com' }];
    const result = detectDuplicates(rows, ['email']);
    expect(result.uniqueRows).toHaveLength(3);
    expect(result.duplicateRows).toHaveLength(0);
  });

  it('should return all rows when keyFields is empty', () => {
    const rows = [{ email: 'a@test.com' }, { email: 'a@test.com' }];
    const result = detectDuplicates(rows, []);
    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateRows).toHaveLength(0);
  });

  it('should handle null values in key fields', () => {
    const rows = [
      { email: null, name: 'A' },
      { email: null, name: 'B' },
    ];
    const result = detectDuplicates(rows, ['email']);
    expect(result.duplicateRows).toHaveLength(1);
  });

  it('should handle multiple duplicates', () => {
    const rows = [
      { email: 'a@test.com' },
      { email: 'a@test.com' },
      { email: 'a@test.com' },
      { email: 'b@test.com' },
    ];
    const result = detectDuplicates(rows, ['email']);
    expect(result.uniqueRows).toHaveLength(2);
    expect(result.duplicateRows).toHaveLength(2);
    expect(result.duplicateIndices).toEqual([1, 2]);
  });

  it('should handle empty input', () => {
    const result = detectDuplicates([], ['email']);
    expect(result.uniqueRows).toHaveLength(0);
    expect(result.duplicateRows).toHaveLength(0);
  });
});
