// Onda D — pure billing helpers. The UI banner/paywall states derive 100% from these.
import { billingState, trialDaysLeft } from '../../data';

const NOW = new Date('2026-07-12T12:00:00Z');

describe('billingState', () => {
  it('non-trial statuses never block (legacy active, paid, unknown, null)', () => {
    expect(billingState('active', null, NOW)).toBe('ok');
    expect(billingState('past_due', '2026-01-01T00:00:00Z', NOW)).toBe('ok');
    expect(billingState(undefined, null, NOW)).toBe('ok');
    expect(billingState(null, '2020-01-01T00:00:00Z', NOW)).toBe('ok');
  });
  it('trial with future expiry is trial', () => {
    expect(billingState('trial', '2026-07-20T12:00:00Z', NOW)).toBe('trial');
  });
  it('trial expiring this exact instant still counts as trial (>= now)', () => {
    expect(billingState('trial', '2026-07-12T12:00:00Z', NOW)).toBe('trial');
  });
  it('trial with past expiry is expired', () => {
    expect(billingState('trial', '2026-07-11T00:00:00Z', NOW)).toBe('expired');
  });
  it('trial without expiry degrades to trial (never lock on missing data)', () => {
    expect(billingState('trial', null, NOW)).toBe('trial');
  });
});

describe('trialDaysLeft', () => {
  it('ceils partial days (expiring later today = 1, not 0)', () => {
    expect(trialDaysLeft('2026-07-12T18:00:00Z', NOW)).toBe(1);
  });
  it('full remaining window', () => {
    expect(trialDaysLeft('2026-07-26T12:00:00Z', NOW)).toBe(14);
  });
  it('past or missing expiry is 0', () => {
    expect(trialDaysLeft('2026-07-10T00:00:00Z', NOW)).toBe(0);
    expect(trialDaysLeft(null, NOW)).toBe(0);
    expect(trialDaysLeft(undefined, NOW)).toBe(0);
  });
});
