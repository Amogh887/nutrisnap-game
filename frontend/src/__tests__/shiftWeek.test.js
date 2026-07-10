import { describe, it, expect } from 'vitest';

function isoWeekToMonday(year, week) {
  const jan4 = new Date(Date.UTC(year, 0, 4));
  const jan4Dow = jan4.getUTCDay() || 7;
  const monday = new Date(jan4);
  monday.setUTCDate(jan4.getUTCDate() - (jan4Dow - 1) + (week - 1) * 7);
  return monday;
}

function dateToIsoWeek(date) {
  const d = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  const weekNo = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(weekNo).padStart(2, '0')}`;
}

function shiftWeek(weekKey, delta) {
  const [y, w] = weekKey.split('-W').map(Number);
  const monday = isoWeekToMonday(y, w);
  const friday = new Date(monday);
  friday.setUTCDate(monday.getUTCDate() + 4 + delta * 7);
  return dateToIsoWeek(friday);
}

describe('shiftWeek (reimplemented copy of src/components/CircleDetail.jsx logic)', () => {
  it('steps prev from 2027-W01 back into the 2026 year-boundary week', () => {
    expect(shiftWeek('2027-W01', -1)).toBe('2026-W53');
  });

  it('steps next across the W52/W53 boundary within 2026', () => {
    expect(shiftWeek('2026-W52', 1)).toBe('2026-W53');
  });

  it('steps next across the W53/W01 year boundary from 2026 into 2027', () => {
    expect(shiftWeek('2026-W53', 1)).toBe('2027-W01');
  });

  it('steps prev from 2026-W53 back to 2026-W52', () => {
    expect(shiftWeek('2026-W53', -1)).toBe('2026-W52');
  });

  it('round-trips prev(next(w)) === w for 30 consecutive weeks spanning the 2026/2027 boundary', () => {
    let w = '2026-W40';
    for (let i = 0; i < 30; i++) {
      const next = shiftWeek(w, 1);
      const back = shiftWeek(next, -1);
      expect(back).toBe(w);
      w = next;
    }
    expect(w).toBe('2027-W17');
  });

  it('round-trips next(prev(w)) === w for 30 consecutive weeks spanning the 2026/2027 boundary', () => {
    let w = '2026-W40';
    for (let i = 0; i < 30; i++) {
      const prev = shiftWeek(w, -1);
      const forward = shiftWeek(prev, 1);
      expect(forward).toBe(w);
      w = prev;
    }
    expect(w).toBe('2026-W10');
  });
});
