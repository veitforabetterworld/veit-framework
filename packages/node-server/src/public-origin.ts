import type { FastifyRequest } from 'fastify';

function firstHeader(req: FastifyRequest, name: string): string | undefined {
  const v = req.headers[name];
  if (typeof v === 'string') return v.split(',')[0]?.trim();
  if (Array.isArray(v) && v[0]) return String(v[0]).split(',')[0]?.trim();
  return undefined;
}

export type PublicAppOriginOptions = {
  /**
   * Fallback when the request has no Host / X-Forwarded-Host
   * (Cron, scripts, internal calls).
   */
  fallback: string;
};

/**
 * Public base URL of the web app (scheme + host) from the current HTTP request.
 * Uses `X-Forwarded-Proto` / `X-Forwarded-Host` behind a reverse proxy (Fastify: `trustProxy`).
 */
export function publicAppOrigin(req: FastifyRequest, options: PublicAppOriginOptions): string {
  const xfProto = firstHeader(req, 'x-forwarded-proto');
  const xfHost = firstHeader(req, 'x-forwarded-host');
  const host = xfHost ?? firstHeader(req, 'host') ?? '';
  let proto = xfProto;
  if (!proto) {
    proto =
      typeof (req as { protocol?: string }).protocol === 'string'
        ? (req as { protocol: string }).protocol
        : 'http';
  }
  if (host !== '') {
    return `${proto}://${host}`.replace(/\/$/, '');
  }
  return options.fallback.replace(/\/$/, '');
}
