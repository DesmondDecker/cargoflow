import { describe, it, expect } from 'vitest';
import { extensionFor } from './storageService';

describe('extensionFor', () => {
  it('maps allowed types to a fixed extension', () => {
    expect(extensionFor('image/jpeg')).toBe('jpg');
    expect(extensionFor('IMAGE/PNG')).toBe('png');
    expect(extensionFor('application/pdf')).toBe('pdf');
  });
  it('refuses types that could run in a browser or carry odd characters', () => {
    for (const bad of ['text/html', 'image/svg+xml', 'application/javascript', 'image/png?x=1', 'image/../x', 'foo', '']) {
      expect(() => extensionFor(bad)).toThrow(/not allowed/);
    }
  });
});
