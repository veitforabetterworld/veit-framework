import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';

/**
 * The one format for secrets at rest in all hosts: `enc1:` plus base64 of `{"iv","tag","d"}` (each base64), AES-256-GCM
 * with a 12-byte IV and a 16-byte tag. The key is sha256(`${material}|${context}`), with the material trimmed, so one
 * key material can serve several purposes. Sprachassistent's Rust reader (src/secrets.rs) reads the same layout.
 *
 * Nothing else is read at runtime: no plain text, no older layouts. Stored values in an older layout are converted
 * once with '@veit/secret-box/migrate'.
 */

export const SECRET_BOX_PREFIX = 'enc1:';

export type SecretBoxOptions = {
  /** Key material. A function is read on every call, so a key the host changes at runtime applies at once. */
  key: string | (() => string);
  /** Purpose of the values, e.g. 'sprachassistent-credentials'; part of the derived key. */
  context: string;
};

export type SecretBox = {
  /** `enc1:…`; '' stays ''. Throws without key material. */
  encrypt(plain: string): string;
  /** The plain value of an `enc1:` value; '' stays ''. Throws on anything else, a wrong key or missing material. */
  decrypt(stored: string): string;
  /** Whether the value has the canonical layout (`enc1:` and a well-formed payload); needs no key. */
  isEncrypted(stored: string): boolean;
  /** Whether key material is configured. */
  enabled(): boolean;
};

export class SecretBoxError extends Error {
  constructor(
    readonly code: 'secret_box.no_key' | 'secret_box.not_encrypted' | 'secret_box.unreadable',
    message: string,
  ) {
    super(message);
    this.name = 'SecretBoxError';
  }
}

type Payload = { iv: Buffer; tag: Buffer; data: Buffer };

/** The payload of a canonical value, or null when the layout does not match. */
export function parseCanonical(stored: string): Payload | null {
  if (!stored.startsWith(SECRET_BOX_PREFIX)) return null;
  try {
    const json = JSON.parse(Buffer.from(stored.slice(SECRET_BOX_PREFIX.length), 'base64').toString('utf8')) as unknown;
    if (typeof json !== 'object' || json === null) return null;
    const { iv, tag, d } = json as Record<string, unknown>;
    if (typeof iv !== 'string' || typeof tag !== 'string' || typeof d !== 'string') return null;
    const payload = { iv: Buffer.from(iv, 'base64'), tag: Buffer.from(tag, 'base64'), data: Buffer.from(d, 'base64') };
    return payload.iv.length === 12 && payload.tag.length === 16 ? payload : null;
  } catch {
    return null;
  }
}

/** AES-256-GCM; throws on a wrong key or tampered data. */
export function openAesGcm(key: Buffer, payload: Payload): string {
  const decipher = createDecipheriv('aes-256-gcm', key, payload.iv);
  decipher.setAuthTag(payload.tag);
  return Buffer.concat([decipher.update(payload.data), decipher.final()]).toString('utf8');
}

/** sha256(`${material}|${context}`), the key of the canonical format. */
export function deriveSecretBoxKey(material: string, context: string): Buffer {
  return createHash('sha256').update(`${material}|${context}`, 'utf8').digest();
}

export function createSecretBox(options: SecretBoxOptions): SecretBox {
  const { context } = options;
  const material = () => (typeof options.key === 'function' ? options.key() : options.key).trim();
  let cached: { material: string; key: Buffer } | null = null;

  function key(): Buffer {
    const m = material();
    if (m === '') throw new SecretBoxError('secret_box.no_key', `secret-box: no key material for '${context}'`);
    if (cached?.material !== m) cached = { material: m, key: deriveSecretBoxKey(m, context) };
    return cached.key;
  }

  return {
    encrypt(plain) {
      if (plain === '') return '';
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key(), iv);
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const payload = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), d: data.toString('base64') };
      return SECRET_BOX_PREFIX + Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    },
    decrypt(stored) {
      if (stored === '') return '';
      const payload = parseCanonical(stored);
      if (!payload) throw new SecretBoxError('secret_box.not_encrypted', `secret-box: value for '${context}' is not in the enc1: format`);
      const k = key();
      try {
        return openAesGcm(k, payload);
      } catch {
        throw new SecretBoxError('secret_box.unreadable', `secret-box: value for '${context}' does not open with the configured key`);
      }
    },
    isEncrypted(stored) {
      return parseCanonical(stored) !== null;
    },
    enabled() {
      return material() !== '';
    },
  };
}
