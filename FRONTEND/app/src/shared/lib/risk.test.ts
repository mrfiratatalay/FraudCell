import { describe, expect, it } from 'vitest';
import { riskTone, slaTone } from './risk';

describe('slaTone (case §4.4)', () => {
  const running = { breachedAt: null } as const;
  const breached = { status: 'BREACHED', breachedAt: '2026-11-05T10:00:00Z' } as const;

  it('colours a running SLA by how close the deadline is', () => {
    expect(slaTone({ ...running, status: 'NORMAL', priority: 'KRITIK' })).toBe(riskTone('DUSUK'));
    expect(slaTone({ ...running, status: 'WARNING', priority: 'KRITIK' })).toBe(riskTone('ORTA'));
    expect(slaTone({ ...running, status: 'URGENT', priority: 'DUSUK' })).toBe(riskTone('YUKSEK'));
  });

  it('colours a breached SLA by priority: KRITIK red, YUKSEK orange, the rest a warning', () => {
    expect(slaTone({ ...breached, priority: 'KRITIK' })).toBe(riskTone('KRITIK'));
    expect(slaTone({ ...breached, priority: 'YUKSEK' })).toBe(riskTone('YUKSEK'));
    expect(slaTone({ ...breached, priority: 'ORTA' })).toBe(riskTone('ORTA'));
    expect(slaTone({ ...breached, priority: 'DUSUK' })).toBe(riskTone('ORTA'));
  });
});
