import { randomBytes } from 'node:crypto';

// Crockford base32: no I, L, O or U, so a code read aloud or typed by hand stays unambiguous.
const ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/** 16 random characters (80 bits). */
export function generateLookupCode(): string {
  const bytes = randomBytes(10);
  let bits = 0;
  let value = 0;
  let out = '';
  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  return out;
}

/** Accepts what staff type: any case, dashes or spaces, and the look-alikes I/L→1 and O→0. */
export function normalizeLookupCode(input: string): string {
  return input.toUpperCase().replace(/[\s-]/g, '').replace(/[IL]/g, '1').replace(/O/g, '0');
}

/** "ABCD-EFGH-JKMN-PQRS" for printing under the QR code. */
export function formatLookupCode(code: string): string {
  return code.match(/.{1,4}/g)?.join('-') ?? code;
}
