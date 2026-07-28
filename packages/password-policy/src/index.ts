import { createHash } from 'node:crypto';

import { zxcvbn, zxcvbnOptions } from '@zxcvbn-ts/core';
import { adjacencyGraphs, dictionary } from '@zxcvbn-ts/language-common';

export const PASSWORD_MIN_LENGTH = 10;
const ZXCVBN_MIN_SCORE = 3;
const HIBP_RANGE_CACHE_TTL_MS = 60 * 60 * 1000;

export type PasswordSecurityReason = 'too_short' | 'too_weak' | 'pwned';

export type PasswordPolicyErrorCode = PasswordSecurityReason | 'check_unavailable';

export type PasswordSecurityEvaluation = {
  safe: boolean;
  reasons: PasswordSecurityReason[];
  checkUnavailable: boolean;
  zxcvbnScore: number;
  pwnedCount: number | null;
};

export class PasswordPolicyError extends Error {
  readonly code: PasswordPolicyErrorCode;
  readonly status: number;

  constructor(code: PasswordPolicyErrorCode, status: number, message?: string) {
    super(message ?? code);
    this.name = 'PasswordPolicyError';
    this.code = code;
    this.status = status;
  }
}

export function isPasswordPolicyError(err: unknown): err is PasswordPolicyError {
  return err instanceof PasswordPolicyError;
}

type HibpRangeCacheEntry = { expiresAt: number; suffixCounts: Map<string, number> };

const hibpRangeCache = new Map<string, HibpRangeCacheEntry>();

zxcvbnOptions.setOptions({
  dictionary,
  graphs: adjacencyGraphs,
});

function sha1HexUpper(value: string): string {
  return createHash('sha1').update(value, 'utf8').digest('hex').toUpperCase();
}

function parseHibpRangeBody(body: string): Map<string, number> {
  const suffixCounts = new Map<string, number>();
  for (const line of body.split(/\r?\n/)) {
    const [suf, countRaw] = line.split(':');
    if (!suf || !countRaw) continue;
    const n = Number(countRaw.trim());
    suffixCounts.set(suf.trim().toUpperCase(), Number.isFinite(n) ? n : 1);
  }
  return suffixCounts;
}

async function getHibpSuffixCounts(prefix: string, failClosed: boolean): Promise<Map<string, number> | null> {
  const cached = hibpRangeCache.get(prefix);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.suffixCounts;
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const res = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
      method: 'GET',
      headers: { 'Add-Padding': 'true' },
      signal: controller.signal,
    });
    if (!res.ok) return failClosed ? null : new Map();
    const txt = await res.text();
    const suffixCounts = parseHibpRangeBody(txt);
    hibpRangeCache.set(prefix, {
      expiresAt: Date.now() + HIBP_RANGE_CACHE_TTL_MS,
      suffixCounts,
    });
    return suffixCounts;
  } catch {
    return failClosed ? null : new Map();
  } finally {
    clearTimeout(timeout);
  }
}

async function getPwnedCount(password: string, failClosed: boolean): Promise<number | null> {
  const hash = sha1HexUpper(password);
  const prefix = hash.slice(0, 5);
  const suffix = hash.slice(5);
  const range = await getHibpSuffixCounts(prefix, failClosed);
  if (!range) return null;
  return range.get(suffix) ?? 0;
}

export async function evaluatePasswordSecurity(
  password: string,
  options?: { minLength?: number; failClosed?: boolean },
): Promise<PasswordSecurityEvaluation> {
  const minLength = options?.minLength ?? PASSWORD_MIN_LENGTH;
  const failClosed = options?.failClosed ?? false;
  const reasons: PasswordSecurityReason[] = [];
  if (password.length < minLength) {
    reasons.push('too_short');
  }
  const zxcvbnScore = zxcvbn(password).score;
  if (zxcvbnScore < ZXCVBN_MIN_SCORE) {
    reasons.push('too_weak');
  }
  const pwnedCount = await getPwnedCount(password, failClosed);
  if (pwnedCount === null) {
    return {
      safe: reasons.length === 0,
      reasons,
      checkUnavailable: true,
      zxcvbnScore,
      pwnedCount: null,
    };
  }
  if (pwnedCount > 0) {
    reasons.push('pwned');
  }
  return {
    safe: reasons.length === 0,
    reasons,
    checkUnavailable: false,
    zxcvbnScore,
    pwnedCount,
  };
}

/**
 * Throws {@link PasswordPolicyError} with generic `code` / HTTP `status`.
 * Hosts map codes to domain errors (e.g. oRPC `apiError`).
 */
export async function assertStrongPassword(password: string): Promise<void> {
  const evaluation = await evaluatePasswordSecurity(password, { failClosed: true });
  if (evaluation.checkUnavailable) {
    throw new PasswordPolicyError('check_unavailable', 503);
  }
  if (evaluation.reasons.includes('too_short')) {
    throw new PasswordPolicyError('too_short', 400);
  }
  if (evaluation.reasons.includes('too_weak')) {
    throw new PasswordPolicyError('too_weak', 400);
  }
  if (evaluation.reasons.includes('pwned')) {
    throw new PasswordPolicyError('pwned', 400);
  }
}

/** Test hook: clear in-memory HIBP prefix cache. */
export function clearPasswordPolicyCachesForTests(): void {
  hibpRangeCache.clear();
}
