import { createHash, randomBytes } from 'node:crypto';

/**
 * Per-user API keys. A key carries permissions the host defines (e.g. 'stations.write') and applies either to all
 * resources of its user, including future ones, or to a whitelist of resource ids. Resource ids must be stable
 * (not a renamable slug). Only a hash of the key is stored; the key itself is shown once.
 */

export type UserId = string | number;

export type ApiKeyRecord = {
  id: string;
  userId: UserId;
  label: string;
  /** The first characters of the key, to recognise it in a list. */
  prefix: string;
  permissions: string[];
  allResources: boolean;
  resources: string[];
  createdAt: Date;
  lastUsedAt: Date | null;
  revokedAt: Date | null;
};

export type ApiKeyInput = {
  label: string;
  permissions: string[];
  allResources: boolean;
  resources: string[];
};

export interface ApiKeyStore {
  insert(input: ApiKeyInput & { userId: UserId; keyHash: string; prefix: string }): Promise<ApiKeyRecord>;
  list(userId: UserId): Promise<ApiKeyRecord[]>;
  /** A key of this user, revoked or not. */
  find(userId: UserId, id: string): Promise<ApiKeyRecord | null>;
  /** An active key by its hash. */
  findByHash(keyHash: string): Promise<ApiKeyRecord | null>;
  update(userId: UserId, id: string, patch: Partial<ApiKeyInput>): Promise<ApiKeyRecord | null>;
  revoke(userId: UserId, id: string): Promise<boolean>;
  touch(id: string): Promise<void>;
  /** Adds a resource to a whitelist key (no-op for all-resource keys). */
  addResource(id: string, resource: string): Promise<void>;
  /** Removes a resource from every key of the user, e.g. after the resource was deleted. */
  forgetResource(userId: UserId, resource: string): Promise<void>;
}

export class ApiKeyError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
    this.name = 'ApiKeyError';
  }
}

export function hashApiKey(key: string, pepper = ''): string {
  return createHash('sha256').update(`${pepper}:${key}`, 'utf8').digest('hex');
}

/** `${prefix}_` and 32 random bytes in base64url. */
export function generateApiKey(prefix: string): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

/** Whether a key may do `permission` on `resource` (omit resource for actions not tied to one, like creating). */
export function apiKeyAllows(key: ApiKeyRecord, permission: string, resource?: string): boolean {
  if (key.revokedAt || !key.permissions.includes(permission)) return false;
  if (resource === undefined || key.allResources) return true;
  return key.resources.includes(resource);
}

export type ApiKeyServiceOptions = {
  store: ApiKeyStore;
  /** The permissions a key may carry. */
  permissions: readonly string[];
  /** Key prefix, e.g. 'hwd'. */
  prefix: string;
  /** Secret mixed into the hash; read on every call. */
  pepper?: () => string;
  /** Rejects resource ids the user does not own; returns the ones that are not allowed. */
  foreignResources?: (userId: UserId, resources: string[]) => Promise<string[]>;
  maxKeysPerUser?: number;
};

const TOUCH_INTERVAL_MS = 60_000;

export class ApiKeyService {
  private readonly lastTouch = new Map<string, number>();

  constructor(private readonly o: ApiKeyServiceOptions) {}

  get permissions(): readonly string[] {
    return this.o.permissions;
  }

  private pepper(): string {
    return this.o.pepper?.() ?? '';
  }

  private async check(userId: UserId, input: Partial<ApiKeyInput>): Promise<void> {
    if (input.label !== undefined && (!input.label.trim() || input.label.length > 120)) {
      throw new ApiKeyError('api_keys.label_invalid', 400);
    }
    if (input.permissions !== undefined) {
      if (input.permissions.length === 0) throw new ApiKeyError('api_keys.permissions_required', 400);
      if (input.permissions.some((p) => !this.o.permissions.includes(p))) {
        throw new ApiKeyError('api_keys.permission_unknown', 400);
      }
    }
    if (input.resources !== undefined) {
      if (input.resources.length > 500) throw new ApiKeyError('api_keys.too_many_resources', 400);
      const foreign = (await this.o.foreignResources?.(userId, input.resources)) ?? [];
      if (foreign.length > 0) throw new ApiKeyError('api_keys.resource_unknown', 400);
    }
  }

  /** The new key in plain text, shown once, and its record. */
  async create(userId: UserId, input: ApiKeyInput): Promise<{ key: string; record: ApiKeyRecord }> {
    const normalized = { ...input, label: input.label.trim(), resources: input.allResources ? [] : [...new Set(input.resources)] };
    await this.check(userId, normalized);
    const max = this.o.maxKeysPerUser ?? 50;
    if ((await this.o.store.list(userId)).filter((k) => !k.revokedAt).length >= max) {
      throw new ApiKeyError('api_keys.too_many_keys', 400);
    }
    const key = generateApiKey(this.o.prefix);
    const record = await this.o.store.insert({
      ...normalized,
      userId,
      keyHash: hashApiKey(key, this.pepper()),
      prefix: key.slice(0, this.o.prefix.length + 7),
    });
    return { key, record };
  }

  list(userId: UserId): Promise<ApiKeyRecord[]> {
    return this.o.store.list(userId);
  }

  async update(userId: UserId, id: string, patch: Partial<ApiKeyInput>): Promise<ApiKeyRecord> {
    const current = await this.o.store.find(userId, id);
    if (!current || current.revokedAt) throw new ApiKeyError('api_keys.not_found', 404);
    const normalized: Partial<ApiKeyInput> = { ...patch };
    if (normalized.label !== undefined) normalized.label = normalized.label.trim();
    if (normalized.resources !== undefined) normalized.resources = [...new Set(normalized.resources)];
    if (normalized.allResources === true) normalized.resources = [];
    await this.check(userId, normalized);
    const updated = await this.o.store.update(userId, id, normalized);
    if (!updated) throw new ApiKeyError('api_keys.not_found', 404);
    return updated;
  }

  async revoke(userId: UserId, id: string): Promise<void> {
    if (!(await this.o.store.revoke(userId, id))) throw new ApiKeyError('api_keys.not_found', 404);
  }

  /** The active key behind a raw key, or null. Updates last_used_at at most once a minute. */
  async authenticate(raw: string | undefined | null): Promise<ApiKeyRecord | null> {
    if (!raw || !raw.startsWith(`${this.o.prefix}_`)) return null;
    const record = await this.o.store.findByHash(hashApiKey(raw, this.pepper()));
    if (!record) return null;
    const now = Date.now();
    if ((this.lastTouch.get(record.id) ?? 0) < now - TOUCH_INTERVAL_MS) {
      this.lastTouch.set(record.id, now);
      if (this.lastTouch.size > 10_000) this.lastTouch.clear();
      await this.o.store.touch(record.id);
    }
    return record;
  }

  /** A whitelist key that created a resource gets access to it. */
  async grantCreated(key: ApiKeyRecord, resource: string): Promise<void> {
    if (!key.allResources) await this.o.store.addResource(key.id, resource);
  }

  forgetResource(userId: UserId, resource: string): Promise<void> {
    return this.o.store.forgetResource(userId, resource);
  }
}

/** Wire format (snake_case). */
export function apiKeyJson(record: ApiKeyRecord) {
  return {
    id: record.id,
    label: record.label,
    prefix: record.prefix,
    permissions: record.permissions,
    all_resources: record.allResources,
    resources: record.resources,
    created_at: record.createdAt.toISOString(),
    last_used_at: record.lastUsedAt?.toISOString() ?? null,
    revoked_at: record.revokedAt?.toISOString() ?? null,
  };
}
