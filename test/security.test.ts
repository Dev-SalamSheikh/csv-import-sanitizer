import { describe, it, expect } from 'vitest';
import {
  escapeFormulaInjection,
  isDangerousKey,
  stripControlCharacters,
  checkSizeLimits,
} from '../src/utils/security';

describe('escapeFormulaInjection', () => {
  it('should escape values starting with =', () => {
    expect(escapeFormulaInjection('=CMD("calc")')).toBe('\'=CMD("calc")');
  });

  it('should escape values starting with +', () => {
    expect(escapeFormulaInjection('+1234')).toBe("'+1234");
  });

  it('should escape values starting with -', () => {
    expect(escapeFormulaInjection('-1234')).toBe("'-1234");
  });

  it('should escape values starting with @', () => {
    expect(escapeFormulaInjection('@SUM(A1:A10)')).toBe("'@SUM(A1:A10)");
  });

  it('should not escape normal values', () => {
    expect(escapeFormulaInjection('hello world')).toBe('hello world');
    expect(escapeFormulaInjection('12345')).toBe('12345');
  });

  it('should handle empty strings', () => {
    expect(escapeFormulaInjection('')).toBe('');
  });

  it('should escape complex formula injection attempts', () => {
    expect(escapeFormulaInjection('=HYPERLINK("http://evil.com","Click")')).toBe(
      '\'=HYPERLINK("http://evil.com","Click")',
    );
  });
});

describe('isDangerousKey', () => {
  it('should identify __proto__ as dangerous', () => {
    expect(isDangerousKey('__proto__')).toBe(true);
  });

  it('should identify constructor as dangerous', () => {
    expect(isDangerousKey('constructor')).toBe(true);
  });

  it('should identify prototype as dangerous', () => {
    expect(isDangerousKey('prototype')).toBe(true);
  });

  it('should not flag normal keys', () => {
    expect(isDangerousKey('email')).toBe(false);
    expect(isDangerousKey('name')).toBe(false);
    expect(isDangerousKey('proto')).toBe(false);
  });
});

describe('stripControlCharacters', () => {
  it('should strip null bytes', () => {
    expect(stripControlCharacters('hello\x00world')).toBe('helloworld');
  });

  it('should strip control characters', () => {
    expect(stripControlCharacters('hello\x01\x02\x03world')).toBe('helloworld');
  });

  it('should strip newlines and tabs by default', () => {
    expect(stripControlCharacters('hello\n\t\rworld')).toBe('helloworld');
  });

  it('should preserve newlines and tabs when configured', () => {
    expect(stripControlCharacters('hello\n\t\rworld', true)).toBe('hello\n\t\rworld');
  });

  it('should still strip null bytes when preserving line breaks', () => {
    expect(stripControlCharacters('hello\x00\nworld', true)).toBe('hello\nworld');
  });

  it('should strip DEL character (0x7F)', () => {
    expect(stripControlCharacters('hello\x7Fworld')).toBe('helloworld');
  });

  it('should handle strings with only control characters', () => {
    expect(stripControlCharacters('\x00\x01\x02')).toBe('');
  });

  it('should handle empty strings', () => {
    expect(stripControlCharacters('')).toBe('');
  });
});

describe('checkSizeLimits', () => {
  it('should pass when within limits', () => {
    const errors = checkSizeLimits('col1,col2\na,b', 1, 2, {
      maxRows: 100,
      maxColumns: 10,
      maxFileSizeBytes: 1000,
    });
    expect(errors).toHaveLength(0);
  });

  it('should report row limit exceeded', () => {
    const errors = checkSizeLimits('', 101, 2, { maxRows: 100 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Row count');
  });

  it('should report column limit exceeded', () => {
    const errors = checkSizeLimits('', 1, 50, { maxColumns: 10 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Column count');
  });

  it('should report file size limit exceeded', () => {
    const bigString = 'x'.repeat(10000);
    const errors = checkSizeLimits(bigString, 1, 1, { maxFileSizeBytes: 100 });
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain('Input size');
  });

  it('should report multiple violations', () => {
    const errors = checkSizeLimits('', 200, 50, {
      maxRows: 100,
      maxColumns: 10,
    });
    expect(errors).toHaveLength(2);
  });

  it('should skip checks for unset limits', () => {
    const errors = checkSizeLimits('', 9999, 9999, {});
    expect(errors).toHaveLength(0);
  });
});
