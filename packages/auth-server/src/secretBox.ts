import { createSecretBox } from '@veit/secret-box';
import type { SecretBox } from './types.js';

/**
 * @deprecated Use createSecretBox from '@veit/secret-box'; AuthService takes it as `secretBox` directly.
 *
 * The canonical format of '@veit/secret-box' (`enc1:` plus AES-256-GCM, key sha256(`${material}|${context}`)). It no
 * longer reads the older layout without `enc1:`; stored TOTP secrets are converted once with reencryptRows from
 * '@veit/secret-box/migrate' (source `auth-json` with the old context). decrypt returns '' for anything it cannot
 * open, as AuthService expects.
 */
export function createAesGcmSecretBox(keyMaterial: () => string, context: string): SecretBox {
  const box = createSecretBox({ key: keyMaterial, context });
  return {
    encrypt: (plain) => box.encrypt(plain),
    decrypt(stored) {
      try {
        return box.decrypt(stored);
      } catch {
        return '';
      }
    },
  };
}
