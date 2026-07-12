// Onda B (team) — pure helpers: role/money matrix, starter passwords, credentials message.
import { canSeeMoney, credentialsMessage, PASSWORD_ALPHABET, passwordFromBytes } from '../../data';

describe('canSeeMoney (role × per-member flag matrix)', () => {
  it('owner and office always see money, whatever the flag says', () => {
    expect(canSeeMoney('owner', false)).toBe(true);
    expect(canSeeMoney('owner', true)).toBe(true);
    expect(canSeeMoney('office', false)).toBe(true);
    expect(canSeeMoney('office', undefined)).toBe(true);
  });

  it('field sees money ONLY with the per-member flag', () => {
    expect(canSeeMoney('field', true)).toBe(true);
    expect(canSeeMoney('field', false)).toBe(false);
    expect(canSeeMoney('field', undefined)).toBe(false);
    expect(canSeeMoney('field', null)).toBe(false);
  });
});

describe('passwordFromBytes (starter password for a new member)', () => {
  it('maps bytes deterministically onto the unambiguous alphabet', () => {
    expect(PASSWORD_ALPHABET).toHaveLength(54); // 8 digits + 23 lowercase + 23 uppercase
    // 0→'2' (first), 8→'a' (lowercase starts), 53→'Z' (last), 54 wraps→'2', 103%54=49→'V', 255%54=39→'J'
    expect(passwordFromBytes([0, 8, 53, 54, 103, 255], 6)).toBe('2aZ2VJ');
  });

  it('defaults to 10 chars and only ever uses the alphabet', () => {
    const bytes = Array.from({ length: 10 }, (_, i) => (i * 37 + 5) % 256);
    const pw = passwordFromBytes(bytes);
    expect(pw).toHaveLength(10);
    for (const ch of pw) expect(PASSWORD_ALPHABET).toContain(ch);
  });

  it('alphabet has no look-alike characters (0/O/1/l/I)', () => {
    for (const bad of ['0', 'O', '1', 'l', 'I']) expect(PASSWORD_ALPHABET).not.toContain(bad);
  });

  it('never crashes on short/empty input (guard path, callers always pass enough bytes)', () => {
    expect(passwordFromBytes([0], 4)).toBe('2222'); // repeats the pool instead of throwing
    expect(passwordFromBytes([], 3)).toBe('222');
  });
});

describe('credentialsMessage (owner → employee, localized on purpose)', () => {
  const p = { company: 'Apex Renovations', email: 'joe@crew.com', password: 'abc123XYZ9' };

  it('always carries the email and the password verbatim', () => {
    for (const l of ['en', 'es', 'pt'] as const) {
      const msg = credentialsMessage(l, p);
      expect(msg).toContain('joe@crew.com');
      expect(msg).toContain('abc123XYZ9');
      expect(msg).toContain('Apex Renovations');
    }
  });

  it('speaks the contractor’s language', () => {
    expect(credentialsMessage('en', p)).toContain('added you to PhotoQuote');
    expect(credentialsMessage('en', p)).toContain('Password: abc123XYZ9');
    expect(credentialsMessage('es', p)).toContain('te agregó a PhotoQuote');
    expect(credentialsMessage('es', p)).toContain('Contraseña: abc123XYZ9');
    expect(credentialsMessage('pt', p)).toContain('adicionou você ao PhotoQuote');
    expect(credentialsMessage('pt', p)).toContain('Senha: abc123XYZ9');
  });

  it('a missing company name falls back to a generic first line (never "  added you")', () => {
    const msg = credentialsMessage('en', { email: 'a@b.co', password: 'x'.repeat(10) });
    expect(msg.startsWith('You were added to PhotoQuote.')).toBe(true);
    const pt = credentialsMessage('pt', { company: '   ', email: 'a@b.co', password: 'x'.repeat(10) });
    expect(pt.startsWith('Você foi adicionado ao PhotoQuote.')).toBe(true);
  });
});
