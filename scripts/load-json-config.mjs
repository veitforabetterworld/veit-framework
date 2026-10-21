/**
 * JSON-Config mit optionalem Local-Override. Objekte werden tief gemerged, Arrays ersetzt.
 */
import fs from 'node:fs';

/**
 * @param {unknown} base
 * @param {unknown} override
 * @returns {unknown}
 */
export function deepMerge(base, override) {
  if (override === null || typeof override !== 'object' || Array.isArray(override)) {
    return override;
  }
  if (base === null || typeof base !== 'object' || Array.isArray(base)) {
    return override;
  }
  /** @type {Record<string, unknown>} */
  const result = { .../** @type {Record<string, unknown>} */ (base) };
  for (const [key, value] of Object.entries(/** @type {Record<string, unknown>} */ (override))) {
    const existing = result[key];
    if (
      value !== null &&
      typeof value === 'object' &&
      !Array.isArray(value) &&
      existing !== null &&
      typeof existing === 'object' &&
      !Array.isArray(existing)
    ) {
      result[key] = deepMerge(existing, value);
    } else {
      result[key] = value;
    }
  }
  return result;
}

/**
 * @param {string} basePath
 * @param {string} [localPath]
 */
export function loadJsonConfig(basePath, localPath) {
  const base = JSON.parse(fs.readFileSync(basePath, 'utf8'));
  if (localPath && fs.existsSync(localPath)) {
    return deepMerge(base, JSON.parse(fs.readFileSync(localPath, 'utf8')));
  }
  return base;
}
