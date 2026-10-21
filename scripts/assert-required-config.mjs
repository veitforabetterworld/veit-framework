/**
 * Gemeinsame Pflichtfeld-Prüfung für Host-Configs.
 * @param {Record<string, unknown>} config
 * @param {Array<[string, unknown]>} required
 * @param {(message: string) => never} fail
 */
export function assertRequiredConfig(config, required, fail) {
  for (const [key, value] of required) {
    if (value === undefined || value === null || value === '') {
      fail(`fehlender Wert: ${key}`);
    }
  }
  return config;
}
