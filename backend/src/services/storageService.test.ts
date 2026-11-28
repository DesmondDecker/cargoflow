import { describe, it, expect } from 'vitest';
import { extensionFor, validateUploadSize, MAX_UPLOAD_BYTES } from './storageService';

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

describe('validateUploadSize', () => {
  it('accepts omitted sizes and files at or below 10 MB', () => {
    expect(() => validateUploadSize(undefined)).not.toThrow();
    expect(() => validateUploadSize(MAX_UPLOAD_BYTES)).not.toThrow();
  });

  it('rejects zero, negative, non-integer, and oversized file sizes', () => {
    for (const bad of [0, -1, 1.5, MAX_UPLOAD_BYTES + 1]) {
      expect(() => validateUploadSize(bad)).toThrow(/10 MB/);
    }
  });
});
