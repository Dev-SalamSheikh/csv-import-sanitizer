import { describe, it, expect } from 'vitest';
import { normalizeHeaders } from '../src/normalizeHeaders';

describe('normalizeHeaders', () => {
  it('should trim whitespace from headers', () => {
    const result = normalizeHeaders(['  email  ', '  name  ']);
    expect(result.headers).toEqual(['email', 'name']);
  });

  it('should lowercase headers by default', () => {
    const result = normalizeHeaders(['Email', 'FIRST_NAME', 'Last Name']);
    expect(result.headers).toEqual(['email', 'first_name', 'last_name']);
  });

  it('should uppercase headers when configured', () => {
    const result = normalizeHeaders(['email', 'name'], { casing: 'uppercase' });
    expect(result.headers).toEqual(['EMAIL', 'NAME']);
  });

  it('should preserve casing when configured as none', () => {
    const result = normalizeHeaders(['Email', 'firstName'], { casing: 'none' });
    expect(result.headers).toEqual(['Email', 'firstName']);
  });

  it('should replace special characters with underscores', () => {
    const result = normalizeHeaders(['first name', 'email-address', 'phone #']);
    expect(result.headers).toEqual(['first_name', 'email_address', 'phone']);
  });

  it('should collapse multiple underscores', () => {
    const result = normalizeHeaders(['first   name', 'email---address']);
    expect(result.headers).toEqual(['first_name', 'email_address']);
  });

  it('should apply alias mapping', () => {
    const result = normalizeHeaders(['email_address', 'first_name'], {
      aliases: { email_address: 'email', first_name: 'name' },
    });
    expect(result.headers).toEqual(['email', 'name']);
  });

  it('should detect dangerous keys', () => {
    const result = normalizeHeaders(['__proto__', 'email', 'constructor']);
    expect(result.dangerousKeys).toEqual(['__proto__', 'constructor']);
  });

  it('should handle empty headers', () => {
    const result = normalizeHeaders(['', '  ', 'email']);
    expect(result.headers).toEqual(['', '', 'email']);
  });

  it('should skip special char replacement when disabled', () => {
    const result = normalizeHeaders(['first name'], { replaceSpecialChars: false });
    expect(result.headers).toEqual(['first name']);
  });

  it('should handle headers with only special characters', () => {
    const result = normalizeHeaders(['###', '@@@']);
    expect(result.headers).toEqual(['', '']);
  });

  it('should handle duplicate headers without error', () => {
    const result = normalizeHeaders(['name', 'name', 'Name']);
    expect(result.headers).toEqual(['name', 'name', 'name']);
  });
});
