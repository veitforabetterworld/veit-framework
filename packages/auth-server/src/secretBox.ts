import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto';
import type { SecretBox } from './types.js';

/**
 * AES-256-GCM, stored as base64 of {"iv","tag","d"} (each base64). The key is sha256(`${material}|${context}`), so
 * the same material can serve several purposes. Matches Plenivo's MfaSecretCrypto (context 'plenivo-mfa-totp').
 *
 * keyMaterial is read on every call, so a key changed in the host's settings applies at once.
 */
export function createAesGcmSecretBox(keyMaterial: () => string, context: string): SecretBox {
  let cached: { material: string; key: Buffer } | null = null;

  function key32(): Buffer {
    const material = keyMaterial();
    if (material === '') throw new Error('MFA key material is not configured');
    if (cached?.material !== material) {
      cached = { material, key: createHash('sha256').update(`${material}|${context}`, 'utf8').digest().subarray(0, 32) };
    }
    return cached.key;
  }

  return {
    encrypt(plain) {
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key32(), iv);
      const data = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
      const payload = { iv: iv.toString('base64'), tag: cipher.getAuthTag().toString('base64'), d: data.toString('base64') };
      return Buffer.from(JSON.stringify(payload), 'utf8').toString('base64');
    },
    decrypt(stored) {
      if (stored === '') return '';
      try {
        const payload = JSON.parse(Buffer.from(stored, 'base64').toString('utf8')) as { iv?: string; tag?: string; d?: string };
        const iv = Buffer.from(payload.iv ?? '', 'base64');
        const tag = Buffer.from(payload.tag ?? '', 'base64');
        if (iv.length !== 12 || tag.length !== 16) return '';
        const decipher = createDecipheriv('aes-256-gcm', key32(), iv);
        decipher.setAuthTag(tag);
        return Buffer.concat([decipher.update(Buffer.from(payload.d ?? '', 'base64')), decipher.final()]).toString('utf8');
      } catch {
        return '';
      }
    },
  };
}
