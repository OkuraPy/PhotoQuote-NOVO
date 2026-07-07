import { pickLocale } from '../locale';

describe('pickLocale', () => {
  it('maps full tags to their supported language prefix', () => {
    expect(pickLocale(['pt-BR'])).toBe('pt');
    expect(pickLocale(['es-419'])).toBe('es');
    expect(pickLocale(['es-MX'])).toBe('es');
    expect(pickLocale(['en-US'])).toBe('en');
  });

  it('falls back to en when nothing is supported or the list is empty', () => {
    expect(pickLocale(['fr-FR'])).toBe('en');
    expect(pickLocale([])).toBe('en');
  });

  it('skips null/undefined entries and normalizes case', () => {
    expect(pickLocale([null, undefined, 'PT'])).toBe('pt');
  });

  it('scans the list until the first supported language', () => {
    expect(pickLocale(['fr', 'es'])).toBe('es');
  });
});
