import { describe, it, expect } from 'vitest';
import { resolvePort } from './ports';
import { distanceKm, greatCircle } from './route';

describe('resolvePort', () => {
  it('finds a port from the forms carriers write it in', () => {
    expect(resolvePort('QINGDAO, CN')?.name).toBe('Qingdao');
    expect(resolvePort('Port of Qingdao')?.name).toBe('Qingdao');
    expect(resolvePort('FREETOWN, SL')?.name).toBe('Freetown');
    expect(resolvePort('QINGDAO QIANWAN CONTAINER TERMINAL')?.name).toBe('Qingdao');
  });
  it('uses aliases', () => {
    expect(resolvePort('Yantian')?.name).toBe('Shenzhen');
    expect(resolvePort('Apapa, NG')?.name).toBe('Lagos');
  });
  it('does not guess: unknown or empty places give nothing, and a name inside another word does not match', () => {
    expect(resolvePort('Nowhereville')).toBeUndefined();
    expect(resolvePort(undefined)).toBeUndefined();
    expect(resolvePort('')).toBeUndefined();
    expect(resolvePort('Lagosta')).toBeUndefined();
  });
});

describe('route geometry', () => {
  const qingdao = { lat: 36.07, lng: 120.38 };
  const freetown = { lat: 8.49, lng: -13.23 };

  it('measures a sensible distance (Qingdao to Freetown is roughly 13,000 km)', () => {
    const km = distanceKm(qingdao, freetown);
    expect(km).toBeGreaterThan(12000);
    expect(km).toBeLessThan(14500);
  });

  it('starts and ends at the two ports', () => {
    const p = greatCircle(qingdao, freetown);
    expect(p[0].lat).toBeCloseTo(qingdao.lat, 1);
    expect(p[0].lng).toBeCloseTo(qingdao.lng, 1);
    expect(p[p.length - 1].lat).toBeCloseTo(freetown.lat, 1);
    expect(p).toHaveLength(49);
  });

  it('never jumps across the date line', () => {
    const p = greatCircle({ lat: 35, lng: 140 }, { lat: 34, lng: -118 });
    for (let i = 1; i < p.length; i++) expect(Math.abs(p[i].lng - p[i - 1].lng)).toBeLessThan(30);
  });
});
