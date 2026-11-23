import { describe, it, expect } from 'vitest';
import { weakSecretProblem, corsProblem } from './env';

const strong = (c: string) => c.repeat(64);

describe('weakSecretProblem', () => {
  it('accepts two different long secrets', () => {
    expect(weakSecretProblem(strong('a'), strong('b'))).toBeNull();
  });
  it('refuses the placeholders from the example file and the dev defaults', () => {
    expect(weakSecretProblem('change-me-access-secret', strong('b'))).toContain('ACCESS_TOKEN_SECRET');
    expect(weakSecretProblem(strong('a'), 'change-me-refresh-secret')).toContain('REFRESH_TOKEN_SECRET');
    expect(weakSecretProblem('dev-insecure-access-secret'.padEnd(40, 'x'), strong('b'))).toContain('ACCESS_TOKEN_SECRET');
  });
  it('refuses short secrets and a shared secret', () => {
    expect(weakSecretProblem('short', strong('b'))).toContain('shorter than 32');
    expect(weakSecretProblem(strong('a'), strong('a'))).toContain('must be different');
  });
});

describe('corsProblem', () => {
  it('accepts a list of named origins', () => {
    expect(corsProblem('https://admin.example.com, https://portal.example.com')).toBeNull();
  });
  it('refuses a wildcard or an empty value', () => {
    expect(corsProblem('*')).not.toBeNull();
    expect(corsProblem('https://a.example.com,*')).not.toBeNull();
    expect(corsProblem('')).not.toBeNull();
  });
});
