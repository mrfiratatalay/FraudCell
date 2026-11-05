import { describe, expect, it } from 'vitest';
import { compareSlaUrgency, riskTone, slaComplianceRate, slaTone } from './risk';

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

describe('compareSlaUrgency', () => {
  const sla = (priority: 'KRITIK' | 'YUKSEK' | 'DUSUK', deadlineAt: string, breached: boolean) => ({
    sla: {
      priority,
      deadlineAt,
      breachedAt: breached ? deadlineAt : null,
      status: breached ? ('BREACHED' as const) : ('NORMAL' as const),
    },
  });

  it('puts breached KRITIK first, then other breaches, then the nearest deadline', () => {
    const items = [
      sla('DUSUK', '2026-11-05T12:00:00Z', false),
      sla('YUKSEK', '2026-11-05T09:00:00Z', true),
      sla('KRITIK', '2026-11-05T09:30:00Z', true),
      sla('KRITIK', '2026-11-05T11:00:00Z', false),
    ];
    const order = [...items].sort(compareSlaUrgency).map((i) => `${i.sla.priority}:${i.sla.status}`);
    expect(order).toEqual(['KRITIK:BREACHED', 'YUKSEK:BREACHED', 'KRITIK:NORMAL', 'DUSUK:NORMAL']);
  });
});

describe('slaComplianceRate', () => {
  const decided = (breached: boolean) => ({
    sla: {
      priority: 'ORTA' as const,
      deadlineAt: '2026-11-05T10:00:00Z',
      breachedAt: breached ? '2026-11-05T10:00:00Z' : null,
      stoppedAt: '2026-11-05T09:00:00Z',
      status: 'NORMAL' as const,
    },
  });

  it('is the share of decided cases that met their SLA', () => {
    expect(slaComplianceRate([decided(false), decided(false), decided(true), decided(false)])).toBe(0.75);
  });

  it('is null when nothing has been decided yet', () => {
    expect(slaComplianceRate([])).toBeNull();
  });
});
